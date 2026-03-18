export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  private lerpSpeed = 8; // higher = snappier

  constructor(
    public viewportW: number,
    public viewportH: number,
  ) {}

  /** Set the target so that `(worldX, worldY)` will be centered on screen. */
  follow(worldX: number, worldY: number): void {
    this.targetX = worldX - this.viewportW / 2;
    this.targetY = worldY - this.viewportH / 2;
  }

  /** Snap camera to target immediately (no lerp). */
  snapToTarget(): void {
    this.x = this.targetX;
    this.y = this.targetY;
  }

  /** Smoothly move camera toward target. */
  update(dt: number): void {
    const factor = 1 - Math.exp(-this.lerpSpeed * dt);
    this.x += (this.targetX - this.x) * factor;
    this.y += (this.targetY - this.y) * factor;
  }

  /** Update viewport dimensions (on resize). */
  resize(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
  }
}
