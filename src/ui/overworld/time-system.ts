/**
 * Simulated day/night clock for ambient lighting.
 * 1 real minute = 1 game hour by default (full cycle in 24 minutes).
 */
export class TimeSystem {
  /** Normalized time: 0.0 = midnight, 0.5 = noon, 1.0 = midnight */
  private timeNorm = 0.35; // start mid-morning

  /** Game hours per real second */
  private speed = 1 / 60; // 1 hour per 60 real seconds

  /** When true, time progression is paused (debug scrubbing) */
  private paused = false;

  update(dt: number): void {
    if (this.paused) return;
    this.timeNorm = (this.timeNorm + (this.speed * dt) / 24) % 1;
  }

  getTimeNorm(): number {
    return this.timeNorm;
  }

  /** Set normalized time directly (0–1). Used by debug controls. */
  setTimeNorm(t: number): void {
    this.timeNorm = ((t % 1) + 1) % 1;
  }

  setSpeed(hoursPerSecond: number): void {
    this.speed = hoursPerSecond;
  }

  getSpeed(): number {
    return this.speed;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Returns true during night hours (roughly 8pm-5am) */
  isNight(): boolean {
    return this.timeNorm > 0.83 || this.timeNorm < 0.21;
  }

  /**
   * Get the ambient overlay alpha (0 = full brightness, 0.85 = deep night).
   */
  getAmbientAlpha(): number {
    const t = this.timeNorm;
    const NIGHT_ALPHA = 0.85;

    // Dawn: 0.20–0.30 (gradually brighten)
    if (t >= 0.20 && t < 0.30) {
      return NIGHT_ALPHA * (1 - (t - 0.20) / 0.10);
    }
    // Day: 0.30–0.70 (full brightness)
    if (t >= 0.30 && t < 0.70) {
      return 0;
    }
    // Dusk: 0.70–0.83 (gradually darken)
    if (t >= 0.70 && t < 0.83) {
      return NIGHT_ALPHA * ((t - 0.70) / 0.13);
    }
    // Night: 0.83–1.00 and 0.00–0.20
    return NIGHT_ALPHA;
  }

  /**
   * Get the ambient tint color as an RGB integer.
   */
  getAmbientTint(): number {
    const t = this.timeNorm;

    // Dawn: warm orange
    if (t >= 0.20 && t < 0.30) {
      const f = (t - 0.20) / 0.10;
      return lerpColor(0x0a0a30, 0xe08040, f);
    }
    // Morning transition: orange → neutral
    if (t >= 0.30 && t < 0.38) {
      const f = (t - 0.30) / 0.08;
      return lerpColor(0xe08040, 0x888888, f);
    }
    // Day: neutral
    if (t >= 0.38 && t < 0.65) {
      return 0x888888;
    }
    // Dusk approach: neutral → pink/orange
    if (t >= 0.65 && t < 0.75) {
      const f = (t - 0.65) / 0.10;
      return lerpColor(0x888888, 0xd05030, f);
    }
    // Dusk → night: pink/orange → dark blue
    if (t >= 0.75 && t < 0.83) {
      const f = (t - 0.75) / 0.08;
      return lerpColor(0xd05030, 0x0a0a30, f);
    }
    // Night: deep dark blue
    return 0x0a0a30;
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
