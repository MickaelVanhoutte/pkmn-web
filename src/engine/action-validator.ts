import type { TurnAction, PlayerIndex } from '../types';
import type { BattleState, PlayerState } from '../types/battle';

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

  for (const action of actions) {
    if (action.player !== player) {
      errors.push('Action player mismatch');
      continue;
    }

    switch (action.type) {
      case 'move': {
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
        break;
      }

      case 'item':
        // Basic validation - item usage allowed
        break;

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

  // In doubles, depends on move target type - simplified for now
  const targets: { player: PlayerIndex; slot: number }[] = [];
  for (let i = 0; i < opponentState.activePokemon.length; i++) {
    const idx = opponentState.activePokemon[i];
    if (idx >= 0 && opponentState.team[idx] && !opponentState.team[idx].isFainted) {
      targets.push({ player: opponentState.index, slot: i });
    }
  }
  return targets;
}
