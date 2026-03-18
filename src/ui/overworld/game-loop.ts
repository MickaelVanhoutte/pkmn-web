export class GameLoop {
  private running = false;
  private rafId = 0;
  private lastTime = 0;

  constructor(private onTick: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
      this.lastTime = now;
      this.onTick(dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
