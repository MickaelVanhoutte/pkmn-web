import type { TurnAction, PlayerIndex } from '../types';
import type { BattleState, PlayerState } from '../types/battle';
import { getItem } from '../data/item-registry';
import { getMove } from '../data/move-registry';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateActions(
  player: PlayerIndex,
  actions: TurnAction[],
  state: BattleState,
): ValidationResult {
  const errors: string[] = [];
  const playerState = state.players[player];
  const expectedCount = playerState.activePokemon.filter(idx => {
    const poke = playerState.team[idx];
    return poke && !poke.isFainted;
  }).length;

  if (actions.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} actions, got ${actions.length}`);
    return { valid: false, errors };
  }

  // Track used slots and switch targets for duplicate detection (doubles)
  const usedSlots = new Set<number>();
  const switchTargets = new Set<number>();

  for (const action of actions) {
    if (action.player !== player) {
      errors.push('Action player mismatch');
      continue;
    }

    switch (action.type) {
      case 'move': {
        // Duplicate slot check
        if (usedSlots.has(action.slot)) {
          errors.push(`Duplicate action for slot ${action.slot}`);
          break;
        }
        usedSlots.add(action.slot);

        if (action.slot < 0 || action.slot >= playerState.activePokemon.length) {
          errors.push(`Invalid slot ${action.slot}`);
          break;
        }
        const activeIdx = playerState.activePokemon[action.slot];
        const pokemon = playerState.team[activeIdx];
        if (!pokemon || pokemon.isFainted) {
          errors.push(`No active pokemon in slot ${action.slot}`);
          break;
        }
        if (action.moveIndex < 0 || action.moveIndex >= pokemon.moves.length) {
          errors.push(`Invalid move index ${action.moveIndex}`);
          break;
        }
        const move = pokemon.moves[action.moveIndex];
        if (move.currentPp <= 0) {
          errors.push(`Move ${move.moveId} has no PP`);
        }
        if (move.disabled) {
          errors.push(`Move ${move.moveId} is disabled`);
        }
        // Choice lock: must use the locked move
        if (pokemon.choiceLocked && move.moveId !== pokemon.choiceLocked) {
          // Only enforce if the locked move has PP
          const lockedMove = pokemon.moves.find(m => m.moveId === pokemon.choiceLocked);
          if (lockedMove && lockedMove.currentPp > 0) {
            errors.push(`Choice locked to ${pokemon.choiceLocked}`);
          }
        }
        // Charge move: must use the charged move
        if (pokemon.chargeMoveId) {
          const chargedIdx = pokemon.moves.findIndex(m => m.moveId === pokemon.chargeMoveId);
          if (chargedIdx >= 0 && action.moveIndex !== chargedIdx) {
            errors.push(`Must use charged move ${pokemon.chargeMoveId}`);
          }
        }
        break;
      }

      case 'switch': {
        // Duplicate slot check
        if (usedSlots.has(action.slot)) {
          errors.push(`Duplicate action for slot ${action.slot}`);
          break;
        }
        usedSlots.add(action.slot);

        if (action.switchToIndex < 0 || action.switchToIndex >= playerState.team.length) {
          errors.push(`Invalid switch target index ${action.switchToIndex}`);
          break;
        }
        const switchTarget = playerState.team[action.switchToIndex];
        if (!switchTarget) {
          errors.push(`Invalid switch target index ${action.switchToIndex}`);
          break;
        }
        if (switchTarget.isFainted) {
          errors.push('Cannot switch to fainted pokemon');
        }
        if (switchTarget.isActive) {
          errors.push('Cannot switch to already active pokemon');
        }
        // Duplicate switch target check (two slots switching to same pokemon)
        if (switchTargets.has(action.switchToIndex)) {
          errors.push(`Two actions cannot switch to the same pokemon (index ${action.switchToIndex})`);
        }
        switchTargets.add(action.switchToIndex);
        break;
      }

      case 'item': {
        // Validate item exists
        try {
          getItem(action.itemId);
        } catch {
          errors.push(`Unknown item: ${action.itemId}`);
          break;
        }
        // Validate target team index is in bounds
        if (action.targetTeamIndex < 0 || action.targetTeamIndex >= playerState.team.length) {
          errors.push(`Invalid item target index ${action.targetTeamIndex}`);
          break;
        }
        const itemTarget = playerState.team[action.targetTeamIndex];
        if (!itemTarget) {
          errors.push(`Invalid item target index ${action.targetTeamIndex}`);
          break;
        }
        if (itemTarget.isFainted) {
          errors.push('Cannot use item on fainted pokemon');
        }
        break;
      }

      case 'run':
        if (!state.config.isWildBattle) {
          errors.push('Cannot run from trainer battles');
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getValidMoveTargets(
  slot: number,
  moveIndex: number,
  playerState: PlayerState,
  opponentState: PlayerState,
  format: string,
): { player: PlayerIndex; slot: number }[] {
  // In singles, target is always the opponent's slot 0
  if (format === 'singles') {
    return [{ player: opponentState.index, slot: 0 }];
  }

  // In doubles, get the move to determine valid targets
  const activeIdx = playerState.activePokemon[slot];
  const pokemon = playerState.team[activeIdx];
  if (!pokemon) return [];

  const moveState = pokemon.moves[moveIndex];
  if (!moveState) return [];

  const moveData = getMove(moveState.moveId);
  const targets: { player: PlayerIndex; slot: number }[] = [];

  switch (moveData.target) {
    case 'self':
      targets.push({ player: playerState.index, slot });
      break;

    case 'adjacent-foe':
      for (let i = 0; i < opponentState.activePokemon.length; i++) {
        const idx = opponentState.activePokemon[i];
        if (idx >= 0 && opponentState.team[idx] && !opponentState.team[idx].isFainted) {
          targets.push({ player: opponentState.index, slot: i });
        }
      }
      break;

    case 'all-adjacent-foes':
    case 'all-adjacent':
    case 'all-field':
    case 'foe-side':
    case 'ally-side':
      // These don't require target selection — auto-targeted
      targets.push({ player: opponentState.index, slot: 0 });
      break;

    case 'adjacent-ally':
      for (let i = 0; i < playerState.activePokemon.length; i++) {
        if (i === slot) continue;
        const idx = playerState.activePokemon[i];
        if (idx >= 0 && playerState.team[idx] && !playerState.team[idx].isFainted) {
          targets.push({ player: playerState.index, slot: i });
        }
      }
      break;

    default:
      // Fallback: all opponents
      for (let i = 0; i < opponentState.activePokemon.length; i++) {
        const idx = opponentState.activePokemon[i];
        if (idx >= 0 && opponentState.team[idx] && !opponentState.team[idx].isFainted) {
          targets.push({ player: opponentState.index, slot: i });
        }
      }
  }

  return targets;
}
