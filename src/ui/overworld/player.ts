import { gridToScreen, TILE_HALF_H } from './iso-math';
import { canMoveTo, getTileHeight, type MapData } from './map-data';
import type { TileDef } from './tile-registry';

export type Direction = 'down' | 'left' | 'right' | 'up';

export interface PlayerState {
  /** Current snapped grid position */
  col: number;
  row: number;

  /** Previous grid position (for interpolation) */
  prevCol: number;
  prevRow: number;

  /** 0 = at prevPos, 1 = at current pos */
  moveProgress: number;
  isMoving: boolean;

  /** Queued path from A* (excluding current position) */
  path: Array<{ col: number; row: number }>;

  /** Tiles per second */
  moveSpeed: number;

  /** Current facing direction */
  direction: Direction;
}

export function createPlayer(col: number, row: number): PlayerState {
  return {
    col,
    row,
    prevCol: col,
    prevRow: row,
    moveProgress: 1,
    isMoving: false,
    path: [],
    moveSpeed: 5,
    direction: 'down',
  };
}

function directionFromDelta(dcol: number, drow: number): Direction {
  if (drow < 0) return 'up';
  if (drow > 0) return 'down';
  if (dcol < 0) return 'left';
  return 'right';
}

export function updatePlayer(player: PlayerState, dt: number): void {
  if (!player.isMoving) return;

  player.moveProgress += dt * player.moveSpeed;

  if (player.moveProgress >= 1) {
    player.moveProgress = 1;

    // Arrived at current target — check for next waypoint
    if (player.path.length > 0) {
      const next = player.path.shift()!;
      player.direction = directionFromDelta(next.col - player.col, next.row - player.row);
      player.prevCol = player.col;
      player.prevRow = player.row;
      player.col = next.col;
      player.row = next.row;
      player.moveProgress = 0;
    } else {
      player.isMoving = false;
    }
  }
}

/** Try to move the player one step in a direction. Returns true if successful. */
export function movePlayerStep(
  player: PlayerState,
  dcol: number,
  drow: number,
  map: MapData,
  tiles: Map<string, TileDef>,
): boolean {
  // If currently mid-step, ignore
  if (player.isMoving && player.moveProgress < 1) return false;

  const newCol = player.col + dcol;
  const newRow = player.row + drow;

  if (!canMoveTo(map, player.col, player.row, newCol, newRow, tiles)) return false;

  player.direction = directionFromDelta(dcol, drow);
  player.prevCol = player.col;
  player.prevRow = player.row;
  player.col = newCol;
  player.row = newRow;
  player.moveProgress = 0;
  player.isMoving = true;
  player.path = [];
  return true;
}

/** Set a path for the player to follow (from pathfinder). */
export function setPlayerPath(
  player: PlayerState,
  path: Array<{ col: number; row: number }>,
): void {
  if (path.length === 0) return;

  // If mid-step, let current step finish, then start new path
  if (player.isMoving && player.moveProgress < 1) {
    player.path = path;
    return;
  }

  const first = path.shift()!;
  player.direction = directionFromDelta(first.col - player.col, first.row - player.row);
  player.prevCol = player.col;
  player.prevRow = player.row;
  player.col = first.col;
  player.row = first.row;
  player.moveProgress = 0;
  player.isMoving = true;
  player.path = path;
}

/** Get the interpolated world-space position of the player (elevation-aware). */
export function getPlayerScreenPos(player: PlayerState, map: MapData): { x: number; y: number } {
  const prev = gridToScreen(player.prevCol, player.prevRow);
  const curr = gridToScreen(player.col, player.row);
  const t = player.moveProgress;

  const prevH = getTileHeight(map, player.prevCol, player.prevRow);
  const currH = getTileHeight(map, player.col, player.row);
  const interpH = prevH + (currH - prevH) * t;

  return {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t - interpH * TILE_HALF_H,
  };
}
