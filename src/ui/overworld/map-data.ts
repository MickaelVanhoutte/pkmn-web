import type { TileDef } from './tile-registry';

export interface TileCell {
  base: string;
  decoration?: string;
  height?: number; // 0-3, elevation level (default 0)
}

export interface MapData {
  width: number;
  height: number;
  tiles: TileCell[][];
  playerStart: { col: number; row: number };
}

export function isWalkable(
  map: MapData,
  col: number,
  row: number,
  tiles: Map<string, TileDef>,
): boolean {
  if (col < 0 || row < 0 || col >= map.width || row >= map.height) return false;
  const cell = map.tiles[row][col];
  const baseDef = tiles.get(cell.base);
  if (!baseDef || !baseDef.walkable) return false;
  if (cell.decoration) return false;
  return true;
}

export function getTileHeight(map: MapData, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= map.width || row >= map.height) return 0;
  return map.tiles[row][col].height ?? 0;
}

export function canMoveTo(
  map: MapData,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  tiles: Map<string, TileDef>,
): boolean {
  if (!isWalkable(map, toCol, toRow, tiles)) return false;
  const fromH = getTileHeight(map, fromCol, fromRow);
  const toH = getTileHeight(map, toCol, toRow);
  return Math.abs(fromH - toH) <= 1;
}

// ── Shorthand aliases ──────────────────────────────────────────

// Walkable base tiles
const G1 = 'tile_027'; // grass (green)
const G2 = 'tile_028'; // grass (green variant)
const G3 = 'tile_037'; // grass (bright green)
const G4 = 'tile_040'; // grass (dark green)
const E1 = 'tile_000'; // earth (dark)
const E2 = 'tile_005'; // earth (medium)
const D1 = 'tile_014'; // dirt
const D2 = 'tile_015'; // dirt (striped)
const S1 = 'tile_010'; // stone path
const S2 = 'tile_011'; // stone (rocky)
const P1 = 'tile_025'; // plain stone path
const P2 = 'tile_026'; // dirt-grass transition
const FL = 'tile_020'; // flowered earth

// Water (non-walkable base)
const W1 = 'tile_090'; // deep water
const W2 = 'tile_095'; // deep water (anim pair)
const W3 = 'tile_105'; // shallow water
const W4 = 'tile_110'; // light water

// Decorations
const BUSH = 'tile_030'; // bush (sways)
const BSH2 = 'tile_033'; // smaller bush (sways)
const TREE = 'tile_045'; // tree top (sways)
const ROCK = 'tile_050'; // boulder
const RCK2 = 'tile_055'; // small rock
const FLOW = 'tile_041'; // flower cluster
const FLW2 = 'tile_046'; // small flowers
const LOG  = 'tile_048'; // log
const STMP = 'tile_049'; // stump

function c(base: string, decoration?: string): TileCell {
  return decoration ? { base, decoration } : { base };
}

function ch(base: string, height: number): TileCell {
  return { base, height };
}

/**
 * 16×16 test map.
 * - Grass meadow with scattered decorations
 * - Stone/dirt path running through center (cross-shaped)
 * - Water pond in the bottom-right
 * - Elevated terrain in the upper-right
 */
export const TEST_MAP: MapData = {
  width: 16,
  height: 16,
  playerStart: { col: 7, row: 7 },
  tiles: [
    // Row 0 (top)
    [c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1,TREE), c(G2), c(G1), c(G3), c(G1), c(G2)],
    // Row 1
    [c(G3), c(G1), c(G1,BUSH), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), ch(E1,1), ch(E2,1), c(G1), c(G2), c(G1)],
    // Row 2
    [c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(S1), c(G2), c(G1), ch(E2,1), ch(S1,2), ch(S2,2), ch(E1,1), c(G3), c(G1)],
    // Row 3
    [c(G2), c(G1), c(G3), c(G1,FLOW), c(G2), c(G1), c(G3), c(S2), c(G1), ch(E1,1), ch(S2,2), ch(S1,3), ch(S2,2), ch(E2,1), c(G1), c(G2)],
    // Row 4
    [c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(S1), c(G3), ch(E2,1), ch(S1,2), ch(S2,2), ch(S1,2), ch(E1,1), c(G2), c(G1)],
    // Row 5
    [c(G3), c(G1), c(G2), c(G1), c(G3), c(G1,BSH2), c(G2), c(S2), c(G1), c(G2), ch(E1,1), ch(E2,1), ch(E1,1), c(G3), c(G1), c(G3)],
    // Row 6
    [c(G1), c(G1,TREE), c(G1), c(G3), c(G1), c(G2), c(G1), c(S1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1)],
    // Row 7 (player start — path runs horizontally)
    [c(G2), c(G1), c(S2), c(S1), c(S2), c(S1), c(S2), c(S1), c(S2), c(S1), c(S2), c(S1), c(G1), c(G2), c(G1), c(G3)],
    // Row 8
    [c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(S2), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(G2)],
    // Row 9
    [c(G3), c(G1), c(G1,ROCK), c(G1), c(G3), c(G1), c(G2), c(S1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1)],
    // Row 10
    [c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(S2), c(G1), c(G2), c(P2), c(D1), c(D2), c(G2), c(G1), c(G3)],
    // Row 11
    [c(G2), c(G1), c(G3), c(G1), c(G2), c(G1,FLW2), c(G3), c(S1), c(G2), c(D1), c(D2), c(W3), c(W4), c(D1), c(G3), c(G1)],
    // Row 12
    [c(G1), c(G3), c(G1,LOG), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(D2), c(W3), c(W1), c(W2), c(W3), c(D2), c(G2)],
    // Row 13
    [c(G3), c(G1,TREE), c(G2), c(G1), c(G2), c(G3), c(G1), c(G2), c(G1), c(D1), c(W4), c(W2), c(W1), c(W4), c(D1), c(G1)],
    // Row 14
    [c(G1), c(G2), c(G1), c(G3), c(G1,RCK2), c(G1), c(G2), c(G1), c(G3), c(G2), c(D2), c(W3), c(W3), c(D2), c(G2), c(G3)],
    // Row 15 (bottom)
    [c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(G1), c(G2), c(G1), c(G3), c(D1), c(D2), c(G1), c(G1), c(G1)],
  ],
};
