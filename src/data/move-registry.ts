import type { MoveData } from '../types';
import movesData from '../../data/moves.json';

const moves = new Map<string, MoveData>();

for (const move of movesData as MoveData[]) {
  moves.set(move.id, move);
}

export function getMove(id: string): MoveData {
  const move = moves.get(id);
  if (!move) throw new Error(`Move not found: ${id}`);
  return move;
}

export function getAllMoves(): MoveData[] {
  return [...moves.values()];
}

export function hasMove(id: string): boolean {
  return moves.has(id);
}
