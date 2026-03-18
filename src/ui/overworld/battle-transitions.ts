import Phaser from 'phaser';

/**
 * Battle transition animations for the overworld → battle screen change.
 * Each transition covers the screen with black, timed to sync with the
 * ~2.9s battle-start jingle (flash 300ms + pause 400ms + wipe ~2200ms).
 *
 * All transitions use a full-screen Graphics overlay rendered above everything.
 */

type TransitionFn = (scene: Phaser.Scene, onComplete: () => void) => void;

/** Duration for all transition wipe animations (ms) */
const WIPE_DURATION = 2200;

// ── Transition 1: Iris Close ─────────────────────────────────────────────
// A circle shrinks from full screen to the center

const irisClose: TransitionFn = (scene, onComplete) => {
  const { width, height } = scene.cameras.main;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy) + 20;

  const overlay = scene.add.graphics();
  overlay.setDepth(999999);
  overlay.setScrollFactor(0);

  const startTime = scene.time.now;

  const update = () => {
    const elapsed = scene.time.now - startTime;
    const progress = Math.min(1, elapsed / WIPE_DURATION);
    // Slow start, accelerate toward end
    const eased = progress * progress * progress;
    const radius = maxRadius * (1 - eased);

    overlay.clear();
    overlay.fillStyle(0x000000, 1);
    overlay.beginPath();
    // Outer rectangle (clockwise)
    overlay.moveTo(-10, -10);
    overlay.lineTo(width + 10, -10);
    overlay.lineTo(width + 10, height + 10);
    overlay.lineTo(-10, height + 10);
    overlay.closePath();

    // Inner circle (counterclockwise to create hole)
    if (radius > 0.5) {
      const steps = 48;
      for (let i = steps; i >= 0; i--) {
        const angle = (i / steps) * Math.PI * 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === steps) {
          overlay.moveTo(px, py);
        } else {
          overlay.lineTo(px, py);
        }
      }
      overlay.closePath();
    }

    overlay.fill();

    if (progress >= 1) {
      overlay.destroy();
      onComplete();
    }
  };

  scene.time.addEvent({
    delay: 16,
    callback: update,
    loop: true,
  });
};

// ── Transition 2: Horizontal Bars ────────────────────────────────────────
// Alternating horizontal bars slide in from left and right

const horizontalBars: TransitionFn = (scene, onComplete) => {
  const { width, height } = scene.cameras.main;
  const barCount = 10;
  const barHeight = Math.ceil(height / barCount) + 1;

  const overlay = scene.add.graphics();
  overlay.setDepth(999999);
  overlay.setScrollFactor(0);

  const stagger = 120; // ms between each bar starting
  const barAnimDuration = WIPE_DURATION - (barCount * stagger);
  const startTime = scene.time.now;

  const update = () => {
    const elapsed = scene.time.now - startTime;
    overlay.clear();
    overlay.fillStyle(0x000000, 1);

    let allDone = true;
    for (let i = 0; i < barCount; i++) {
      const barStart = i * stagger;
      const barElapsed = Math.max(0, elapsed - barStart);
      const progress = Math.min(1, barElapsed / Math.max(1, barAnimDuration));
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      if (progress < 1) allDone = false;

      const y = i * barHeight;
      const barWidth = width * eased;

      if (i % 2 === 0) {
        // Slide from left
        overlay.fillRect(0, y, barWidth, barHeight);
      } else {
        // Slide from right
        overlay.fillRect(width - barWidth, y, barWidth, barHeight);
      }
    }

    if (allDone) {
      overlay.destroy();
      onComplete();
    }
  };

  scene.time.addEvent({
    delay: 16,
    callback: update,
    loop: true,
  });
};

// ── Transition 3: Diagonal Wipe ──────────────────────────────────────────
// A diagonal line sweeps across the screen from top-left to bottom-right

const diagonalWipe: TransitionFn = (scene, onComplete) => {
  const { width, height } = scene.cameras.main;

  const overlay = scene.add.graphics();
  overlay.setDepth(999999);
  overlay.setScrollFactor(0);

  const startTime = scene.time.now;
  // The diagonal needs to cover extra distance
  const totalDist = width + height;

  const update = () => {
    const elapsed = scene.time.now - startTime;
    const progress = Math.min(1, elapsed / WIPE_DURATION);
    // Ease in-out
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const offset = totalDist * eased;

    overlay.clear();
    overlay.fillStyle(0x000000, 1);
    overlay.beginPath();
    // Diagonal polygon covering the swept area
    overlay.moveTo(-10, -10);
    overlay.lineTo(offset, -10);
    overlay.lineTo(offset - height, height + 10);
    overlay.lineTo(-10, height + 10);
    overlay.closePath();
    overlay.fill();

    if (progress >= 1) {
      overlay.destroy();
      onComplete();
    }
  };

  scene.time.addEvent({
    delay: 16,
    callback: update,
    loop: true,
  });
};

// ── Transition 4: Double Closing Doors ───────────────────────────────────
// Two halves close from left and right like doors

const closingDoors: TransitionFn = (scene, onComplete) => {
  const { width, height } = scene.cameras.main;

  const overlay = scene.add.graphics();
  overlay.setDepth(999999);
  overlay.setScrollFactor(0);

  const startTime = scene.time.now;

  const update = () => {
    const elapsed = scene.time.now - startTime;
    const progress = Math.min(1, elapsed / WIPE_DURATION);
    // Ease in-out for a satisfying door close
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const halfWidth = (width / 2) * eased;

    overlay.clear();
    overlay.fillStyle(0x000000, 1);
    // Left door
    overlay.fillRect(0, -10, halfWidth, height + 20);
    // Right door
    overlay.fillRect(width - halfWidth, -10, halfWidth + 10, height + 20);

    if (progress >= 1) {
      overlay.destroy();
      onComplete();
    }
  };

  scene.time.addEvent({
    delay: 16,
    callback: update,
    loop: true,
  });
};

// ── Transition 5: Spinning Wedges ────────────────────────────────────────
// Pie slices rotate and expand to cover the screen

const spinningWedges: TransitionFn = (scene, onComplete) => {
  const { width, height } = scene.cameras.main;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy) + 20;
  const wedgeCount = 6;

  const overlay = scene.add.graphics();
  overlay.setDepth(999999);
  overlay.setScrollFactor(0);

  const startTime = scene.time.now;

  const update = () => {
    const elapsed = scene.time.now - startTime;
    const progress = Math.min(1, elapsed / WIPE_DURATION);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);

    // Each wedge grows its angular sweep
    const sweepAngle = (Math.PI * 2 / wedgeCount) * eased;
    const rotation = progress * Math.PI * 0.5; // slight rotation during animation

    overlay.clear();
    overlay.fillStyle(0x000000, 1);

    for (let i = 0; i < wedgeCount; i++) {
      const baseAngle = (i / wedgeCount) * Math.PI * 2 + rotation;
      overlay.beginPath();
      overlay.moveTo(cx, cy);

      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        const angle = baseAngle + (s / steps) * sweepAngle;
        overlay.lineTo(
          cx + Math.cos(angle) * maxRadius,
          cy + Math.sin(angle) * maxRadius,
        );
      }

      overlay.closePath();
      overlay.fill();
    }

    if (progress >= 1) {
      overlay.destroy();
      onComplete();
    }
  };

  scene.time.addEvent({
    delay: 16,
    callback: update,
    loop: true,
  });
};

// ── Public API ───────────────────────────────────────────────────────────

const TRANSITIONS: TransitionFn[] = [
  irisClose,
  horizontalBars,
  diagonalWipe,
  closingDoors,
  spinningWedges,
];

/** Play a random battle transition animation, then call onComplete */
export function playBattleTransition(scene: Phaser.Scene, onComplete: () => void): void {
  const idx = Math.floor(Math.random() * TRANSITIONS.length);
  TRANSITIONS[idx](scene, onComplete);
}
