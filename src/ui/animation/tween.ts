// ── Easing functions ──

export type EasingFn = (t: number) => number;

export const easings: Record<string, EasingFn> = {
  linear: (t) => t,

  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Wind-up overshoot — great for lunge preparation
  easeInBack: (t) => {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },

  // Overshoot settle — great for landing
  easeOutBack: (t) => {
    const s = 1.70158;
    return --t * t * ((s + 1) * t + s) + 1;
  },

  // Bouncy settle — great for camera zoom recovery
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },

  // Sharp start, smooth stop
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),

  // Bounce at the end
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

export function getEasing(name?: string): EasingFn {
  if (!name) return easings.easeInOutCubic;
  return easings[name] ?? easings.easeInOutCubic;
}

// ── Core tween function ──

export function tween(
  from: number,
  to: number,
  duration: number,
  easing: EasingFn,
  onUpdate: (value: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (duration <= 0) {
      onUpdate(to);
      resolve();
      return;
    }

    const start = performance.now();

    function tick(now: number): void {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const value = from + (to - from) * easedProgress;
      onUpdate(value);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

// ── Multi-value tween ──

export function tweenValues(
  from: number[],
  to: number[],
  duration: number,
  easing: EasingFn,
  onUpdate: (values: number[]) => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (duration <= 0) {
      onUpdate(to);
      resolve();
      return;
    }

    const start = performance.now();

    function tick(now: number): void {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const values = from.map((f, i) => f + (to[i] - f) * easedProgress);
      onUpdate(values);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

// ── Simple delay ──

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
