export class CanvasOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;
  private arena: HTMLElement;
  private _width = 0;
  private _height = 0;

  constructor(arena: HTMLElement) {
    this.arena = arena;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'animation-canvas';
    this.ctx = this.canvas.getContext('2d')!;

    arena.appendChild(this.canvas);
    this.syncSize();

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(arena);
  }

  private syncSize(): void {
    const rect = this.arena.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this._width = rect.width;
    this._height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Pixelated rendering for sprite-based FX
    this.ctx.imageSmoothingEnabled = false;
  }

  getCtx(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this._width, this._height);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }
}
