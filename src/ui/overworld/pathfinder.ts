import { isWalkable, canMoveTo, type MapData } from './map-data';
import type { TileDef } from './tile-registry';

interface Node {
  col: number;
  row: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: Node | null;
}

const DIRS = [
  { dc: 0, dr: -1 }, // up
  { dc: 0, dr: 1 },  // down
  { dc: -1, dr: 0 }, // left
  { dc: 1, dr: 0 },  // right
];

function heuristic(col: number, row: number, goalCol: number, goalRow: number): number {
  return Math.abs(col - goalCol) + Math.abs(row - goalRow);
}

function keyOf(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * A* pathfinding on a 4-directional grid.
 * Returns array of waypoints from start to goal (excluding start), or null if unreachable.
 */
export function findPath(
  map: MapData,
  startCol: number,
  startRow: number,
  goalCol: number,
  goalRow: number,
  tiles: Map<string, TileDef>,
): Array<{ col: number; row: number }> | null {
  if (startCol === goalCol && startRow === goalRow) return [];
  if (!isWalkable(map, goalCol, goalRow, tiles)) return null;

  const open: Node[] = [];
  const closed = new Set<string>();

  const startNode: Node = {
    col: startCol,
    row: startRow,
    g: 0,
    h: heuristic(startCol, startRow, goalCol, goalRow),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);

  const gScores = new Map<string, number>();
  gScores.set(keyOf(startCol, startRow), 0);

  while (open.length > 0) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const currentKey = keyOf(current.col, current.row);

    if (current.col === goalCol && current.row === goalRow) {
      // Reconstruct path
      const path: Array<{ col: number; row: number }> = [];
      let node: Node | null = current;
      while (node && !(node.col === startCol && node.row === startRow)) {
        path.push({ col: node.col, row: node.row });
        node = node.parent;
      }
      path.reverse();
      return path;
    }

    closed.add(currentKey);

    for (const dir of DIRS) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;
      const nKey = keyOf(nc, nr);

      if (closed.has(nKey)) continue;
      if (!canMoveTo(map, current.col, current.row, nc, nr, tiles)) continue;

      const tentG = current.g + 1;
      const prevG = gScores.get(nKey);

      if (prevG !== undefined && tentG >= prevG) continue;

      gScores.set(nKey, tentG);

      const neighbor: Node = {
        col: nc,
        row: nr,
        g: tentG,
        h: heuristic(nc, nr, goalCol, goalRow),
        f: 0,
        parent: current,
      };
      neighbor.f = neighbor.g + neighbor.h;

      // Remove old entry if exists in open
      const existIdx = open.findIndex((n) => n.col === nc && n.row === nr);
      if (existIdx >= 0) open.splice(existIdx, 1);

      open.push(neighbor);
    }
  }

  return null; // unreachable
}
