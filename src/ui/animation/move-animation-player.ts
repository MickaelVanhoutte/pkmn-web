import type {
  AnimationPhase,
  MoveAnimationDef,
  BattlePosition,
  CanvasPoint,
} from './types';
import type { CanvasOverlay } from './canvas-overlay';
import type { PositionResolver } from './position-resolver';
import type { SpriteAnimator } from './sprite-animator';
import {
  preloadImage,
  createSpritesheetRenderer,
  type RenderCallback,
} from './spritesheet-player';
import { createParticleRenderer, createProjectileRenderer } from './particle-system';
import {
  createPersistentEffect,
  getWeatherEffectConfig,
  getTerrainEffectConfig,
} from './persistent-effects';
import { tween, getEasing, delay } from './tween';
import { audioManager } from '../util/audio';

/**
 * Orchestrates move animations by reading MoveAnimationDef phase sequences
 * and dispatching to the appropriate subsystems (canvas, sprites, audio).
 *
 * Uses a single shared RAF loop: all active effects (spritesheets, particles,
 * projectiles, tween-based overlays) register render callbacks. The loop
 * clears the canvas once per frame, then calls every active renderer.
 */
export class MoveAnimationPlayer {
  private canvas: CanvasOverlay;
  private posResolver: PositionResolver;
  private spriteAnimator: SpriteAnimator;
  private arena: HTMLElement;
  private _playing = false;

  /** Active renderers for move animations — cleared when move finishes. */
  private activeRenderers: Set<RenderCallback> = new Set();
  /** Persistent renderers for weather/terrain — survive between moves. */
  private persistentRenderers: Set<RenderCallback> = new Set();
  /** Stop functions for active persistent effects, keyed by type. */
  private activeWeatherEffect: { stop: () => void; render: RenderCallback } | null = null;
  private activeTerrainEffect: { stop: () => void; render: RenderCallback } | null = null;
  /** Track current weather/terrain type for idempotent start calls. */
  private currentWeatherType: string | null = null;
  private currentTerrainType: string | null = null;
  private rafId: number | null = null;
  /** Promise that resolves when the current move's audio finishes playing. */
  private audioPromise: Promise<void> | null = null;

  /** Reference arena width used to design animation scale values. */
  private static readonly REF_WIDTH = 800;

  constructor(
    canvas: CanvasOverlay,
    posResolver: PositionResolver,
    spriteAnimator: SpriteAnimator,
    arena: HTMLElement,
  ) {
    this.canvas = canvas;
    this.posResolver = posResolver;
    this.spriteAnimator = spriteAnimator;
    this.arena = arena;
  }

  get isPlaying(): boolean {
    return this._playing;
  }

  /** Scale factor relative to reference arena width — keeps animations proportional. */
  private get arenaScale(): number {
    return Math.max(0.4, this.arena.clientWidth / MoveAnimationPlayer.REF_WIDTH);
  }

  /**
   * Play a full move animation sequence.
   * Visual phase durations are scaled to match total audio duration.
   */
  async play(
    def: MoveAnimationDef,
    attacker: BattlePosition,
    targets: BattlePosition[],
  ): Promise<void> {
    this._playing = true;
    this.audioPromise = null;
    const defender = targets[0] ?? attacker;

    // Compute time scale so visual animation matches audio duration
    const timeScale = await this.computeTimeScale(def);

    try {
      for (const phase of def.phases) {
        await this.executePhase(phase, attacker, defender, timeScale);
      }
      // Safety net: if visual phases still finished before audio, wait
      if (this.audioPromise) {
        await this.audioPromise;
      }
    } finally {
      this.audioPromise = null;
      this._playing = false;
      this.stopRafLoop();
      // Only clear canvas if no persistent effects are running
      if (this.persistentRenderers.size === 0) {
        this.canvas.clear();
      }
    }
  }

  // ── Time scale computation ──

  /**
   * Estimate the visual duration of a single phase (excluding audio).
   */
  private estimatePhaseDuration(phase: AnimationPhase): number {
    switch (phase.type) {
      case 'parallel':
        return phase.phases.length > 0
          ? Math.max(...phase.phases.map(p => this.estimatePhaseDuration(p)))
          : 0;
      case 'audio':
      case 'start-weather':
      case 'start-terrain':
        return 0;
      case 'pause':
      case 'hit-stop':
        return phase.duration;
      case 'spritesheet':
        return (phase.sheet.frameCount / (phase.sheet.fps ?? 12)) * 1000 * (phase.loops ?? 1);
      case 'sprite-move':
      case 'projectile':
      case 'particles':
      case 'screen-flash':
      case 'screen-shake':
      case 'camera-zoom':
      case 'lighting':
      case 'color-grade':
      case 'afterimage':
        return phase.duration;
      default:
        return 0;
    }
  }

  /**
   * Walk the phase tree, collecting audio entries with their start times
   * in the visual timeline. Returns the total visual duration.
   */
  private walkPhasesForAudio(
    phases: AnimationPhase[],
    startTime: number,
    entries: { startTime: number; moveName: string; part?: number }[],
  ): number {
    let clock = startTime;
    for (const phase of phases) {
      if (phase.type === 'parallel') {
        let maxEnd = clock;
        for (const child of phase.phases) {
          const childEnd = this.walkPhasesForAudio([child], clock, entries);
          maxEnd = Math.max(maxEnd, childEnd);
        }
        clock = maxEnd;
      } else if (phase.type === 'audio') {
        entries.push({ startTime: clock, moveName: phase.moveName, part: phase.part });
        // Audio doesn't advance the visual clock
      } else {
        clock += this.estimatePhaseDuration(phase);
      }
    }
    return clock;
  }

  /**
   * Compute a time scale factor so visual phases stretch to fill the audio duration.
   * Only slows down (never speeds up). Capped at 3x to avoid extreme stretching.
   */
  private async computeTimeScale(def: MoveAnimationDef): Promise<number> {
    const entries: { startTime: number; moveName: string; part?: number }[] = [];
    const totalVisualDuration = this.walkPhasesForAudio(def.phases, 0, entries);

    if (entries.length === 0 || totalVisualDuration <= 0) return 1;

    // Find when the last audio would end
    let maxAudioEnd = 0;
    for (const entry of entries) {
      const path = audioManager.getMoveSfxPath(entry.moveName, entry.part);
      const duration = await audioManager.getAudioDuration(path);
      maxAudioEnd = Math.max(maxAudioEnd, entry.startTime + duration);
    }

    if (maxAudioEnd <= totalVisualDuration || maxAudioEnd <= 0) return 1;

    return Math.min(3, maxAudioEnd / totalVisualDuration);
  }

  // ── Shared RAF loop ──

  /**
   * Register a render callback and ensure the RAF loop is running.
   * Returns a promise that resolves when the callback returns false (done).
   */
  private addRenderer(render: RenderCallback): Promise<void> {
    return new Promise((resolve) => {
      const wrapped: RenderCallback = (ctx) => {
        const alive = render(ctx);
        if (!alive) {
          this.activeRenderers.delete(wrapped);
          resolve();
          return false;
        }
        return true;
      };
      this.activeRenderers.add(wrapped);
      this.ensureRafRunning();
    });
  }

  private ensureRafRunning(): void {
    if (this.rafId !== null) return;

    const tick = (): void => {
      this.canvas.clear();

      // Draw persistent effects first (background layer)
      for (const renderer of this.persistentRenderers) {
        const alive = renderer(this.canvas.getCtx());
        if (!alive) this.persistentRenderers.delete(renderer);
      }

      // Draw active move animation effects on top
      for (const renderer of this.activeRenderers) {
        const alive = renderer(this.canvas.getCtx());
        if (!alive) this.activeRenderers.delete(renderer);
      }

      if (this.activeRenderers.size > 0 || this.persistentRenderers.size > 0) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopRafLoop(): void {
    // Only clear move animation renderers, keep persistent effects
    this.activeRenderers.clear();

    // If no persistent effects either, stop the RAF loop
    if (this.persistentRenderers.size === 0) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  // ── Phase dispatcher ──

  private async executePhase(
    phase: AnimationPhase,
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    switch (phase.type) {
      case 'parallel':
        await Promise.all(
          phase.phases.map((p) => this.executePhase(p, attacker, defender, timeScale)),
        );
        break;
      case 'pause':
        await delay(phase.duration * timeScale);
        break;
      case 'hit-stop':
        await delay(phase.duration * timeScale);
        break;
      case 'audio':
        this.playAudio(phase.moveName, phase.part);
        break;
      case 'sprite-move':
        await this.executeSpriteMove(phase, attacker, defender, timeScale);
        break;
      case 'spritesheet':
        await this.executeSpritesheet(phase, attacker, defender, timeScale);
        break;
      case 'projectile':
        await this.executeProjectile(phase, attacker, defender, timeScale);
        break;
      case 'particles':
        await this.executeParticles(phase, attacker, defender, timeScale);
        break;
      case 'screen-flash':
        await this.executeScreenFlash(phase, timeScale);
        break;
      case 'screen-shake':
        await this.executeScreenShake(phase, timeScale);
        break;
      case 'camera-zoom':
        await this.executeCameraZoom(phase, timeScale);
        break;
      case 'lighting':
        await this.executeLighting(phase, attacker, defender, timeScale);
        break;
      case 'color-grade':
        await this.executeColorGrade(phase, timeScale);
        break;
      case 'afterimage':
        await this.executeAfterimage(phase, attacker, defender, timeScale);
        break;
      case 'start-weather':
        await this.startWeather(phase.weather);
        break;
      case 'start-terrain':
        await this.startTerrain(phase.terrain);
        break;
    }
  }

  // ── Phase executors ──

  private async executeSpriteMove(
    phase: AnimationPhase & { type: 'sprite-move' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const who = phase.target === 'attacker' ? attacker : defender;
    const other = phase.target === 'attacker' ? defender : attacker;
    const dur = phase.duration * timeScale;

    switch (phase.motion) {
      case 'lunge':
        await this.spriteAnimator.lunge(who, other, dur, phase.easing);
        break;
      case 'recoil':
        await this.spriteAnimator.recoil(who, 8, dur);
        break;
      case 'hop':
        await this.spriteAnimator.hop(who, dur);
        break;
      case 'shake':
        await this.spriteAnimator.shake(who, 6, dur);
        break;
      case 'fly-up':
        await this.spriteAnimator.flyUp(who, dur);
        break;
      case 'fly-down':
        await this.spriteAnimator.flyDown(who, dur);
        break;
      case 'spin':
        await this.spriteAnimator.spin(who, dur);
        break;
      case 'flip':
        await this.spriteAnimator.flip(who, dur);
        break;
      case 'slide-out':
        await this.spriteAnimator.slideOut(who, dur);
        break;
      case 'slide-in':
        await this.spriteAnimator.slideIn(who, dur);
        break;
    }
  }

  private async executeSpritesheet(
    phase: AnimationPhase & { type: 'spritesheet' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const pos = this.posResolver.resolve(phase.at, attacker, defender);
    const img = await preloadImage(phase.sheet.src);
    const s = this.arenaScale;

    const scaledOffset = phase.offset
      ? { x: phase.offset.x * s, y: phase.offset.y * s }
      : undefined;

    // Slow down fps to stretch spritesheet duration by timeScale
    const sheet = timeScale !== 1
      ? { ...phase.sheet, fps: (phase.sheet.fps ?? 12) / timeScale }
      : phase.sheet;

    const { render, promise } = createSpritesheetRenderer(
      sheet,
      img,
      pos,
      {
        scale: (phase.scale ?? 1) * s,
        tint: phase.tint,
        blend: phase.blend,
        loops: phase.loops,
        offset: scaledOffset,
      },
    );

    this.activeRenderers.add(render);
    this.ensureRafRunning();
    await promise;
    this.activeRenderers.delete(render);
  }

  private async executeProjectile(
    phase: AnimationPhase & { type: 'projectile' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const from = this.posResolver.resolve(phase.from, attacker, defender);
    const to = this.posResolver.resolve(phase.to, attacker, defender);
    const img = await preloadImage(phase.image);
    const s = this.arenaScale;

    const { render, promise } = createProjectileRenderer(img, {
      from,
      to,
      duration: phase.duration * timeScale,
      scale: (phase.scale ?? 1) * s,
      tint: phase.tint,
      trail: phase.trail,
      trailCount: phase.trailCount,
      arc: (phase.arc ?? 0) * s,
      blend: phase.blend,
      sheet: phase.sheet ? {
        frameSize: phase.sheet.frameSize,
        frameCount: phase.sheet.frameCount,
        fps: phase.sheet.fps ?? 12,
      } : undefined,
    });

    this.activeRenderers.add(render);
    this.ensureRafRunning();
    await promise;
    this.activeRenderers.delete(render);
  }

  private async executeParticles(
    phase: AnimationPhase & { type: 'particles' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const origin = this.posResolver.resolve(phase.origin, attacker, defender);
    const img = await preloadImage(phase.image);
    const s = this.arenaScale;

    const scaledScale: [number, number] | undefined = phase.scale
      ? [phase.scale[0] * s, phase.scale[1] * s]
      : undefined;

    const { render, promise } = createParticleRenderer(img, {
      ...phase,
      duration: phase.duration * timeScale,
      origin,
      spread: (phase.spread ?? 30) * s,
      scale: scaledScale,
    });

    this.activeRenderers.add(render);
    this.ensureRafRunning();
    await promise;
    this.activeRenderers.delete(render);
  }

  /**
   * Tween-based effects use addRenderer to participate in the shared loop.
   */
  private async executeScreenFlash(
    phase: AnimationPhase & { type: 'screen-flash' },
    timeScale: number = 1,
  ): Promise<void> {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const maxOpacity = phase.opacity ?? 0.5;
    const startTime = performance.now();
    const dur = phase.duration * timeScale;
    const half = dur / 2;
    const total = dur;

    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= total) return false;

      const alpha = elapsed < half
        ? maxOpacity * (elapsed / half)
        : maxOpacity * (1 - (elapsed - half) / half);

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = phase.color;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return true;
    });
  }

  private async executeScreenShake(
    phase: AnimationPhase & { type: 'screen-shake' },
    timeScale: number = 1,
  ): Promise<void> {
    const intensity = phase.intensity * this.arenaScale;
    const axis = phase.axis ?? 'both';
    const start = performance.now();
    const dur = phase.duration * timeScale;

    return new Promise((resolve) => {
      const tick = (now: number): void => {
        const elapsed = now - start;
        if (elapsed >= dur) {
          this.arena.style.transform = '';
          resolve();
          return;
        }

        const decay = 1 - elapsed / dur;
        const dx = axis !== 'y' ? (Math.random() - 0.5) * intensity * 2 * decay : 0;
        const dy = axis !== 'x' ? (Math.random() - 0.5) * intensity * 2 * decay : 0;
        this.arena.style.transform = `translate(${dx}px, ${dy}px)`;

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  private async executeCameraZoom(
    phase: AnimationPhase & { type: 'camera-zoom' },
    timeScale: number = 1,
  ): Promise<void> {
    const easingFn = getEasing(phase.easing ?? 'easeOutElastic');
    const half = (phase.duration * timeScale) / 2;

    await tween(1, phase.scale, half * 0.3, getEasing('easeOutQuad'), (s) => {
      this.arena.style.transform = `scale(${s})`;
    });

    await tween(phase.scale, 1, half * 1.7, easingFn, (s) => {
      this.arena.style.transform = `scale(${s})`;
    });

    this.arena.style.transform = '';
  }

  private async executeLighting(
    phase: AnimationPhase & { type: 'lighting' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const pos = this.posResolver.resolve(phase.at, attacker, defender);
    const startTime = performance.now();
    const dur = phase.duration * timeScale;
    const half = dur / 2;
    const total = dur;
    const scaledRadius = phase.radius * this.arenaScale;

    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= total) return false;

      const alpha = elapsed < half
        ? phase.intensity * (elapsed / half)
        : phase.intensity * (1 - (elapsed - half) / half);

      this.drawLightingGradient(ctx, pos, scaledRadius, phase.color, Math.max(0, alpha));
      return true;
    });
  }

  private drawLightingGradient(
    ctx: CanvasRenderingContext2D,
    center: CanvasPoint,
    radius: number,
    color: string,
    intensity: number,
  ): void {
    const gradient = ctx.createRadialGradient(
      center.x, center.y, 0,
      center.x, center.y, radius,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(
      center.x - radius,
      center.y - radius,
      radius * 2,
      radius * 2,
    );
    ctx.restore();
  }

  private async executeColorGrade(
    phase: AnimationPhase & { type: 'color-grade' },
    timeScale: number = 1,
  ): Promise<void> {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const startTime = performance.now();
    const dur = phase.duration * timeScale;
    const half = dur / 2;
    const total = dur;

    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= total) return false;

      const alpha = elapsed < half
        ? phase.opacity * (elapsed / half)
        : phase.opacity * (1 - (elapsed - half) / half);

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = phase.color;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return true;
    });
  }

  private async executeAfterimage(
    phase: AnimationPhase & { type: 'afterimage' },
    attacker: BattlePosition,
    defender: BattlePosition,
    timeScale: number = 1,
  ): Promise<void> {
    const who = phase.target === 'attacker' ? attacker : defender;
    const imgSrc = this.spriteAnimator.getSpriteImageSrc(who);
    if (!imgSrc) return;

    const img = await preloadImage(imgSrc);
    const pos = this.posResolver.getSlotCenter(who.player, who.slot);
    const s = this.arenaScale;
    const spacing = 15 * s;
    const startTime = performance.now();
    const dur = phase.duration * timeScale;

    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= dur) return false;

      const progress = elapsed / dur;
      const alpha = 1 - progress;

      for (let i = 0; i < phase.count; i++) {
        const offset = (i + 1) * spacing;
        const ghostAlpha = alpha * (1 - i / phase.count) * 0.5;
        if (ghostAlpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        const ghostX = pos.x - offset * (who.player === 0 ? -1 : 1);
        const ghostY = pos.y + offset * 0.3;
        const w = img.width * 0.8 * s;
        const h = img.height * 0.8 * s;
        ctx.drawImage(img, ghostX - w / 2, ghostY - h / 2, w, h);
        ctx.restore();
      }

      return true;
    });
  }

  // ── Persistent weather/terrain effects ──

  /**
   * Start a persistent weather ambient effect.
   * Replaces any currently active weather effect.
   */
  async startWeather(weather: string): Promise<void> {
    // Skip if the same weather is already active (idempotent)
    if (this.currentWeatherType === weather && this.activeWeatherEffect) return;

    // Stop existing weather effect
    this.stopWeather();

    const config = getWeatherEffectConfig(weather);
    if (!config) return;

    const getSize = () => ({ width: this.canvas.width, height: this.canvas.height });
    const effect = createPersistentEffect(config, getSize);

    await effect.loadPromise;

    this.currentWeatherType = weather;
    this.activeWeatherEffect = { stop: effect.stop, render: effect.render };
    this.persistentRenderers.add(effect.render);
    this.ensureRafRunning();
  }

  /**
   * Stop the current weather ambient effect (fades out).
   */
  stopWeather(): void {
    if (this.activeWeatherEffect) {
      this.activeWeatherEffect.stop();
      // The renderer will remove itself when fadeAlpha reaches 0
      this.activeWeatherEffect = null;
    }
    this.currentWeatherType = null;
  }

  /**
   * Start a persistent terrain ambient effect.
   * Replaces any currently active terrain effect.
   */
  async startTerrain(terrain: string): Promise<void> {
    // Skip if the same terrain is already active (idempotent)
    if (this.currentTerrainType === terrain && this.activeTerrainEffect) return;

    // Stop existing terrain effect
    this.stopTerrain();

    const config = getTerrainEffectConfig(terrain);
    if (!config) return;

    const getSize = () => ({ width: this.canvas.width, height: this.canvas.height });
    const effect = createPersistentEffect(config, getSize);

    await effect.loadPromise;

    this.currentTerrainType = terrain;
    this.activeTerrainEffect = { stop: effect.stop, render: effect.render };
    this.persistentRenderers.add(effect.render);
    this.ensureRafRunning();
  }

  /**
   * Stop the current terrain ambient effect (fades out).
   */
  stopTerrain(): void {
    if (this.activeTerrainEffect) {
      this.activeTerrainEffect.stop();
      this.activeTerrainEffect = null;
    }
    this.currentTerrainType = null;
  }

  // ── Pokeball animations (switch-in / switch-out) ──

  /**
   * Animate a pokeball thrown from the trainer's side to the pokemon's position.
   * The pokeball follows a parabolic arc with rotation, ending with a white pop flash.
   */
  async playPokeballThrow(player: number, slot: number, duration: number): Promise<void> {
    const img = await preloadImage('./fx/pokeball.png');
    const arenaSize = this.posResolver.getArenaSize();
    const target = this.posResolver.getSlotCenter(player, slot);
    const s = this.arenaScale;

    // Start position: off-screen on the trainer's side
    const start: CanvasPoint = player === 0
      ? { x: -30 * s, y: arenaSize.height * 0.8 }
      : { x: arenaSize.width + 30 * s, y: arenaSize.height * 0.15 };

    // End position: pokemon slot center, adjusted down slightly (base of pokemon)
    const end: CanvasPoint = { x: target.x, y: target.y + 15 * s };

    const arcHeight = 80 * s;
    const startTime = performance.now();
    const displayScale = 2 * s;

    // Pokeball arc animation
    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) return false;

      const progress = elapsed / duration;
      const eased = getEasing('easeOutQuad')(progress);

      // Linear interpolation + parabolic arc
      const x = start.x + (end.x - start.x) * eased;
      const baseY = start.y + (end.y - start.y) * eased;
      const arcOffset = -arcHeight * 4 * progress * (1 - progress);
      const y = baseY + arcOffset;

      // Rotation: 3 full spins
      const rotation = progress * Math.PI * 6;

      const w = img.width * displayScale;
      const h = img.height * displayScale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      return true;
    });

    // Pop flash at arrival point
    await this.playPopFlash(end, 150);
  }

  /**
   * Animate a pokeball recall: brief flash at pokemon position, then pokeball
   * arcs back to the trainer's side of the screen.
   */
  async playPokeballRecall(player: number, slot: number, duration: number): Promise<void> {
    const img = await preloadImage('./fx/pokeball.png');
    const arenaSize = this.posResolver.getArenaSize();
    const origin = this.posResolver.getSlotCenter(player, slot);
    const s = this.arenaScale;

    // Start position: at the pokemon
    const start: CanvasPoint = { x: origin.x, y: origin.y + 15 * s };

    // End position: off-screen on the trainer's side
    const end: CanvasPoint = player === 0
      ? { x: -30 * s, y: arenaSize.height * 0.8 }
      : { x: arenaSize.width + 30 * s, y: arenaSize.height * 0.15 };

    // Brief pop flash at pokemon position (pokeball materializes)
    await this.playPopFlash(start, 100);

    const arcHeight = 60 * s;
    const startTime = performance.now();
    const displayScale = 2 * s;

    // Pokeball arc animation (reverse — from pokemon to off-screen)
    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) return false;

      const progress = elapsed / duration;
      const eased = getEasing('easeInQuad')(progress);

      const x = start.x + (end.x - start.x) * eased;
      const baseY = start.y + (end.y - start.y) * eased;
      const arcOffset = -arcHeight * 4 * progress * (1 - progress);
      const y = baseY + arcOffset;

      // Rotation: 2 full spins for recall
      const rotation = progress * Math.PI * 4;

      const w = img.width * displayScale;
      const h = img.height * displayScale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      return true;
    });
  }

  /**
   * Quick expanding white circle "pop" flash at a point.
   */
  private async playPopFlash(pos: CanvasPoint, duration: number): Promise<void> {
    const startTime = performance.now();
    const maxRadius = 35 * this.arenaScale;

    await this.addRenderer((ctx) => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) return false;

      const progress = elapsed / duration;
      const radius = maxRadius * getEasing('easeOutQuad')(progress);
      const alpha = 1 - progress;

      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return true;
    });
  }

  // ── Audio ──

  private playAudio(moveName: string, part?: number): void {
    if (part !== undefined) {
      this.audioPromise = audioManager.playMoveSfxPartFullDuration(moveName, part);
    } else {
      this.audioPromise = audioManager.playMoveSfxFullDuration(moveName);
    }
  }
}
