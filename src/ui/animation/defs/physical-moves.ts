import type { MoveAnimationDef } from '../types';
import { SHEETS } from '../types';

export const physicalMoves: MoveAnimationDef[] = [
  // ── Tackle ──
  {
    moveId: 'tackle',
    phases: [
      { type: 'audio', moveName: 'Tackle' },
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 300, easing: 'easeInBack' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.2 },
          { type: 'hit-stop', duration: 50 },
          { type: 'camera-zoom', scale: 1.02, duration: 300 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 200 },
      { type: 'particles', image: './fx/rock.png', count: 2, origin: 'defender', spread: 40, duration: 400, gravity: 3, fadeOut: true, scale: [0.3, 0.6] },
    ],
  },

  // ── Close Combat ──
  {
    moveId: 'close-combat',
    phases: [
      { type: 'audio', moveName: 'Close Combat' },
      // Triple strike
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 200, easing: 'easeInQuad' },
          { type: 'spritesheet', sheet: SHEETS.fist, at: 'defender' },
        ],
      },
      { type: 'hit-stop', duration: 30 },
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 180, easing: 'easeInQuad' },
          { type: 'spritesheet', sheet: SHEETS.foot, at: 'defender', offset: { x: 10, y: -10 } },
        ],
      },
      { type: 'hit-stop', duration: 30 },
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 180, easing: 'easeInQuad' },
          { type: 'spritesheet', sheet: SHEETS.fist, at: 'defender', offset: { x: -10, y: 10 } },
          { type: 'camera-zoom', scale: 1.03, duration: 400 },
        ],
      },
      { type: 'hit-stop', duration: 50 },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 300 },
      { type: 'particles', image: './fx/impact.png', count: 3, origin: 'defender', spread: 50, duration: 500, gravity: 2, fadeOut: true, scale: [0.3, 0.5] },
    ],
  },

  // ── X-Scissor ──
  {
    moveId: 'x-scissor',
    phases: [
      { type: 'audio', moveName: 'X-Scissor' },
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 250, easing: 'easeInBack' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.slash, at: 'defender', scale: 1.3 },
          { type: 'spritesheet', sheet: SHEETS.slash, at: 'defender', scale: 1.3, offset: { x: 15, y: -15 } },
          { type: 'screen-flash', color: '#88ff88', duration: 150, opacity: 0.3 },
          { type: 'hit-stop', duration: 50 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 250 },
    ],
  },

  // ── Iron Head ──
  {
    moveId: 'iron-head',
    phases: [
      { type: 'audio', moveName: 'Iron Head' },
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 350, easing: 'easeInQuad' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.5 },
          { type: 'screen-flash', color: '#ffffff', duration: 200, opacity: 0.6 },
          { type: 'camera-zoom', scale: 1.04, duration: 500 },
          { type: 'hit-stop', duration: 60 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 4, origin: 'defender', spread: 60, duration: 500, gravity: -1, fadeOut: true, scale: [0.3, 0.6], rotation: true },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 300 },
    ],
  },

  // ── Quick Attack ──
  {
    moveId: 'quick-attack',
    phases: [
      { type: 'audio', moveName: 'Quick Attack' },
      {
        type: 'parallel',
        phases: [
          { type: 'afterimage', target: 'attacker', count: 3, duration: 200 },
          { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 120, easing: 'easeInQuad' },
        ],
      },
      { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender' },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 150 },
    ],
  },

  // ── Rapid Spin ──
  {
    moveId: 'rapid-spin',
    phases: [
      { type: 'audio', moveName: 'Rapid Spin' },
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'flip', duration: 500 },
          { type: 'spritesheet', sheet: SHEETS.wind, at: 'attacker', blend: 'lighter', scale: 1.3 },
        ],
      },
    ],
  },

  // ── Double-Edge ──
  {
    moveId: 'double-edge',
    phases: [
      { type: 'audio', moveName: 'Double-Edge' },
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 350, easing: 'easeInQuad' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.5 },
          { type: 'camera-zoom', scale: 1.05, duration: 500 },
          { type: 'screen-flash', color: '#ffffff', duration: 150, opacity: 0.5 },
          { type: 'hit-stop', duration: 60 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 300 },
      { type: 'sprite-move', target: 'attacker', motion: 'recoil', duration: 300 },
    ],
  },

  // ── Dual Wingbeat ──
  {
    moveId: 'dual-wingbeat',
    phases: [
      // First hit
      { type: 'audio', moveName: 'Dual Wingbeat' },
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 200, easing: 'easeInBack' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.wind, at: 'defender', scale: 1.1 },
          { type: 'particles', image: './fx/feather.png', count: 3, origin: 'defender', spread: 30, duration: 300, gravity: 1, fadeOut: true, scale: [0.3, 0.6] },
          { type: 'camera-zoom', scale: 1.02, duration: 300 },
        ],
      },
      { type: 'pause', duration: 100 },
      // Second hit
      { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 200, easing: 'easeInBack' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.wind, at: 'defender', scale: 1.2, offset: { x: -10, y: 5 } },
          { type: 'particles', image: './fx/feather.png', count: 4, origin: 'defender', spread: 40, duration: 400, gravity: 1, fadeOut: true, scale: [0.3, 0.7] },
          { type: 'camera-zoom', scale: 1.03, duration: 350 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 250 },
    ],
  },

  // ── Pursuit ──
  {
    moveId: 'pursuit',
    phases: [
      { type: 'audio', moveName: 'Pursuit' },
      {
        type: 'parallel',
        phases: [
          { type: 'afterimage', target: 'attacker', count: 5, duration: 250 },
          { type: 'sprite-move', target: 'attacker', motion: 'lunge', duration: 100, easing: 'easeInQuad' },
          { type: 'color-grade', color: '#1a0a2e', opacity: 0.15, duration: 400 },
        ],
      },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', tint: '#2a0040' },
          { type: 'hit-stop', duration: 50 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 250 },
    ],
  },

  // ── Earthquake ──
  {
    moveId: 'earthquake',
    phases: [
      { type: 'audio', moveName: 'Earthquake' },
      {
        type: 'parallel',
        phases: [
          { type: 'screen-shake', intensity: 12, duration: 800, axis: 'both' },
          { type: 'camera-zoom', scale: 1.03, duration: 800 },
          { type: 'color-grade', color: '#8B7355', opacity: 0.06, duration: 800 },
          { type: 'particles', image: './fx/rock.png', count: 8, origin: 'screen', spread: 200, duration: 800, gravity: -4, fadeOut: true, scale: [0.4, 1.0], rotation: true, velocity: { x: [-3, 3], y: [-6, -2] } },
        ],
      },
    ],
  },

  // ── Rock Slide ──
  {
    moveId: 'rock-slide',
    phases: [
      { type: 'audio', moveName: 'Rock Slide' },
      // Rock falls from above onto defender
      { type: 'projectile', image: './fx/rock.png', from: 'screen', to: 'defender', duration: 300, scale: 2.0 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.rock, at: 'defender', scale: 1.2 },
          { type: 'screen-shake', intensity: 6, duration: 300, axis: 'y' },
          { type: 'camera-zoom', scale: 1.02, duration: 400 },
        ],
      },
      // Debris scatters outward from impact
      { type: 'particles', image: './fx/rock.png', count: 3, origin: 'defender', spread: 30, duration: 300, gravity: 2, fadeOut: true, scale: [0.2, 0.5], rotation: true, velocity: { x: [-3, 3], y: [-4, -1] } },
    ],
  },

  // ── Rock Blast (per-hit animation used for multi-hit) ──
  {
    moveId: 'rock-blast',
    phases: [
      { type: 'audio', moveName: 'Rock Blast 1hit' },
      { type: 'projectile', image: './fx/rock.png', from: 'attacker', to: 'defender', duration: 250, scale: 1.5, trail: true, trailCount: 2, arc: 30 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.rock, at: 'defender' },
          { type: 'hit-stop', duration: 30 },
        ],
      },
      { type: 'particles', image: './fx/rock.png', count: 2, origin: 'defender', spread: 30, duration: 300, gravity: 3, fadeOut: true, scale: [0.2, 0.5], rotation: true },
    ],
  },

  // ── Bullet Seed (per-hit) ──
  {
    moveId: 'bullet-seed',
    phases: [
      { type: 'audio', moveName: 'Bullet Seed 1hit' },
      { type: 'projectile', image: './fx/greenmetal1.png', from: 'attacker', to: 'defender', duration: 150, scale: 1.0 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.leaf, at: 'defender', scale: 0.8 },
          { type: 'screen-shake', intensity: 2, duration: 100 },
        ],
      },
      { type: 'particles', image: './fx/greenmetal2.png', count: 2, origin: 'defender', spread: 20, duration: 250, gravity: 2, fadeOut: true, scale: [0.3, 0.6] },
    ],
  },

  // ── Icicle Spear (per-hit) ──
  {
    moveId: 'icicle-spear',
    phases: [
      { type: 'audio', moveName: 'Icicle Spear 1hit' },
      { type: 'projectile', image: './fx/shard.png', from: 'attacker', to: 'defender', duration: 200, scale: 0.5, trail: true, trailCount: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.ice, at: 'defender' },
          { type: 'camera-zoom', scale: 1.01, duration: 250 },
          { type: 'screen-flash', color: '#aaddff', duration: 100, opacity: 0.2 },
        ],
      },
      { type: 'particles', image: './fx/shard.png', count: 2, origin: 'defender', spread: 25, duration: 300, gravity: 2, fadeOut: true, scale: [0.2, 0.4], rotation: true },
    ],
  },
];
