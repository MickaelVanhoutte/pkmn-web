import type { RenderCallback } from './spritesheet-player';
import { preloadImage } from './spritesheet-player';

/**
 * Persistent ambient effects for weather and terrain.
 * Unlike one-shot animations, these continuously spawn particles
 * and render overlays for as long as the effect is active.
 */

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface PersistentEffectConfig {
  /** Particle image path */
  particleImage: string;
  /** Number of particles to maintain on screen */
  particleCount: number;
  /** How fast particles move */
  velocity: { x: [number, number]; y: [number, number] };
  /** Particle scale range [min, max] */
  scale: [number, number];
  /** Particle lifetime in ms */
  lifetime: [number, number];
  /** Optional rotation speed */
  rotation?: boolean;
  /** Gravity on Y axis */
  gravity?: number;
  /** Full-screen color overlay */
  overlayColor?: string;
  /** Overlay opacity */
  overlayOpacity?: number;
  /** Blend mode for particles */
  blend?: GlobalCompositeOperation;
  /** Spawn region: 'top' spawns at top, 'bottom' at bottom, 'left' at left, 'full' anywhere */
  spawnRegion?: 'top' | 'bottom' | 'left' | 'full';
  /** Alpha range for particles [min, max] */
  alphaRange?: [number, number];
  /** Whether particles fade out over lifetime */
  fadeOut?: boolean;
}

const WEATHER_CONFIGS: Record<string, PersistentEffectConfig> = {
  rain: {
    particleImage: './fx/elements/water.png',
    particleCount: 50,
    velocity: { x: [-1.5, 0.5], y: [6, 12] },
    scale: [0.1, 0.25],
    lifetime: [600, 1200],
    gravity: 3,
    overlayColor: '#2244aa',
    overlayOpacity: 0.12,
    spawnRegion: 'top',
    fadeOut: false,
    alphaRange: [0.4, 0.75],
  },
  sun: {
    particleImage: './fx/shine.png',
    particleCount: 18,
    velocity: { x: [-0.3, 0.3], y: [0.3, 1.0] },
    scale: [0.3, 0.7],
    lifetime: [2000, 4000],
    overlayColor: '#ffcc44',
    overlayOpacity: 0.14,
    blend: 'lighter',
    spawnRegion: 'top',
    fadeOut: true,
    alphaRange: [0.2, 0.5],
  },
  sandstorm: {
    particleImage: './fx/rock.png',
    particleCount: 35,
    velocity: { x: [3, 8], y: [-0.8, 0.8] },
    scale: [0.2, 0.6],
    lifetime: [800, 1800],
    rotation: true,
    overlayColor: '#8B7355',
    overlayOpacity: 0.12,
    spawnRegion: 'left',
    fadeOut: true,
    alphaRange: [0.3, 0.65],
  },
  hail: {
    particleImage: './fx/shard.png',
    particleCount: 30,
    velocity: { x: [-0.5, 0.5], y: [4, 8] },
    scale: [0.12, 0.35],
    lifetime: [500, 1000],
    rotation: true,
    gravity: 2,
    overlayColor: '#88ccff',
    overlayOpacity: 0.10,
    spawnRegion: 'top',
    fadeOut: false,
    alphaRange: [0.4, 0.75],
  },
};

const TERRAIN_CONFIGS: Record<string, PersistentEffectConfig> = {
  electric: {
    particleImage: './fx/shine.png',
    particleCount: 16,
    velocity: { x: [-1.5, 1.5], y: [-2, -0.5] },
    scale: [0.15, 0.4],
    lifetime: [400, 1000],
    blend: 'lighter',
    overlayColor: '#ffee44',
    overlayOpacity: 0.08,
    spawnRegion: 'bottom',
    fadeOut: true,
    alphaRange: [0.3, 0.6],
  },
  grassy: {
    particleImage: './fx/petal.png',
    particleCount: 16,
    velocity: { x: [-0.8, 0.8], y: [-2, -0.5] },
    scale: [0.2, 0.45],
    lifetime: [1200, 2500],
    rotation: true,
    overlayColor: '#44cc44',
    overlayOpacity: 0.07,
    spawnRegion: 'bottom',
    fadeOut: true,
    alphaRange: [0.3, 0.6],
  },
  psychic: {
    particleImage: './fx/shine.png',
    particleCount: 14,
    velocity: { x: [-0.8, 0.8], y: [-2, -0.3] },
    scale: [0.15, 0.4],
    lifetime: [800, 2000],
    blend: 'lighter',
    overlayColor: '#ff66cc',
    overlayOpacity: 0.07,
    spawnRegion: 'bottom',
    fadeOut: true,
    alphaRange: [0.25, 0.55],
  },
  misty: {
    particleImage: './fx/elements/water.png',
    particleCount: 14,
    velocity: { x: [-0.5, 0.5], y: [-1.5, -0.3] },
    scale: [0.15, 0.35],
    lifetime: [1200, 2500],
    overlayColor: '#ff88cc',
    overlayOpacity: 0.07,
    spawnRegion: 'bottom',
    fadeOut: true,
    alphaRange: [0.25, 0.5],
  },
};

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Creates a persistent ambient effect renderer.
 * Unlike one-shot effects, this continuously spawns new particles
 * to replace expired ones, creating a steady ambient effect.
 *
 * Call the returned `stop()` to fade out and clean up.
 */
export function createPersistentEffect(
  config: PersistentEffectConfig,
  getSize: () => { width: number; height: number },
): { render: RenderCallback; stop: () => void; loadPromise: Promise<void> } {
  let img: HTMLImageElement | null = null;
  let stopping = false;
  let fadeAlpha = 1; // Overall fade multiplier for smooth stop
  const particles: AmbientParticle[] = [];
  let lastTime = performance.now();

  const loadPromise = preloadImage(config.particleImage).then((loaded) => {
    img = loaded;
  });

  function spawnParticle(size: { width: number; height: number }): AmbientParticle {
    let x: number;
    let y: number;
    const region = config.spawnRegion ?? 'full';

    switch (region) {
      case 'top':
        x = Math.random() * size.width;
        y = -20;
        break;
      case 'bottom':
        x = Math.random() * size.width;
        y = size.height + 10 - Math.random() * 30;
        break;
      case 'left':
        x = -20;
        y = Math.random() * size.height;
        break;
      case 'full':
      default:
        x = Math.random() * size.width;
        y = Math.random() * size.height;
        break;
    }

    const life = randRange(config.lifetime[0], config.lifetime[1]);
    const [minA, maxA] = config.alphaRange ?? [0.3, 0.8];

    return {
      x,
      y,
      vx: randRange(config.velocity.x[0], config.velocity.x[1]),
      vy: randRange(config.velocity.y[0], config.velocity.y[1]),
      scale: randRange(config.scale[0], config.scale[1]),
      rotation: config.rotation ? Math.random() * Math.PI * 2 : 0,
      rotationSpeed: config.rotation ? (Math.random() - 0.5) * 4 : 0,
      alpha: randRange(minA, maxA),
      life,
      maxLife: life,
    };
  }

  function render(ctx: CanvasRenderingContext2D): boolean {
    if (!img) return true; // Still loading

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const size = getSize();

    // Handle fade-out when stopping
    if (stopping) {
      fadeAlpha -= dt * 2; // Fade out over ~0.5s
      if (fadeAlpha <= 0) return false; // Done, remove
    }

    // Maintain particle count (spawn new ones as old expire)
    if (!stopping) {
      while (particles.length < config.particleCount) {
        particles.push(spawnParticle(size));
      }
    }

    // Draw overlay
    if (config.overlayColor && config.overlayOpacity) {
      ctx.save();
      ctx.globalAlpha = config.overlayOpacity * fadeAlpha;
      ctx.fillStyle = config.overlayColor;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.restore();
    }

    // Update and draw particles
    ctx.save();
    if (config.blend) ctx.globalCompositeOperation = config.blend;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Physics
      p.vy += (config.gravity ?? 0) * dt * 60;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 1000;
      p.rotation += p.rotationSpeed * dt;

      // Compute alpha
      let alpha = p.alpha * fadeAlpha;
      if (config.fadeOut) {
        alpha *= Math.max(0, p.life / p.maxLife);
      }

      // Remove expired particles
      if (p.life <= 0 || alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Draw
      const w = img.width * p.scale;
      const h = img.height * p.scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      if (p.rotation !== 0) ctx.rotate(p.rotation);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    ctx.restore();

    return true;
  }

  function stop(): void {
    stopping = true;
  }

  return { render, stop, loadPromise };
}

/**
 * Get a persistent effect config for a weather type.
 */
export function getWeatherEffectConfig(weather: string): PersistentEffectConfig | null {
  return WEATHER_CONFIGS[weather] ?? null;
}

/**
 * Get a persistent effect config for a terrain type.
 */
export function getTerrainEffectConfig(terrain: string): PersistentEffectConfig | null {
  return TERRAIN_CONFIGS[terrain] ?? null;
}
