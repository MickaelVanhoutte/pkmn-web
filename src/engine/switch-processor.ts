import type {
  PokemonBattleState, BattlePosition, PlayerIndex, MoveData,
} from '../types';
import type { PlayerState, FieldState } from '../types/battle';
import { clearVolatileStatuses, resetStatStages, cureStatus, getPokemonName } from '../model/pokemon';
import { getSide } from '../model/field';
import { HazardProcessor } from './hazard-processor';
import { AbilityDispatcher } from './ability-dispatcher';
import type { EventBus } from '../events/event-bus';

export class SwitchProcessor {
  constructor(
    private eventBus: EventBus,
    private hazardProcessor: HazardProcessor,
    private abilityDispatcher: AbilityDispatcher,
  ) {}

  performSwitch(
    player: PlayerState,
    slot: number,
    switchToIndex: number,
    field: FieldState,
    opponents: PokemonBattleState[],
    turn: number,
  ): void {
    const activeIndex = player.activePokemon[slot];
    const outgoing = player.team[activeIndex];
    const incoming = player.team[switchToIndex];

    if (!incoming || incoming.isFainted) return;

    const position: BattlePosition = { player: player.index, slot };

    // Switch out
    this.switchOut(outgoing, position, turn);

    // Update active pokemon
    outgoing.isActive = false;
    outgoing.slotIndex = -1;
    player.activePokemon[slot] = switchToIndex;
    incoming.isActive = true;
    incoming.slotIndex = slot;

    // Switch in
    this.switchIn(incoming, position, field, opponents, turn);
  }

  private switchOut(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    turn: number,
  ): void {
    // Fire onSwitchOut abilities
    this.abilityDispatcher.dispatch('onSwitchOut', pokemon, position, {
      source: pokemon,
    }, turn);

    // Natural Cure: heal status on switch out
    if (pokemon.ability === 'natural-cure' && pokemon.status) {
      const cured = cureStatus(pokemon);
      if (cured) {
        this.eventBus.emit({
          kind: 'status-cured',
          turn,
          target: position,
          status: cured,
          pokemonName: getPokemonName(pokemon),
          source: 'ability',
        });
      }
    }

    // Clear volatile statuses and stat stages
    clearVolatileStatuses(pokemon);
    resetStatStages(pokemon);
    pokemon.lastMoveUsed = null;
    pokemon.turnsSinceSwitch = 0;
    pokemon.substituteHp = 0;
    pokemon.confusionTurns = 0;
    pokemon.chargeMoveId = null;
    pokemon.chargeMoveTargetPos = null;
    pokemon.choiceLocked = null;

    this.eventBus.emit({
      kind: 'switch-out',
      turn,
      player: position.player,
      slot: position.slot,
      pokemonName: getPokemonName(pokemon),
    });
  }

  private switchIn(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    field: FieldState,
    opponents: PokemonBattleState[],
    turn: number,
  ): void {
    this.eventBus.emit({
      kind: 'switch-in',
      turn,
      player: position.player,
      slot: position.slot,
      pokemonName: getPokemonName(pokemon),
      teamIndex: pokemon.teamIndex,
    });

    // Apply entry hazards
    const side = getSide(field, position.player);
    this.hazardProcessor.onSwitchIn(pokemon, position, side, turn);

    if (pokemon.isFainted) return;

    // Fire onSwitchIn abilities
    const results = this.abilityDispatcher.dispatch('onSwitchIn', pokemon, position, {
      source: pokemon,
      allOpponents: opponents,
      weather: field.weather,
    }, turn);

    // Process ability results
    for (const result of results) {
      if (result.action === 'set-weather') {
        field.weather = result.weather;
        field.weatherTurnsRemaining = 5;
        this.eventBus.emit({
          kind: 'weather-set',
          turn,
          weather: result.weather,
          turns: 5,
        });
      } else if (result.action === 'boost-stat') {
        // Intimidate: lower all opponents' attack
        for (const opp of opponents) {
          if (opp.isFainted) continue;
          const oldStage = opp.statStages[result.stat];
          opp.statStages[result.stat] = Math.max(-6, Math.min(6, oldStage + result.stages));
          this.eventBus.emit({
            kind: 'stat-change',
            turn,
            target: { player: position.player === 0 ? 1 : 0, slot: opp.slotIndex },
            stat: result.stat,
            stages: result.stages,
            currentStage: opp.statStages[result.stat],
            pokemonName: getPokemonName(opp),
          });
        }
      }
    }
  }

  sendOutInitial(
    player: PlayerState,
    slot: number,
    teamIndex: number,
    field: FieldState,
    opponents: PokemonBattleState[],
    turn: number,
  ): void {
    const pokemon = player.team[teamIndex];
    if (!pokemon || pokemon.isFainted) return;

    player.activePokemon[slot] = teamIndex;
    pokemon.isActive = true;
    pokemon.slotIndex = slot;

    const position: BattlePosition = { player: player.index, slot };

    this.eventBus.emit({
      kind: 'switch-in',
      turn,
      player: player.index,
      slot,
      pokemonName: getPokemonName(pokemon),
      teamIndex,
    });

    // Fire onSwitchIn abilities (no hazards on initial send-out)
    const results = this.abilityDispatcher.dispatch('onSwitchIn', pokemon, position, {
      source: pokemon,
      allOpponents: opponents,
      weather: field.weather,
    }, turn);

    for (const result of results) {
      if (result.action === 'set-weather') {
        field.weather = result.weather;
        field.weatherTurnsRemaining = 5;
        this.eventBus.emit({
          kind: 'weather-set',
          turn,
          weather: result.weather,
          turns: 5,
        });
      } else if (result.action === 'boost-stat') {
        for (const opp of opponents) {
          if (opp.isFainted) continue;
          const oldStage = opp.statStages[result.stat];
          opp.statStages[result.stat] = Math.max(-6, Math.min(6, oldStage + result.stages));
          this.eventBus.emit({
            kind: 'stat-change',
            turn,
            target: { player: position.player === 0 ? 1 : 0, slot: opp.slotIndex },
            stat: result.stat,
            stages: result.stages,
            currentStage: opp.statStages[result.stat],
            pokemonName: getPokemonName(opp),
          });
        }
      }
    }
  }

  forceRandomSwitch(
    player: PlayerState,
    slot: number,
    field: FieldState,
    opponents: PokemonBattleState[],
    rng: { next(): number },
    turn: number,
  ): boolean {
    // Find non-fainted, non-active bench pokemon
    const bench = player.team
      .map((p, i) => ({ pokemon: p, index: i }))
      .filter(({ pokemon, index }) =>
        !pokemon.isFainted && !pokemon.isActive && !player.activePokemon.includes(index),
      );

    if (bench.length === 0) return false;

    // Pick random bench pokemon
    const pick = bench[Math.floor(rng.next() * bench.length)];
    this.performSwitch(player, slot, pick.index, field, opponents, turn);
    return true;
  }
}
