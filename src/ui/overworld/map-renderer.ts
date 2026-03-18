import type { MapData } from './map-data';
import { getTileHeight } from './map-data';
import type { TileDef } from './tile-registry';
import type { Camera } from './camera';
import { gridToScreen, TILE_W, TILE_IMG_H, TILE_HALF_W, TILE_HALF_H, TILE_ORIGIN_Y } from './iso-math';

export interface PlayerDrawInfo {
  screenX: number; // interpolated world-space X
  screenY: number; // interpolated world-space Y
  gridRow: number; // row for z-ordering (max of prev/current during movement)
  gridCol: number; // col for z-ordering within same row (min of prev/current)
}

/** Water tiles that alternate for animation (014 ↔ 021) */
const WATER_ANIM: Record<string, string> = {
  'Tile-014': 'Tile-021',
  'Tile-021': 'Tile-014',
};

/** Cliff face colors per tile type: left (lit) / right (shadow) */
const CLIFF_COLORS: Record<string, { left: string; right: string }> = {
  'Tile-002': { left: '#5a7a3a', right: '#4a6a2a' },
  'Tile-008': { left: '#4a6a2a', right: '#3a5a1a' },
  'Tile-015': { left: '#6a8a4a', right: '#5a7a3a' },
  'Tile-010': { left: '#8a8a7a', right: '#6a6a5a' },
  'Tile-024': { left: '#9a9a8a', right: '#7a7a6a' },
  'Tile-009': { left: '#8a6a3a', right: '#6a5a2a' },
  'Tile-016': { left: '#9a7a4a', right: '#7a6a3a' },
};
const DEFAULT_CLIFF = { left: '#6a6a5a', right: '#5a5a4a' };

export class MapRenderer {
  private animTime = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private map: MapData,
    private tiles: Map<string, TileDef>,
  ) {}

  render(camera: Camera, player: PlayerDrawInfo, hoveredTile: { col: number; row: number } | null, dt: number): void {
    this.animTime += dt;
    const ctx = this.ctx;
    const cw = camera.viewportW;
    const cvh = camera.viewportH;

    ctx.clearRect(0, 0, cw, cvh);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, cvh);

    const { map, tiles } = this;

    const isPlayerRow = (row: number) => row === player.gridRow;

    // Draw in back-to-front order: row by row
    for (let row = 0; row < map.height; row++) {
      // Water animation: swap every 0.6s
      const waterFrame = Math.floor(this.animTime / 0.6) % 2 === 1;

      // On the player's row, split base tile drawing around the player's column.
      // In isometric, higher col = visually in front, so tiles at col > playerCol
      // must be drawn AFTER the player to correctly occlude them.
      const playerOnRow = isPlayerRow(row);
      const splitCol = player.gridCol;

      // Pass 1: base tiles for this row (up to player col if player is on this row)
      const colEnd = playerOnRow ? splitCol + 1 : map.width;
      for (let col = 0; col < colEnd && col < map.width; col++) {
        this.drawBaseTile(ctx, camera, row, col, waterFrame, cw, cvh);
      }

      if (playerOnRow) {
        // Draw hover highlight before player if it's behind the player
        if (hoveredTile && hoveredTile.row === row && hoveredTile.col <= splitCol) {
          const hHeight = getTileHeight(this.map, hoveredTile.col, hoveredTile.row);
          this.drawTileHighlight(camera, hoveredTile.col, hoveredTile.row, hHeight);
        }

        // Draw player
        this.drawPlayer(camera, player);

        // Draw remaining base tiles (in front of player)
        for (let col = splitCol + 1; col < map.width; col++) {
          this.drawBaseTile(ctx, camera, row, col, waterFrame, cw, cvh);
        }

        // Draw hover highlight after player if it's in front
        if (hoveredTile && hoveredTile.row === row && hoveredTile.col > splitCol) {
          const hHeight = getTileHeight(this.map, hoveredTile.col, hoveredTile.row);
          this.drawTileHighlight(camera, hoveredTile.col, hoveredTile.row, hHeight);
        }
      } else {
        // Draw hover highlight if it's on this row
        if (hoveredTile && hoveredTile.row === row) {
          const hHeight = getTileHeight(this.map, hoveredTile.col, hoveredTile.row);
          this.drawTileHighlight(camera, hoveredTile.col, hoveredTile.row, hHeight);
        }
      }

      // Pass 2: decorations for this row (on top of player)
      for (let col = 0; col < map.width; col++) {
        const cell = map.tiles[row][col];
        if (!cell.decoration) continue;
        const decDef = tiles.get(cell.decoration);
        if (!decDef) continue;

        const height = cell.height ?? 0;
        const elevOffset = height * TILE_HALF_H;
        const screen = gridToScreen(col, row);
        const dx = screen.x - camera.x - TILE_HALF_W;
        // Anchor decoration at its foot (ground contact) so it sits on the tile center
        const anchorY = decDef.footY ?? TILE_ORIGIN_Y;
        const dy = screen.y - camera.y - anchorY - elevOffset;

        if (dx + TILE_W < 0 || dx > cw || dy + TILE_IMG_H < 0 || dy > cvh) continue;

        ctx.drawImage(decDef.image, dx, dy, TILE_W, TILE_IMG_H);
      }
    }
  }

  private drawBaseTile(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    row: number,
    col: number,
    waterFrame: boolean,
    cw: number,
    cvh: number,
  ): void {
    const cell = this.map.tiles[row][col];
    const height = cell.height ?? 0;
    let tileId = cell.base;
    if (waterFrame && WATER_ANIM[tileId]) {
      tileId = WATER_ANIM[tileId];
    }
    const tileDef = this.tiles.get(tileId);
    if (!tileDef) return;

    const screen = gridToScreen(col, row);
    const sx = screen.x - camera.x;
    const sy = screen.y - camera.y;
    const elevOffset = height * TILE_HALF_H;

    const dx = sx - TILE_HALF_W;
    const dy = sy - TILE_ORIGIN_Y - elevOffset;

    // Viewport culling (expanded for cliff faces)
    if (dx + TILE_W < 0 || dx > cw || dy + TILE_IMG_H + elevOffset < 0 || dy > cvh) return;

    // Draw cliff faces if elevated
    if (height > 0) {
      this.drawCliffFaces(ctx, sx, sy, elevOffset, cell.base);
    }

    ctx.drawImage(tileDef.image, dx, dy, TILE_W, TILE_IMG_H);
  }

  private drawCliffFaces(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    elevOffset: number,
    baseTileId: string,
  ): void {
    const colors = CLIFF_COLORS[baseTileId] ?? DEFAULT_CLIFF;

    // Left face parallelogram
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(sx - TILE_HALF_W, sy - elevOffset);       // elevated left
    ctx.lineTo(sx, sy + TILE_HALF_H - elevOffset);        // elevated bottom
    ctx.lineTo(sx, sy + TILE_HALF_H);                     // ground bottom
    ctx.lineTo(sx - TILE_HALF_W, sy);                     // ground left
    ctx.closePath();
    ctx.fill();

    // Right face parallelogram
    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(sx, sy + TILE_HALF_H - elevOffset);        // elevated bottom
    ctx.lineTo(sx + TILE_HALF_W, sy - elevOffset);        // elevated right
    ctx.lineTo(sx + TILE_HALF_W, sy);                     // ground right
    ctx.lineTo(sx, sy + TILE_HALF_H);                     // ground bottom
    ctx.closePath();
    ctx.fill();
  }

  private drawPlayer(camera: Camera, player: PlayerDrawInfo): void {
    const ctx = this.ctx;
    const px = player.screenX - camera.x;
    const py = player.screenY - camera.y;

    // Draw a diamond-shaped player marker centered on tile surface
    const hw = TILE_HALF_W * 0.45;
    const hh = TILE_HALF_H * 0.45;

    // Shadow on the tile surface
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py, hw, hh * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Diamond body (raised above the surface for 3D feel)
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(px, py - hh - 6); // top
    ctx.lineTo(px + hw, py - 3); // right
    ctx.lineTo(px, py + hh - 3); // bottom
    ctx.lineTo(px - hw, py - 3); // left
    ctx.closePath();
    ctx.fill();

    // Diamond highlight (top half for shine)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(px, py - hh - 6);
    ctx.lineTo(px + hw, py - 3);
    ctx.lineTo(px, py - 2);
    ctx.lineTo(px - hw, py - 3);
    ctx.closePath();
    ctx.fill();
  }

  private drawTileHighlight(camera: Camera, col: number, row: number, height: number = 0): void {
    const ctx = this.ctx;
    const screen = gridToScreen(col, row);
    const sx = screen.x - camera.x;
    const sy = screen.y - camera.y - height * TILE_HALF_H;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(sx, sy - TILE_HALF_H); // top
    ctx.lineTo(sx + TILE_HALF_W, sy); // right
    ctx.lineTo(sx, sy + TILE_HALF_H); // bottom
    ctx.lineTo(sx - TILE_HALF_W, sy); // left
    ctx.closePath();
    ctx.fill();
  }
}
