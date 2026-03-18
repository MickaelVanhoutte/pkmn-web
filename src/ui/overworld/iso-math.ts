/** Tile image dimensions in pixels */
export const TILE_W = 32;
export const TILE_IMG_H = 32;

/**
 * Row/col stepping for isometric projection.
 * Standard 2:1 isometric ratio: half-width 16, half-height 8.
 */
export const TILE_HALF_W = TILE_W / 2; // 16
export const TILE_HALF_H = 7; // vertical step between rows (diamond half-height)

/** Y position of the diamond equator (visual center) within the 32×32 tile image */
export const TILE_ORIGIN_Y = 15;

/** Scale factor for rendering (2 = tiles render at 64×64 on screen) */
export const RENDER_SCALE = 3;

/**
 * Convert grid (col, row) to screen pixel position.
 * Returns the center-top of the tile's diamond face.
 */
export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * TILE_HALF_W,
    y: (col + row) * TILE_HALF_H,
  };
}

/**
 * Convert screen pixel position to grid (col, row).
 * `cameraX/Y` is the camera's world-space offset (top-left of viewport).
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  cameraX: number,
  cameraY: number,
): { col: number; row: number } {
  const worldX = screenX + cameraX;
  const worldY = screenY + cameraY;

  const col = Math.round((worldX / TILE_HALF_W + worldY / TILE_HALF_H) / 2);
  const row = Math.round((worldY / TILE_HALF_H - worldX / TILE_HALF_W) / 2);

  return { col, row };
}
