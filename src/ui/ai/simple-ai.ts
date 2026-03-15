import type { BattleEngine } from '@/engine/battle-engine';
import type { TurnAction } from '@/types/battle';
import type { PlayerIndex, TypeName, BattlePosition } from '@/types/common';
import type { MoveTarget } from '@/types/move';
import { getTypeEffectiveness } from '@/data/type-chart';
import { getMove } from '@/data/move-registry';
import { needsTargetSelection } from '@/engine/action-validator';

/**
 * Simple AI that picks the best available action for each active slot.
 *
 * Scoring logic:
 *  - Evaluate each move by base power * type effectiveness vs the opponent.
 *  - STAB bonus: 1.5x if the move type matches one of the user's types.
 *  - Status moves are scored at a flat low value (they have power=null/0).
 *  - If the best move has a positive score, use it.
 *  - If no damaging move is available, consider switching to a teammate whose
 *    STAB types are super-effective against the opponent.
 *  - Fallback: use the first available move.
 */
export function chooseAIActions(engine: BattleEngine, player: PlayerIndex): TurnAction[] {
  const availableActions = engine.getAvailableActions(player);
  const opponentIndex: PlayerIndex = player === 0 ? 1 : 0;
  const format = engine.getState().config.format;
  const slotsPerSide = format === 'doubles' ? 2 : 1;
  const actions: TurnAction[] = [];

  for (const slotInfo of availableActions) {
    const { slot, canMove, canSwitch } = slotInfo;

    // Gather opponent active pokemon types and their slot indices
    const opponentTypes: TypeName[][] = [];
    const opponentSlots: number[] = [];
    for (let s = 0; s < slotsPerSide; s++) {
      const oppMon = engine.getActivePokemon(opponentIndex, s);
      if (oppMon && !oppMon.isFainted) {
        opponentTypes.push(oppMon.species.types as TypeName[]);
        opponentSlots.push(s);
      }
    }

    // Get the AI's own pokemon types for STAB calculation
    const aiMon = engine.getActivePokemon(player, slot);
    const aiTypes: TypeName[] = aiMon ? (aiMon.species.types as TypeName[]) : [];

    // Score each available move, tracking best target per move
    let bestMoveIndex = -1;
    let bestScore = -1;
    let bestTarget: BattlePosition | undefined;

    for (const move of canMove) {
      const moveData = getMove(move.moveId);
      const basePower = moveData.power ?? 0;
      const moveTarget = move.moveTarget as MoveTarget;

      if (basePower === 0) {
        // Status move: assign a small score so it can be a fallback
        const statusScore = 5;
        if (statusScore > bestScore) {
          bestScore = statusScore;
          bestMoveIndex = move.moveIndex;
          bestTarget = undefined;
        }
        continue;
      }

      // Calculate effectiveness against each opponent and pick the best target
      let moveScore = 0;
      let moveTarget_: BattlePosition | undefined;

      for (let oi = 0; oi < opponentTypes.length; oi++) {
        const defTypes = opponentTypes[oi];
        const effectiveness = getTypeEffectiveness(moveData.type, defTypes);
        let score = basePower * effectiveness;

        // STAB bonus
        if (aiTypes.includes(moveData.type)) {
          score *= 1.5;
        }

        if (score > moveScore) {
          moveScore = score;
          // Track which opponent slot scored highest for single-target moves
          if (needsTargetSelection(moveTarget, format)) {
            moveTarget_ = { player: opponentIndex, slot: opponentSlots[oi] };
          }
        }
      }

      // If no opponent is active (shouldn't happen normally), just use base power
      if (opponentTypes.length === 0) {
        moveScore = basePower;
      }

      if (moveScore > bestScore) {
        bestScore = moveScore;
        bestMoveIndex = move.moveIndex;
        bestTarget = moveTarget_;
      }
    }

    // If best move has a reasonable score, use it
    if (bestMoveIndex >= 0 && bestScore > 0) {
      const action: TurnAction = {
        type: 'move',
        player,
        slot,
        moveIndex: bestMoveIndex,
      };

      if (bestTarget) {
        action.targetPosition = bestTarget;
      }

      actions.push(action);
      continue;
    }

    // No good moves -- consider switching
    if (canSwitch.length > 0) {
      // Pick the first available switch target whose types are SE against an opponent
      let bestSwitchIdx = canSwitch[0].teamIndex;
      let bestSwitchScore = 0;

      for (const sw of canSwitch) {
        // Look at the species types via the player state
        const playerState = engine.getPlayer(player);
        const candidate = playerState.team[sw.teamIndex];
        if (!candidate) continue;
        const candidateTypes = candidate.species.types as TypeName[];

        let switchScore = 0;
        for (const defTypes of opponentTypes) {
          for (const cType of candidateTypes) {
            const eff = getTypeEffectiveness(cType, defTypes);
            if (eff > switchScore) {
              switchScore = eff;
            }
          }
        }

        if (switchScore > bestSwitchScore) {
          bestSwitchScore = switchScore;
          bestSwitchIdx = sw.teamIndex;
        }
      }

      actions.push({
        type: 'switch',
        player,
        slot,
        switchToIndex: bestSwitchIdx,
      });
      continue;
    }

    // Absolute fallback: use first available move (e.g. Struggle scenario)
    if (canMove.length > 0) {
      const fallbackMove = canMove[0];
      const action: TurnAction = {
        type: 'move',
        player,
        slot,
        moveIndex: fallbackMove.moveIndex,
      };

      if (format === 'doubles' && needsTargetSelection(fallbackMove.moveTarget as MoveTarget, format)) {
        // Target first active opponent
        if (opponentSlots.length > 0) {
          action.targetPosition = { player: opponentIndex, slot: opponentSlots[0] };
        }
      }

      actions.push(action);
    }
  }

  return actions;
}
