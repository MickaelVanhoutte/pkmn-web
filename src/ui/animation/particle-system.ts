import type { CanvasPoint } from './types';
import { preloadImage, type RenderCallback } from './spritesheet-player';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
}

export interface ParticleEmitOptions {
  image: string;
  count: number;
  origin: CanvasPoint;
  spread: number;
  duration: number;
  gravity?: number;
  drag?: number;
  fadeOut?: boolean;
  scale?: [number, number];
  rotation?: boolean;
  blend?: GlobalCompositeOperation;
  velocity?: { x?: [number, number]; y?: [number, number] };
}

/**
 * Create a particle emitter renderer for a shared RAF loop.
 * Caller clears canvas each frame; this draws all living particles.
 */
export function createParticleRenderer(
  img: HTMLImageElement,
  options: ParticleEmitOptions,
): { render: RenderCallback; promise: Promise<void> } {
  const {
    count,
    origin,
    spread,
    duration,
    gravity = 0,
    drag = 0,
    fadeOut = true,
    scale = [0.5, 1.5],
    rotation = false,
    blend,
    velocity,
  } = options;

  const particles: Particle[] = [];
  const vxRange = velocity?.x ?? [-spread, spread];
  const vyRange = velocity?.y ?? [-spread, spread];

  for (let i = 0; i < count; i++) {
    const life = duration * (0.5 + Math.random() * 0.5);
    particles.push({
      x: origin.x + (Math.random() - 0.5) * spread * 0.5,
      y: origin.y + (Math.random() - 0.5) * spread * 0.5,
      vx: randRange(vxRange[0], vxRange[1]),
      vy: randRange(vyRange[0], vyRange[1]),
      life,
      maxLife: life,
      scale: randRange(scale[0], scale[1]),
      rotation: rotation ? Math.random() * Math.PI * 2 : 0,
      rotationSpeed: rotation ? (Math.random() - 0.5) * 6 : 0,
      alpha: 1,
    });
  }

  let lastTime = performance.now();
  let done = false;
  let resolveFn: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });

  function render(ctx: CanvasRenderingContext2D): boolean {
    if (done) return false;

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    let alive = 0;

    ctx.save();
    if (blend) ctx.globalCompositeOperation = blend;

    for (const p of particles) {
      if (p.life <= 0) continue;
      alive++;

      p.vy += gravity * dt * 60;
      p.vx *= 1 - drag * dt;
      p.vy *= 1 - drag * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 1000;
      p.rotation += p.rotationSpeed * dt;

      if (fadeOut) {
        p.alpha = Math.max(0, p.life / p.maxLife);
      }

      const w = img.width * p.scale;
      const h = img.height * p.scale;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      if (p.rotation !== 0) ctx.rotate(p.rotation);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    ctx.restore();

    if (alive <= 0) {
      done = true;
      resolveFn();
      return false;
    }
    return true;
  }

  return { render, promise };
}

/**
 * Create a projectile renderer for a shared RAF loop.
 * Moves from A to B over duration, with optional trail and arc.
 * Supports animated spritesheets (cycles through frames while flying)
 * and tinting via offscreen canvas.
 */
export function createProjectileRenderer(
  img: HTMLImageElement,
  options: {
    from: CanvasPoint;
    to: CanvasPoint;
    duration: number;
    scale?: number;
    tint?: string;
    trail?: boolean;
    trailCount?: number;
    arc?: number;
    blend?: GlobalCompositeOperation;
    /** When set, animate through spritesheet frames while flying. */
    sheet?: { frameSize: number; frameCount: number; fps: number };
  },
): { render: RenderCallback; promise: Promise<void> } {
  const {
    from,
    to,
    duration,
    scale = 1,
    tint,
    trail = false,
    trailCount = 5,
    arc = 0,
    blend,
    sheet,
  } = options;

  // Tint the image/spritesheet if needed
  let drawImg: HTMLImageElement | HTMLCanvasElement = img;
  if (tint) {
    drawImg = tintImage(img, tint);
  }

  interface TrailPoint {
    x: number;
    y: number;
    alpha: number;
    frame: number;
  }

  const trailPoints: TrailPoint[] = [];
  const startTime = performance.now();
  let done = false;
  let resolveFn: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });

  // For spritesheet mode, size from one frame; otherwise use full image
  const frameW = sheet ? sheet.frameSize : img.width;
  const frameH = sheet ? sheet.frameSize : img.height;

  /** Draw a single frame (or full image if no sheet) at the given position */
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    s: number,
    frame: number,
  ): void {
    const w = frameW * s;
    const h = frameH * s;
    if (sheet) {
      const srcX = frame * sheet.frameSize;
      ctx.drawImage(drawImg, srcX, 0, sheet.frameSize, sheet.frameSize, cx - w / 2, cy - h / 2, w, h);
    } else {
      ctx.drawImage(drawImg, cx - w / 2, cy - h / 2, w, h);
    }
  }

  function render(ctx: CanvasRenderingContext2D): boolean {
    if (done) return false;

    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Current spritesheet frame
    const currentFrame = sheet
      ? Math.floor((elapsed / 1000) * sheet.fps) % sheet.frameCount
      : 0;

    const x = from.x + (to.x - from.x) * progress;
    const baseY = from.y + (to.y - from.y) * progress;
    const arcOffset = arc * 4 * progress * (1 - progress);
    const y = baseY - arcOffset;

    ctx.save();
    if (blend) ctx.globalCompositeOperation = blend;

    // Trail
    if (trail) {
      trailPoints.push({ x, y, alpha: 0.6, frame: currentFrame });
      for (let i = trailPoints.length - 1; i >= 0; i--) {
        trailPoints[i].alpha -= 0.6 / trailCount;
        if (trailPoints[i].alpha <= 0) {
          trailPoints.splice(i, 1);
        }
      }
      for (const tp of trailPoints) {
        ctx.save();
        ctx.globalAlpha = tp.alpha;
        drawFrame(ctx, tp.x, tp.y, scale * 0.7, tp.frame);
        ctx.restore();
      }
    }

    // Projectile
    drawFrame(ctx, x, y, scale, currentFrame);

    ctx.restore();

    if (progress >= 1) {
      done = true;
      resolveFn();
      return false;
    }
    return true;
  }

  return { render, promise };
}

/**
 * Create a tinted copy of any image using an offscreen canvas.
 * Cached by src + color.
 */
function tintImage(
  img: HTMLImageElement,
  color: string,
): HTMLCanvasElement {
  const cacheKey = `proj:${img.src}:${color}`;
  const cached = projTintCache.get(cacheKey);
  if (cached) return cached;

  const offscreen = document.createElement('canvas');
  offscreen.width = img.width;
  offscreen.height = img.height;
  const octx = offscreen.getContext('2d')!;

  octx.drawImage(img, 0, 0);
  octx.globalCompositeOperation = 'source-atop';
  octx.fillStyle = color;
  octx.fillRect(0, 0, offscreen.width, offscreen.height);
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(img, 0, 0);

  projTintCache.set(cacheKey, offscreen);
  return offscreen;
}

const projTintCache = new Map<string, HTMLCanvasElement>();

/**
 * Legacy standalone versions (kept for backward compat, but prefer createXxxRenderer).
 */
export async function emitParticles(
  ctx: CanvasRenderingContext2D,
  options: ParticleEmitOptions,
): Promise<void> {
  const img = await preloadImage(options.image);
  const renderer = createParticleRenderer(img, options);

  return new Promise((resolve) => {
    function tick(): void {
      if (renderer.render(ctx)) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

export async function animateProjectile(
  ctx: CanvasRenderingContext2D,
  options: {
    image: string;
    from: CanvasPoint;
    to: CanvasPoint;
    duration: number;
    scale?: number;
    tint?: string;
    trail?: boolean;
    trailCount?: number;
    arc?: number;
    blend?: GlobalCompositeOperation;
  },
): Promise<void> {
  const img = await preloadImage(options.image);
  const renderer = createProjectileRenderer(img, options);

  return new Promise((resolve) => {
    function tick(): void {
      if (renderer.render(ctx)) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
