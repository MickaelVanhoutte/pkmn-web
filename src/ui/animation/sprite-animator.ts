import type { BattlePosition, CanvasPoint } from './types';
import type { PositionResolver } from './position-resolver';
import { tween, getEasing, delay } from './tween';

/**
 * Manages CSS-based animations on Pokemon sprite DOM elements.
 * Handles lunges, shakes, hit flashes, and other sprite movements.
 */
export class SpriteAnimator {
  private slots: Map<string, HTMLElement> = new Map();
  private posResolver: PositionResolver;
  private arena: HTMLElement;

  constructor(arena: HTMLElement, posResolver: PositionResolver) {
    this.arena = arena;
    this.posResolver = posResolver;
  }

  registerSlot(player: number, slot: number, el: HTMLElement): void {
    this.slots.set(`${player}-${slot}`, el);
  }

  private getSlot(pos: BattlePosition): HTMLElement | null {
    return this.slots.get(`${pos.player}-${pos.slot}`) ?? null;
  }

  /** Lunge toward the target position and return */
  async lunge(
    who: BattlePosition,
    toward: BattlePosition,
    duration: number,
    easingName?: string,
  ): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    const fromPos = this.posResolver.getSlotCenter(who.player, who.slot);
    const toPos = this.posResolver.getSlotCenter(toward.player, toward.slot);

    // Calculate direction vector, go 40% of the distance
    const dx = (toPos.x - fromPos.x) * 0.4;
    const dy = (toPos.y - fromPos.y) * 0.4;

    const half = duration / 2;
    const easeIn = getEasing(easingName ?? 'easeInBack');
    const easeOut = getEasing('easeOutCubic');

    // Forward
    await tween(0, 1, half, easeIn, (t) => {
      el.style.transform = `translate(${dx * t}px, ${dy * t}px)`;
    });

    // Return
    await tween(1, 0, half, easeOut, (t) => {
      el.style.transform = `translate(${dx * t}px, ${dy * t}px)`;
    });

    el.style.transform = '';
  }

  /** Quick recoil shake (for taking damage or recoil moves) */
  async recoil(who: BattlePosition, intensity: number, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    const easing = getEasing('linear');
    const shakes = Math.floor(duration / 50);

    await tween(0, shakes, duration, easing, (t) => {
      const phase = Math.sin(t * Math.PI * 2 * 3);
      el.style.transform = `translateX(${phase * intensity}px)`;
    });

    el.style.transform = '';
  }

  /** Hop upward slightly */
  async hop(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    const half = duration / 2;

    await tween(0, -15, half, getEasing('easeOutQuad'), (y) => {
      el.style.transform = `translateY(${y}px)`;
    });

    await tween(-15, 0, half, getEasing('easeInQuad'), (y) => {
      el.style.transform = `translateY(${y}px)`;
    });

    el.style.transform = '';
  }

  /** Rapid shake in place */
  async shake(who: BattlePosition, intensity: number, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    const start = performance.now();

    return new Promise((resolve) => {
      function tick(now: number): void {
        const elapsed = now - start;
        if (elapsed >= duration) {
          el!.style.transform = '';
          resolve();
          return;
        }

        const dx = (Math.random() - 0.5) * intensity * 2;
        const dy = (Math.random() - 0.5) * intensity * 2;
        el!.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    });
  }

  /** Fly upward and become invisible (for Fly charge) */
  async flyUp(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    el.style.transition = `transform ${duration}ms ease-in, opacity ${duration}ms ease-in`;
    el.style.transform = 'translateY(-150px) scale(0.5)';
    el.style.opacity = '0';

    await delay(duration);
    el.style.transition = '';
  }

  /** Fly downward from above (for Fly strike) */
  async flyDown(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    el.style.opacity = '1';
    el.style.transform = 'translateY(-150px) scale(0.5)';

    // Force reflow
    el.offsetHeight;

    el.style.transition = `transform ${duration}ms ease-out, opacity ${duration * 0.5}ms ease-out`;
    el.style.transform = '';

    await delay(duration);
    el.style.transition = '';
  }

  /** Spin animation (for Rapid Spin — legacy) */
  async spin(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    el.style.transition = `transform ${duration}ms linear`;
    el.style.transform = 'rotate(720deg)';

    await delay(duration);
    el.style.transition = '';
    el.style.transform = '';
  }

  /**
   * Paper Mario–style 3D flip around the vertical axis.
   * The sprite appears to rotate like a flat card turning in 3D space.
   */
  async flip(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    // Enable 3D perspective on the parent for proper 3D effect
    const parent = el.parentElement;
    if (parent) parent.style.perspective = '400px';

    const totalRotation = 720; // two full flips
    const start = performance.now();

    return new Promise((resolve) => {
      function tick(now: number): void {
        const elapsed = now - start;
        if (elapsed >= duration) {
          el!.style.transform = '';
          if (parent) parent.style.perspective = '';
          resolve();
          return;
        }

        const progress = elapsed / duration;
        // Ease in-out for natural feel
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const deg = eased * totalRotation;
        el!.style.transform = `rotateY(${deg}deg)`;
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    });
  }

  /**
   * Slide the sprite off-screen to its side (left for player 0, right for player 1).
   * The transform is KEPT — the sprite stays off-screen until slideIn is called.
   */
  async slideOut(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    // Player pokemon slides left, opponent slides right
    const direction = who.player === 0 ? -1 : 1;
    const distance = 300;

    el.style.transition = `transform ${duration}ms ease-in, opacity ${duration * 0.8}ms ease-in`;
    el.style.transform = `translateX(${direction * distance}px)`;
    el.style.opacity = '0';

    await delay(duration);
    el.style.transition = '';
    // Transform and opacity are intentionally NOT cleared — sprite stays off-screen
  }

  /**
   * Slide the sprite back on-screen from its side.
   * Assumes the sprite is currently off-screen (from slideOut or initial placement).
   */
  async slideIn(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    // Set initial opacity to visible before animating
    el.style.opacity = '1';

    // Force reflow so transition starts from current transform
    el.offsetHeight;

    el.style.transition = `transform ${duration}ms ease-out`;
    el.style.transform = '';

    await delay(duration);
    el.style.transition = '';
  }

  /**
   * Swap the sprite image source (for Substitute).
   * Returns the original src so it can be restored later.
   */
  swapSprite(who: BattlePosition, newSrc: string): string | null {
    const el = this.getSlot(who);
    if (!el) return null;
    const img = el.querySelector('img');
    if (!img) return null;
    const oldSrc = img.src;
    img.src = newSrc;
    return oldSrc;
  }

  /** Restore a sprite to its original image */
  restoreSprite(who: BattlePosition, originalSrc: string): void {
    const el = this.getSlot(who);
    if (!el) return;
    const img = el.querySelector('img');
    if (img) img.src = originalSrc;
  }

  /** Flash brightness (hit effect) — uses existing CSS class */
  async flash(who: BattlePosition): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;

    el.classList.add('sprite-hit');
    await delay(450); // 0.15s × 3 repeats
    el.classList.remove('sprite-hit');
  }

  /** Get the sprite image src for afterimage rendering */
  getSpriteImageSrc(who: BattlePosition): string | null {
    const el = this.getSlot(who);
    if (!el) return null;
    const img = el.querySelector('img');
    return img?.src ?? null;
  }

  // ── Switch / Faint animations ──

  private static readonly DROP_SHADOW = 'drop-shadow(2px 4px 0 rgba(0,0,0,0.35))';

  /**
   * Switch-in appear: sprite starts at scale(0) + white, grows to full size
   * with color fading in. Container must have visibility set externally beforehand.
   */
  async switchInAppear(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;
    const img = el.querySelector('img') as HTMLElement | null;

    // Initial state: invisible scale, white filter
    el.style.transform = 'scale(0)';
    el.style.visibility = 'visible';
    if (img) img.style.filter = `brightness(10) ${SpriteAnimator.DROP_SHADOW}`;

    // Force reflow so the initial state is applied before transitioning
    el.offsetHeight;

    // Scale up with overshoot + brightness fade in parallel
    const brightnessDelay = duration * 0.2;
    const brightnessDuration = duration * 0.8;

    await Promise.all([
      tween(0, 1, duration, getEasing('easeOutBack'), (s) => {
        el.style.transform = `scale(${s})`;
      }),
      // Brightness starts slightly after scale (color fades in as it grows)
      delay(brightnessDelay).then(() => {
        if (!img) return;
        return tween(10, 1, brightnessDuration, getEasing('easeOutCubic'), (b) => {
          img.style.filter = `brightness(${b}) ${SpriteAnimator.DROP_SHADOW}`;
        });
      }),
    ]);

    // Clean up — let CSS classes handle normal state
    el.style.transform = '';
    if (img) img.style.filter = '';
  }

  /**
   * Switch-out shrink: sprite shrinks to scale(0) while going white.
   * Sets visibility hidden at the end.
   */
  async switchOutShrink(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;
    const img = el.querySelector('img') as HTMLElement | null;

    await Promise.all([
      tween(1, 0, duration, getEasing('easeInBack'), (s) => {
        el.style.transform = `scale(${s})`;
      }),
      // Brightness ramps up faster than scale shrinks
      img ? tween(1, 10, duration * 0.7, getEasing('easeInQuad'), (b) => {
        img.style.filter = `brightness(${b}) ${SpriteAnimator.DROP_SHADOW}`;
      }) : Promise.resolve(),
    ]);

    el.style.visibility = 'hidden';
    el.style.transform = '';
    if (img) img.style.filter = '';
  }

  /**
   * Faint fall: sprite darkens/desaturates, then falls downward and fades out.
   * Sets visibility hidden at the end.
   */
  async faintFall(who: BattlePosition, duration: number): Promise<void> {
    const el = this.getSlot(who);
    if (!el) return;
    const img = el.querySelector('img') as HTMLElement | null;

    // Phase 1: Darken + desaturate
    if (img) {
      img.style.filter = `grayscale(1) brightness(0.4) ${SpriteAnimator.DROP_SHADOW}`;
    }
    await delay(200);

    // Phase 2: Fall down + fade out
    const fallDuration = duration - 200;
    await Promise.all([
      tween(0, 150, fallDuration, getEasing('easeInCubic'), (y) => {
        el.style.transform = `translateY(${y}px)`;
      }),
      tween(1, 0, fallDuration, getEasing('easeInQuad'), (a) => {
        el.style.opacity = `${a}`;
      }),
    ]);

    // Clean up
    el.style.visibility = 'hidden';
    el.style.transform = '';
    el.style.opacity = '';
    if (img) img.style.filter = '';
  }
}
