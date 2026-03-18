import { screenToGrid } from './iso-math';
import type { Camera } from './camera';

export type Direction = 'up' | 'down' | 'left' | 'right';

export class InputHandler {
  private keyListener: (e: KeyboardEvent) => void;
  private clickListener: (e: MouseEvent) => void;
  private moveListener: (e: MouseEvent) => void;
  private heldKeys = new Set<string>();
  private keyUpListener: (e: KeyboardEvent) => void;

  /** Last hovered tile for highlight */
  hoveredTile: { col: number; row: number } | null = null;

  /** Queued direction from arrow key (consumed each frame) */
  queuedDirection: Direction | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private onTileClick: (col: number, row: number) => void,
  ) {
    this.keyListener = (e: KeyboardEvent) => {
      const dir = this.arrowToDir(e.key);
      if (dir) {
        e.preventDefault();
        this.heldKeys.add(e.key);
        this.queuedDirection = dir;
      }
    };

    this.keyUpListener = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.key);
    };

    this.clickListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = camera.viewportW / rect.width;
      const scaleY = camera.viewportH / rect.height;
      const sx = (e.clientX - rect.left) * scaleX;
      const sy = (e.clientY - rect.top) * scaleY;
      const grid = screenToGrid(sx, sy, camera.x, camera.y);
      this.onTileClick(grid.col, grid.row);
    };

    this.moveListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = camera.viewportW / rect.width;
      const scaleY = camera.viewportH / rect.height;
      const sx = (e.clientX - rect.left) * scaleX;
      const sy = (e.clientY - rect.top) * scaleY;
      const grid = screenToGrid(sx, sy, camera.x, camera.y);
      this.hoveredTile = grid;
    };

    document.addEventListener('keydown', this.keyListener);
    document.addEventListener('keyup', this.keyUpListener);
    canvas.addEventListener('click', this.clickListener);
    canvas.addEventListener('mousemove', this.moveListener);
    canvas.addEventListener('mouseleave', () => {
      this.hoveredTile = null;
    });
  }

  /** Check if an arrow key is currently held. Returns the direction or null. */
  getHeldDirection(): Direction | null {
    for (const key of this.heldKeys) {
      const dir = this.arrowToDir(key);
      if (dir) return dir;
    }
    return null;
  }

  private arrowToDir(key: string): Direction | null {
    switch (key) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      default: return null;
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keyListener);
    document.removeEventListener('keyup', this.keyUpListener);
    this.canvas.removeEventListener('click', this.clickListener);
    this.canvas.removeEventListener('mousemove', this.moveListener);
  }
}
