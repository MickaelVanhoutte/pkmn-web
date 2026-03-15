import type { SpritesheetRef, CanvasPoint } from './types';

const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export interface SpritesheetPlayOptions {
  scale?: number;
  tint?: string;
  blend?: GlobalCompositeOperation;
  loops?: number;
  offset?: CanvasPoint;
}

/**
 * A render callback that draws the current frame to the provided context.
 * Returns false when the animation is complete (no more frames to draw).
 */
export type RenderCallback = (ctx: CanvasRenderingContext2D) => boolean;

/**
 * Create a spritesheet renderer for use in a shared RAF loop.
 * The caller clears the canvas each frame; this just draws the current frame.
 */
export function createSpritesheetRenderer(
  sheet: SpritesheetRef,
  img: HTMLImageElement,
  position: CanvasPoint,
  options: SpritesheetPlayOptions = {},
): { render: RenderCallback; promise: Promise<void> } {
  const {
    scale = 1,
    tint,
    blend,
    loops = 1,
    offset = { x: 0, y: 0 },
  } = options;

  const fps = sheet.fps ?? 12;
  const frameDuration = 1000 / fps;
  const totalFrames = sheet.frameCount * loops;

  let tintedImg: HTMLImageElement | HTMLCanvasElement = img;
  if (tint) {
    tintedImg = createTintedSheet(img, tint);
  }

  const drawSize = sheet.frameSize * scale;
  const drawX = position.x + offset.x - drawSize / 2;
  const drawY = position.y + offset.y - drawSize / 2;

  let frameIndex = 0;
  let lastFrameTime = performance.now();
  let done = false;
  let resolveFn: () => void;

  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });

  function render(ctx: CanvasRenderingContext2D): boolean {
    if (done) return false;

    const now = performance.now();
    if (now - lastFrameTime >= frameDuration) {
      lastFrameTime = now - ((now - lastFrameTime) % frameDuration);
      frameIndex++;
    }

    if (frameIndex >= totalFrames) {
      done = true;
      resolveFn();
      return false;
    }

    const srcFrame = frameIndex % sheet.frameCount;
    const srcX = srcFrame * sheet.frameSize;

    ctx.save();
    if (blend) ctx.globalCompositeOperation = blend;
    ctx.drawImage(
      tintedImg,
      srcX, 0, sheet.frameSize, sheet.frameSize,
      drawX, drawY, drawSize, drawSize,
    );
    ctx.restore();
    return true;
  }

  return { render, promise };
}

/**
 * Create a tinted copy of a spritesheet using an offscreen canvas.
 */
function createTintedSheet(
  img: HTMLImageElement,
  color: string,
): HTMLCanvasElement {
  const cacheKey = `${img.src}:${color}`;
  const cached = tintCache.get(cacheKey);
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

  tintCache.set(cacheKey, offscreen);
  return offscreen;
}

const tintCache = new Map<string, HTMLCanvasElement>();

export async function preloadAnimationAssets(
  sheets: SpritesheetRef[],
  images: string[],
): Promise<void> {
  const promises: Promise<HTMLImageElement>[] = [];
  for (const s of sheets) promises.push(preloadImage(s.src));
  for (const src of images) promises.push(preloadImage(src));
  await Promise.all(promises);
}
