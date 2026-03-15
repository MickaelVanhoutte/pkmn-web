import type {
  PokemonBattleState, BattlePosition, PlayerIndex, TypeName,
} from '../types';
import type { SideState } from '../types/battle';
import { getTypeEffectiveness } from '../data/type-chart';
import { applyDamage, getPokemonName } from '../model/pokemon';
import type { EventBus } from '../events/event-bus';

export class HazardProcessor {
  constructor(private eventBus: EventBus) {}

  onSwitchIn(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    side: SideState,
    turn: number,
  ): void {
    if (pokemon.isFainted) return;

    const types = pokemon.species.types as TypeName[];
    const isGrounded = !types.includes('flying');
    // Note: Levitate immunity handled separately via ability check

    // Stealth Rock: typed damage based on Rock effectiveness
    if (side.stealthRock) {
      const effectiveness = getTypeEffectiveness('rock', types);
      const damage = Math.max(1, Math.floor(pokemon.maxHp * effectiveness / 8));
      const actual = applyDamage(pokemon, damage);
      this.eventBus.emit({
        kind: 'hazard-damage',
        turn,
        target: position,
        hazard: 'stealthRock',
        amount: actual,
        currentHp: pokemon.currentHp,
        maxHp: pokemon.maxHp,
      });

      if (pokemon.isFainted) {
        this.eventBus.emit({
          kind: 'faint',
          turn,
          target: position,
          pokemonName: getPokemonName(pokemon),
        });
        return;
      }
    }

    // Spikes: only affect grounded pokemon
    if (isGrounded && side.spikesLayers > 0) {
      const fractions = [0, 1 / 8, 1 / 6, 1 / 4];
      const fraction = fractions[side.spikesLayers] ?? 1 / 4;
      const damage = Math.max(1, Math.floor(pokemon.maxHp * fraction));
      const actual = applyDamage(pokemon, damage);
      this.eventBus.emit({
        kind: 'hazard-damage',
        turn,
        target: position,
        hazard: 'spikes',
        amount: actual,
        currentHp: pokemon.currentHp,
        maxHp: pokemon.maxHp,
      });

      if (pokemon.isFainted) {
        this.eventBus.emit({
          kind: 'faint',
          turn,
          target: position,
          pokemonName: getPokemonName(pokemon),
        });
        return;
      }
    }

    // Toxic Spikes: apply poison to grounded pokemon
    if (isGrounded && side.toxicSpikesLayers > 0) {
      // Poison types absorb toxic spikes
      if (types.includes('poison')) {
        side.toxicSpikesLayers = 0;
        this.eventBus.emit({
          kind: 'hazard-cleared',
          turn,
          side: position.player,
          hazard: 'toxicSpikes',
        });
      } else if (!pokemon.status) {
        // Steel types are immune to poison
        if (!types.includes('steel')) {
          pokemon.status = 'poison';
          pokemon.statusTurns = 0;
          this.eventBus.emit({
            kind: 'status-applied',
            turn,
            target: position,
            status: 'poison',
            pokemonName: getPokemonName(pokemon),
          });
        }
      }
    }

    // Sticky Web: lower speed by 1
    if (isGrounded && side.stickyWeb) {
      if (pokemon.statStages.spe > -6) {
        pokemon.statStages.spe = Math.max(-6, pokemon.statStages.spe - 1);
        this.eventBus.emit({
          kind: 'stat-change',
          turn,
          target: position,
          stat: 'spe',
          stages: -1,
          currentStage: pokemon.statStages.spe,
          pokemonName: getPokemonName(pokemon),
        });
      }
    }
  }

  setHazard(
    side: SideState,
    hazard: string,
    playerIndex: PlayerIndex,
    turn: number,
  ): boolean {
    switch (hazard) {
      case 'stealthRock':
        if (side.stealthRock) return false;
        side.stealthRock = true;
        break;
      case 'spikes':
        if (side.spikesLayers >= 3) return false;
        side.spikesLayers++;
        break;
      case 'toxicSpikes':
        if (side.toxicSpikesLayers >= 2) return false;
        side.toxicSpikesLayers++;
        break;
      case 'stickyWeb':
        if (side.stickyWeb) return false;
        side.stickyWeb = true;
        break;
      default:
        return false;
    }

    this.eventBus.emit({
      kind: 'hazard-set',
      turn,
      side: playerIndex,
      hazard,
      layers: hazard === 'spikes' ? side.spikesLayers : hazard === 'toxicSpikes' ? side.toxicSpikesLayers : undefined,
    });

    return true;
  }

  clearHazards(
    side: SideState,
    playerIndex: PlayerIndex,
    turn: number,
  ): void {
    if (side.stealthRock) {
      side.stealthRock = false;
      this.eventBus.emit({ kind: 'hazard-cleared', turn, side: playerIndex, hazard: 'stealthRock' });
    }
    if (side.spikesLayers > 0) {
      side.spikesLayers = 0;
      this.eventBus.emit({ kind: 'hazard-cleared', turn, side: playerIndex, hazard: 'spikes' });
    }
    if (side.toxicSpikesLayers > 0) {
      side.toxicSpikesLayers = 0;
      this.eventBus.emit({ kind: 'hazard-cleared', turn, side: playerIndex, hazard: 'toxicSpikes' });
    }
    if (side.stickyWeb) {
      side.stickyWeb = false;
      this.eventBus.emit({ kind: 'hazard-cleared', turn, side: playerIndex, hazard: 'stickyWeb' });
    }
  }
}
