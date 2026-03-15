import type { MoveAnimationDef } from '../types';
import { physicalMoves } from './physical-moves';
import { specialMoves } from './special-moves';
import { statusMoves } from './status-moves';

const registry = new Map<string, MoveAnimationDef>();

function register(defs: MoveAnimationDef[]): void {
  for (const def of defs) {
    registry.set(def.moveId, def);
  }
}

register(physicalMoves);
register(specialMoves);
register(statusMoves);

export function getMoveAnimation(moveId: string): MoveAnimationDef | undefined {
  return registry.get(moveId);
}

export function getChargeAnimation(moveId: string): MoveAnimationDef | undefined {
  // Charge animations use a special ID suffix
  return registry.get(`${moveId}-charge`);
}

export function getAllMoveAnimationIds(): string[] {
  return [...registry.keys()];
}
