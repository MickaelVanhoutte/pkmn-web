import type {
  TurnAction, PlayerIndex, BattlePosition, PokemonBattleState, Weather,
} from '../types';
import type {
  BattleState, ResolvedAction, PlayerState, FieldState,
} from '../types/battle';
import { STATUS_STAT_REDUCTION } from '../types/common';
import { getMove } from '../data/move-registry';
import { getStatStageMultiplier } from '../utils/stat-calc';
import { hasVolatileStatus, removeVolatileStatus, getPokemonName, applyDamage, applyHeal, cureStatus } from '../model/pokemon';
import { getItem } from '../data/item-registry';
import { MoveExecutor } from './move-executor';
import { SwitchProcessor } from './switch-processor';
import { StatusProcessor } from './status-processor';
import { AbilityDispatcher } from './ability-dispatcher';
import type { EventBus } from '../events/event-bus';
import type { SeededRNG } from './rng';

export class TurnResolver {
  constructor(
    private eventBus: EventBus,
    private rng: SeededRNG,
    private moveExecutor: MoveExecutor,
    private switchProcessor: SwitchProcessor,
    private statusProcessor: StatusProcessor,
    private abilityDispatcher: AbilityDispatcher,
  ) {}

  resolveActions(
    actions: TurnAction[],
    state: BattleState,
  ): void {
    const resolved = this.sortActions(actions, state);

    for (const resolved_action of resolved) {
      if (state.isOver) break;
      if (resolved_action.consumed) continue;

      this.executeAction(resolved_action.action, state, resolved);
    }
  }

  sortActions(actions: TurnAction[], state: BattleState): ResolvedAction[] {
    const resolved: ResolvedAction[] = actions.map((action, i) => {
      let priority = 0;
      let speed = 0;

      switch (action.type) {
        case 'switch': {
          priority = 100; // Switches go first
          // Faster pokemon switch first
          const player = state.players[action.player];
          const activeIdx = player.activePokemon[action.slot];
          const pokemon = player.team[activeIdx];
          if (pokemon && !pokemon.isFainted) {
            speed = this.getEffectiveSpeed(pokemon, state.field, action.player);
          }
          break;
        }
        case 'item': {
          priority = 99; // Items go second
          // Faster player uses items first
          const itemPlayer = state.players[action.player];
          const itemActiveIdx = itemPlayer.activePokemon[0]; // Use first active slot's speed
          const itemPokemon = itemPlayer.team[itemActiveIdx];
          if (itemPokemon && !itemPokemon.isFainted) {
            speed = this.getEffectiveSpeed(itemPokemon, state.field, action.player);
          }
          break;
        }
        case 'run':
          priority = 98; // Run goes third
          speed = 0;
          break;
        case 'catch':
          priority = 97; // Catch goes after run
          speed = 0;
          break;
        case 'move': {
          const player = state.players[action.player];
          const activeIdx = player.activePokemon[action.slot];
          const pokemon = player.team[activeIdx];
          if (pokemon && !pokemon.isFainted) {
            const moveState = pokemon.moves[action.moveIndex];
            if (moveState) {
              const moveData = getMove(moveState.moveId);
              priority = moveData.priority;
            }
            speed = this.getEffectiveSpeed(pokemon, state.field, action.player);
          }
          break;
        }
      }

      // Assign stable random tiebreaker upfront
      return { action, priority, speed, order: i, tiebreaker: this.rng.next() };
    });

    // Sort: higher priority first, then speed (inverted under Trick Room for moves), then tiebreaker
    const trickRoomActive = state.field.trickRoom > 0;
    resolved.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      // Trick Room inverts speed ordering for moves only (not switches/items)
      if (a.speed !== b.speed) {
        const bothMoves = a.action.type === 'move' && b.action.type === 'move';
        if (trickRoomActive && bothMoves) {
          return a.speed - b.speed; // slower goes first
        }
        return b.speed - a.speed; // faster goes first
      }
      return a.tiebreaker - b.tiebreaker;
    });

    return resolved;
  }

  private getEffectiveSpeed(pokemon: PokemonBattleState, field: FieldState, playerIndex: PlayerIndex): number {
    let speed = pokemon.calculatedStats.spe;

    // Stat stages
    speed = Math.floor(speed * getStatStageMultiplier(pokemon.statStages.spe));

    // Paralysis: -50% speed
    if (pokemon.status === 'paralysis') {
      speed = Math.floor(speed * 0.5);
    }

    // Tailwind: 2x speed
    if (field.sides[playerIndex].tailwind > 0) {
      speed = Math.floor(speed * 2);
    }

    // Choice Scarf: 1.5x speed
    if (pokemon.item === 'choice-scarf') {
      speed = Math.floor(speed * 1.5);
    }

    // Speed ability modifiers (Chlorophyll, Swift Swim)
    const speedMod = this.abilityDispatcher.getModifier('modifySpe', pokemon, {
      source: pokemon,
      weather: field.weather,
    });
    speed = Math.floor(speed * speedMod);

    return Math.max(1, speed);
  }

  private executeAction(action: TurnAction, state: BattleState, resolved?: ResolvedAction[]): void {
    switch (action.type) {
      case 'switch':
        this.executeSwitch(action, state, resolved);
        break;
      case 'move':
        this.executeMove(action, state);
        break;
      case 'item':
        this.executeItem(action, state);
        break;
      case 'run':
        this.executeRun(action, state);
        break;
      case 'catch':
        this.executeCatch(action, state);
        break;
    }
  }

  private executeSwitch(
    action: Extract<TurnAction, { type: 'switch' }>,
    state: BattleState,
    resolved?: ResolvedAction[],
  ): void {
    const player = state.players[action.player];
    const activeIdx = player.activePokemon[action.slot];
    const switchingPokemon = player.team[activeIdx];

    // Check for Pursuit from the opponent
    if (resolved && switchingPokemon && !switchingPokemon.isFainted) {
      const opponentIndex = (action.player === 0 ? 1 : 0) as PlayerIndex;
      for (const ra of resolved) {
        if (ra.consumed) continue;
        if (ra.action.type !== 'move') continue;
        if (ra.action.player !== opponentIndex) continue;

        const oppPlayer = state.players[opponentIndex];
        const oppActiveIdx = oppPlayer.activePokemon[ra.action.slot];
        const oppPokemon = oppPlayer.team[oppActiveIdx];
        if (!oppPokemon || oppPokemon.isFainted) continue;

        // Can't use Pursuit if asleep or flinching
        if (oppPokemon.status === 'sleep') continue;
        if (hasVolatileStatus(oppPokemon, 'flinch')) continue;

        const moveState = oppPokemon.moves[ra.action.moveIndex];
        if (!moveState) continue;
        const moveData = getMove(moveState.moveId);
        const hasPursuit = moveData.effects.some(e => e.type === 'pursuit');
        if (!hasPursuit) continue;

        // In doubles, Pursuit only triggers if the user was targeting the switching slot
        if (state.config.format === 'doubles' && ra.action.targetPosition) {
          if (ra.action.targetPosition.player !== action.player || ra.action.targetPosition.slot !== action.slot) {
            continue;
          }
        }

        // Execute Pursuit with 2x power before the switch
        ra.consumed = true;
        const pursuitUserPos: BattlePosition = { player: opponentIndex, slot: ra.action.slot };
        const switchingPos: BattlePosition = { player: action.player, slot: action.slot };

        this.eventBus.emit({
          kind: 'pursuit-hit', turn: state.turn,
          user: pursuitUserPos, target: switchingPos,
        });

        // Create a modified move with 2x power for pursuit
        const pursuitMove = { ...moveData, power: (moveData.power ?? 0) * 2 };

        // Deduct PP
        moveState.currentPp--;

        // Emit move-use
        this.eventBus.emit({
          kind: 'move-use', turn: state.turn,
          user: pursuitUserPos,
          moveName: pursuitMove.name, moveId: pursuitMove.id,
          moveType: pursuitMove.type, targets: [switchingPos],
        });

        // Execute the move against the switching pokemon (simplified - direct damage calc)
        this.moveExecutor.executePursuitHit(
          oppPokemon, pursuitUserPos,
          switchingPokemon, switchingPos,
          pursuitMove, state.field, state.players,
          state.config.format, state.turn,
        );

        oppPokemon.lastMoveUsed = moveData.id;

        // If the pokemon was KO'd by pursuit, skip the switch
        if (switchingPokemon.isFainted) {
          return;
        }
      }
    }

    const opponents = this.getActiveOpponents(state, action.player);

    this.switchProcessor.performSwitch(
      player,
      action.slot,
      action.switchToIndex,
      state.field,
      opponents,
      state.turn,
    );
  }

  private executeMove(
    action: Extract<TurnAction, { type: 'move' }>,
    state: BattleState,
  ): void {
    const player = state.players[action.player];
    const activeIdx = player.activePokemon[action.slot];
    const pokemon = player.team[activeIdx];

    if (!pokemon || pokemon.isFainted) return;

    // If charging a move, override the action to use the charged move
    if (hasVolatileStatus(pokemon, 'chargeMove') && pokemon.chargeMoveId) {
      // Find the move index for the charged move
      const chargeMoveIdx = pokemon.moves.findIndex(m => m.moveId === pokemon.chargeMoveId);
      if (chargeMoveIdx >= 0) {
        action = { ...action, moveIndex: chargeMoveIdx };
      }
    }

    const userPos: BattlePosition = { player: action.player, slot: action.slot };

    // Check if can act (sleep) — checked before flinch so waking up isn't blocked by flinch
    if (!this.statusProcessor.canAct(pokemon, userPos, state.turn)) {
      return;
    }

    // Check flinch (after sleep so a just-woken pokemon isn't blocked)
    if (hasVolatileStatus(pokemon, 'flinch')) {
      removeVolatileStatus(pokemon, 'flinch');
      this.eventBus.emit({
        kind: 'message', turn: state.turn,
        text: `${getPokemonName(pokemon)} flinched and couldn't move!`,
      });
      return;
    }

    // Deduct PP here before confusion check (confusion self-hit still costs PP)
    const moveState = pokemon.moves[action.moveIndex];
    if (moveState) {
      // PP deduction happens in move-executor for normal execution,
      // but if confusion self-hit prevents the move, we still need PP deducted.
      // We'll track whether PP was already deducted to avoid double-deduction.
    }

    // Check confusion
    if (hasVolatileStatus(pokemon, 'confusion')) {
      // Check if confusion wears off first
      if (pokemon.confusionTurns <= 1) {
        removeVolatileStatus(pokemon, 'confusion');
        pokemon.confusionTurns = 0;
        this.eventBus.emit({
          kind: 'confusion-end', turn: state.turn, target: userPos,
          pokemonName: getPokemonName(pokemon),
        });
      } else {
        pokemon.confusionTurns--;
        this.eventBus.emit({
          kind: 'message', turn: state.turn,
          text: `${getPokemonName(pokemon)} is confused!`,
        });
        // 33% chance to hit self
        if (this.rng.chance(33)) {
          // Deduct PP even on confusion self-hit (games deduct PP before confusion check)
          if (moveState && moveState.currentPp > 0) {
            moveState.currentPp--;
          }

          // Confusion self-damage: 40BP physical untyped against own stats (with stat stages)
          const level = pokemon.config.level;
          const atk = Math.floor(pokemon.calculatedStats.atk * getStatStageMultiplier(pokemon.statStages.atk));
          const def = Math.floor(pokemon.calculatedStats.def * getStatStageMultiplier(pokemon.statStages.def));
          const damage = Math.max(1, Math.floor(
            (Math.floor((2 * level / 5 + 2) * 40 * atk / def) / 50) + 2,
          ));
          const actual = applyDamage(pokemon, damage);
          this.eventBus.emit({
            kind: 'confusion-hit-self', turn: state.turn, target: userPos,
            damage: actual, currentHp: pokemon.currentHp, maxHp: pokemon.maxHp,
          });
          if (pokemon.isFainted) {
            this.eventBus.emit({
              kind: 'faint', turn: state.turn, target: userPos,
              pokemonName: getPokemonName(pokemon),
            });
          }
          return;
        }
      }
    }

    // Get targets
    const targets = this.resolveTargets(action, state);

    // Psychic Terrain blocks priority moves against grounded targets
    const moveState2 = pokemon.moves[action.moveIndex];
    if (moveState2 && state.field.terrain === 'psychic') {
      const moveData2 = getMove(moveState2.moveId);
      if (moveData2.priority > 0) {
        const blocked = targets.some(t => {
          const isGrounded = !t.pokemon.species.types.includes('flying') && t.pokemon.ability !== 'levitate';
          return isGrounded && t.position.player !== action.player;
        });
        if (blocked) {
          this.eventBus.emit({ kind: 'fail', turn: state.turn, user: userPos, reason: 'Psychic Terrain prevents priority moves!' });
          return;
        }
      }
    }

    this.moveExecutor.executeMove(
      pokemon,
      userPos,
      targets,
      action.moveIndex,
      state.field,
      state.players,
      state.config.format,
      state.turn,
    );
  }

  private resolveTargets(
    action: Extract<TurnAction, { type: 'move' }>,
    state: BattleState,
  ): { pokemon: PokemonBattleState; position: BattlePosition }[] {
    const player = state.players[action.player];
    const activeIdx = player.activePokemon[action.slot];
    const pokemon = player.team[activeIdx];
    if (!pokemon) return [];

    const moveState = pokemon.moves[action.moveIndex];
    if (!moveState) return [];

    const moveData = getMove(moveState.moveId);
    const opponentIndex = (action.player === 0 ? 1 : 0) as PlayerIndex;
    const opponent = state.players[opponentIndex];

    switch (moveData.target) {
      case 'self':
        return [{ pokemon, position: { player: action.player, slot: action.slot } }];

      case 'adjacent-foe': {
        // In singles, target the one active opponent
        if (state.config.format === 'singles') {
          const oppIdx = opponent.activePokemon[0];
          const oppPoke = opponent.team[oppIdx];
          if (oppPoke && !oppPoke.isFainted) {
            return [{ pokemon: oppPoke, position: { player: opponentIndex, slot: 0 } }];
          }
        }
        // In doubles, use target position or default
        if (action.targetPosition) {
          const tPlayer = state.players[action.targetPosition.player];
          const tIdx = tPlayer.activePokemon[action.targetPosition.slot];
          const tPoke = tPlayer.team[tIdx];
          if (tPoke && !tPoke.isFainted) {
            return [{ pokemon: tPoke, position: action.targetPosition }];
          }
        }
        // Default: first active opponent
        for (let s = 0; s < opponent.activePokemon.length; s++) {
          const idx = opponent.activePokemon[s];
          const poke = opponent.team[idx];
          if (poke && !poke.isFainted) {
            return [{ pokemon: poke, position: { player: opponentIndex, slot: s } }];
          }
        }
        return [];
      }

      case 'all-adjacent-foes': {
        const targets: { pokemon: PokemonBattleState; position: BattlePosition }[] = [];
        for (let s = 0; s < opponent.activePokemon.length; s++) {
          const idx = opponent.activePokemon[s];
          const poke = opponent.team[idx];
          if (poke && !poke.isFainted) {
            targets.push({ pokemon: poke, position: { player: opponentIndex, slot: s } });
          }
        }
        return targets;
      }

      case 'all-adjacent': {
        // All adjacent: both foes + ally (in doubles)
        const targets: { pokemon: PokemonBattleState; position: BattlePosition }[] = [];
        // Opponents
        for (let s = 0; s < opponent.activePokemon.length; s++) {
          const idx = opponent.activePokemon[s];
          const poke = opponent.team[idx];
          if (poke && !poke.isFainted) {
            targets.push({ pokemon: poke, position: { player: opponentIndex, slot: s } });
          }
        }
        // Ally in doubles
        if (state.config.format === 'doubles') {
          for (let s = 0; s < player.activePokemon.length; s++) {
            if (s === action.slot) continue;
            const idx = player.activePokemon[s];
            const poke = player.team[idx];
            if (poke && !poke.isFainted) {
              targets.push({ pokemon: poke, position: { player: action.player, slot: s } });
            }
          }
        }
        return targets;
      }

      case 'all-field':
      case 'foe-side':
      case 'ally-side':
        return [{ pokemon, position: { player: action.player, slot: action.slot } }];

      case 'adjacent-ally': {
        if (state.config.format !== 'doubles') return [];
        for (let s = 0; s < player.activePokemon.length; s++) {
          if (s === action.slot) continue;
          const idx = player.activePokemon[s];
          const poke = player.team[idx];
          if (poke && !poke.isFainted) {
            return [{ pokemon: poke, position: { player: action.player, slot: s } }];
          }
        }
        return [];
      }

      default:
        return [];
    }
  }

  private executeItem(
    action: Extract<TurnAction, { type: 'item' }>,
    state: BattleState,
  ): void {
    const player = state.players[action.player];
    const pokemon = player.team[action.targetTeamIndex];
    if (!pokemon) return;

    const item = getItem(action.itemId);
    const targetPos: BattlePosition = { player: action.player, slot: pokemon.slotIndex };

    this.eventBus.emit({
      kind: 'item-used', turn: state.turn,
      player: action.player, itemId: item.id, itemName: item.name,
      target: targetPos,
    });

    switch (item.effect.type) {
      case 'heal-hp': {
        const amount = item.effect.value ?? 20;
        const healed = applyHeal(pokemon, amount);
        if (healed > 0) {
          this.eventBus.emit({
            kind: 'heal', turn: state.turn, target: targetPos,
            amount: healed, currentHp: pokemon.currentHp, maxHp: pokemon.maxHp,
            source: 'item',
          });
        }
        // Full Restore also cures status
        if (item.id === 'full-restore' && pokemon.status) {
          const cured = cureStatus(pokemon);
          if (cured) {
            this.eventBus.emit({
              kind: 'status-cured', turn: state.turn, target: targetPos,
              status: cured, pokemonName: getPokemonName(pokemon),
              source: 'item',
            });
          }
        }
        break;
      }
      case 'cure-status': {
        if (pokemon.status) {
          // Specific status cure or any status
          if (!item.effect.status || pokemon.status === item.effect.status) {
            const cured = cureStatus(pokemon);
            if (cured) {
              this.eventBus.emit({
                kind: 'status-cured', turn: state.turn, target: targetPos,
                status: cured, pokemonName: getPokemonName(pokemon),
                source: 'item',
              });
            }
          }
        }
        break;
      }
    }
  }

  private executeRun(
    action: Extract<TurnAction, { type: 'run' }>,
    state: BattleState,
  ): void {
    if (state.config.battleType !== 'wild') {
      this.eventBus.emit({ kind: 'fail', turn: state.turn, user: { player: action.player, slot: 0 }, reason: "Can't run from trainer battle!" });
      return;
    }

    // Simple escape calculation
    const success = this.rng.chance(50);
    this.eventBus.emit({
      kind: 'run-attempt', turn: state.turn,
      player: action.player, success,
    });

    if (success) {
      state.isOver = true;
      state.winner = null;
      this.eventBus.emit({
        kind: 'battle-end', turn: state.turn,
        winner: null, reason: 'run',
      });
    }
  }

  private executeCatch(
    action: Extract<TurnAction, { type: 'catch' }>,
    state: BattleState,
  ): void {
    if (state.config.battleType !== 'wild') {
      this.eventBus.emit({ kind: 'fail', turn: state.turn, user: { player: action.player, slot: 0 }, reason: "Can't catch Pokemon in trainer battles!" });
      return;
    }

    // TODO: Implement full catch mechanics (catch rate formula, ball modifiers, etc.)
    // For now, use a simple 50% catch chance
    const success = this.rng.chance(50);

    this.eventBus.emit({
      kind: 'message', turn: state.turn,
      text: success ? 'Gotcha! The wild Pokemon was caught!' : 'Oh no! The Pokemon broke free!',
    });

    if (success) {
      state.isOver = true;
      state.winner = 0; // Player wins by capture
      this.eventBus.emit({
        kind: 'battle-end', turn: state.turn,
        winner: 0, reason: 'catch',
      });
    }
  }

  private getActiveOpponents(state: BattleState, player: PlayerIndex): PokemonBattleState[] {
    const opponentIndex = player === 0 ? 1 : 0;
    const opponent = state.players[opponentIndex];
    return opponent.activePokemon
      .map(idx => opponent.team[idx])
      .filter((p): p is PokemonBattleState => p != null && !p.isFainted);
  }
}
