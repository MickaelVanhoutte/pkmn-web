import type { MoveAnimationDef } from '../types';
import { SHEETS } from '../types';

export const specialMoves: MoveAnimationDef[] = [
  // ── Flamethrower ──
  {
    moveId: 'flamethrower',
    phases: [
      { type: 'audio', moveName: 'Flamethrower' },
      {
        type: 'parallel',
        phases: [
          { type: 'lighting', color: '#ff6600', at: 'attacker', radius: 150, intensity: 0.4, duration: 600 },
          { type: 'color-grade', color: '#ff4400', opacity: 0.08, duration: 800 },
          { type: 'sprite-move', target: 'attacker', motion: 'hop', duration: 200 },
        ],
      },
      { type: 'projectile', image: './fx/fire-sprite.png', sheet: SHEETS.fire, from: 'attacker', to: 'defender', duration: 350, scale: 0.6, trail: true, trailCount: 3, blend: 'lighter' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.fire, at: 'defender', scale: 1.3, blend: 'lighter' },
          { type: 'particles', image: './fx/shine.png', count: 4, origin: 'defender', spread: 50, duration: 600, gravity: -2, fadeOut: true, scale: [0.3, 0.6], blend: 'lighter' },
          { type: 'screen-flash', color: '#ff6600', duration: 200, opacity: 0.3 },
          { type: 'camera-zoom', scale: 1.03, duration: 500 },
          { type: 'lighting', color: '#ff4400', at: 'defender', radius: 180, intensity: 0.5, duration: 500 },
        ],
      },
    ],
  },

  // ── Surf ──
  {
    moveId: 'surf',
    phases: [
      { type: 'audio', moveName: 'Surf' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.water, at: 'defender', scale: 1.8 },
          { type: 'color-grade', color: '#2060cc', opacity: 0.08, duration: 800 },
          { type: 'camera-zoom', scale: 1.02, duration: 600 },
          { type: 'lighting', color: '#4488ff', at: 'defender', radius: 200, intensity: 0.3, duration: 700 },
        ],
      },
      { type: 'particles', image: './fx/elements/water.png', count: 4, origin: 'defender', spread: 80, duration: 500, gravity: 3, fadeOut: true, scale: [0.2, 0.5] },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 250 },
    ],
  },

  // ── Thunderbolt ──
  {
    moveId: 'thunderbolt',
    phases: [
      { type: 'audio', moveName: 'Thunderbolt' },
      { type: 'screen-flash', color: '#ffff00', duration: 80, opacity: 0.5 },
      { type: 'pause', duration: 50 },
      { type: 'screen-flash', color: '#ffff00', duration: 80, opacity: 0.4 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.thunder, at: 'defender', blend: 'lighter', scale: 1.3 },
          { type: 'lighting', color: '#ffee00', at: 'defender', radius: 180, intensity: 0.6, duration: 400 },
          { type: 'camera-zoom', scale: 1.04, duration: 400 },
          { type: 'hit-stop', duration: 50 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 5, origin: 'defender', spread: 60, duration: 500, gravity: 0, drag: 0.03, fadeOut: true, scale: [0.2, 0.5], blend: 'lighter' },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 200 },
    ],
  },

  // ── Energy Ball ──
  {
    moveId: 'energy-ball',
    phases: [
      { type: 'audio', moveName: 'Energy Ball' },
      { type: 'sprite-move', target: 'attacker', motion: 'hop', duration: 200 },
      { type: 'projectile', image: './fx/lightball-sprite.png', sheet: SHEETS.lightball, from: 'attacker', to: 'defender', duration: 350, scale: 0.5, trail: true, trailCount: 3, blend: 'lighter', tint: '#44cc44' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.leaf, at: 'defender', scale: 1.3 },
          { type: 'screen-flash', color: '#44cc44', duration: 150, opacity: 0.3 },
          { type: 'lighting', color: '#44cc44', at: 'defender', radius: 150, intensity: 0.4, duration: 400 },
        ],
      },
      { type: 'particles', image: './fx/petal.png', count: 4, origin: 'defender', spread: 50, duration: 500, gravity: 1, fadeOut: true, scale: [0.3, 0.6], rotation: true },
    ],
  },

  // ── Ice Beam ──
  {
    moveId: 'ice-beam',
    phases: [
      { type: 'audio', moveName: 'Ice Beam' },
      {
        type: 'parallel',
        phases: [
          { type: 'projectile', image: './fx/beam.png', from: 'attacker', to: 'defender', duration: 300, scale: 0.6, trail: true, trailCount: 3, blend: 'lighter', tint: '#88ddff' },
          { type: 'lighting', color: '#66ccff', at: 'attacker', radius: 100, intensity: 0.3, duration: 400 },
          { type: 'color-grade', color: '#88ccff', opacity: 0.05, duration: 600 },
        ],
      },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.ice, at: 'defender', scale: 1.3 },
          { type: 'camera-zoom', scale: 1.03, duration: 400 },
          { type: 'screen-flash', color: '#aaddff', duration: 150, opacity: 0.3 },
        ],
      },
      { type: 'particles', image: './fx/shard.png', count: 4, origin: 'defender', spread: 50, duration: 600, gravity: 0.5, drag: 0.01, fadeOut: true, scale: [0.2, 0.5], rotation: true },
    ],
  },

  // ── Sludge Bomb ──
  {
    moveId: 'sludge-bomb',
    phases: [
      { type: 'audio', moveName: 'Sludge Bomb' },
      { type: 'sprite-move', target: 'attacker', motion: 'hop', duration: 200 },
      { type: 'projectile', image: './fx/poison-sprite.png', sheet: SHEETS.poison, from: 'attacker', to: 'defender', duration: 350, scale: 0.5, arc: 40, trail: true, trailCount: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.poison, at: 'defender', scale: 1.3 },
          { type: 'screen-flash', color: '#9933cc', duration: 150, opacity: 0.3 },
          { type: 'camera-zoom', scale: 1.02, duration: 400 },
        ],
      },
      { type: 'particles', image: './fx/poisoncaltrop.png', count: 3, origin: 'defender', spread: 40, duration: 500, gravity: 2, fadeOut: true, scale: [0.3, 0.7] },
    ],
  },

  // ── Air Slash ──
  {
    moveId: 'air-slash',
    phases: [
      { type: 'audio', moveName: 'Air Slash' },
      { type: 'projectile', image: './fx/wind-sprite.png', sheet: SHEETS.wind, from: 'attacker', to: 'defender', duration: 250, scale: 0.4, arc: 15 },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.slash, at: 'defender', scale: 1.2 },
          { type: 'particles', image: './fx/feather.png', count: 3, origin: 'defender', spread: 50, duration: 500, gravity: 0.5, fadeOut: true, scale: [0.3, 0.6], rotation: true },
          { type: 'screen-flash', color: '#ffffff', duration: 100, opacity: 0.2 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 200 },
    ],
  },

  // ── Psychic ──
  {
    moveId: 'psychic',
    phases: [
      { type: 'audio', moveName: 'Psychic' },
      {
        type: 'parallel',
        phases: [
          { type: 'color-grade', color: '#ff66cc', opacity: 0.1, duration: 800 },
          { type: 'screen-shake', intensity: 3, duration: 600 },
        ],
      },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.debuff, at: 'defender', scale: 1.3, tint: '#ff66cc' },
          { type: 'lighting', color: '#ff44bb', at: 'defender', radius: 150, intensity: 0.5, duration: 500 },
          { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 500 },
        ],
      },
      { type: 'camera-zoom', scale: 1.03, duration: 400 },
    ],
  },

  // ── Shadow Ball ──
  {
    moveId: 'shadow-ball',
    phases: [
      { type: 'audio', moveName: 'Shadow Ball' },
      { type: 'sprite-move', target: 'attacker', motion: 'hop', duration: 200 },
      { type: 'projectile', image: './fx/shadowball-sprite.png', sheet: SHEETS.shadowball, from: 'attacker', to: 'defender', duration: 350, scale: 0.5, trail: true, trailCount: 3, blend: 'lighter' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.3, tint: '#6622aa' },
          { type: 'lighting', color: '#6622aa', at: 'defender', radius: 160, intensity: 0.5, duration: 400 },
          { type: 'screen-flash', color: '#4400aa', duration: 150, opacity: 0.3 },
          { type: 'hit-stop', duration: 50 },
          { type: 'camera-zoom', scale: 1.03, duration: 400 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 3, origin: 'defender', spread: 50, duration: 500, gravity: -1, fadeOut: true, scale: [0.3, 0.5], blend: 'lighter' },
    ],
  },

  // ── Dragon Pulse ──
  {
    moveId: 'dragon-pulse',
    phases: [
      { type: 'audio', moveName: 'Dragon Pulse' },
      { type: 'sprite-move', target: 'attacker', motion: 'hop', duration: 200 },
      { type: 'projectile', image: './fx/lightball-sprite.png', sheet: SHEETS.lightball, from: 'attacker', to: 'defender', duration: 300, scale: 0.6, trail: true, trailCount: 3, blend: 'lighter', tint: '#4466dd' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.4, tint: '#4466dd' },
          { type: 'screen-flash', color: '#4466dd', duration: 150, opacity: 0.35 },
          { type: 'camera-zoom', scale: 1.04, duration: 500 },
          { type: 'hit-stop', duration: 50 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 5, origin: 'defender', spread: 60, duration: 500, gravity: -1, fadeOut: true, scale: [0.3, 0.6], rotation: true, blend: 'lighter' },
    ],
  },

  // ── Dark Pulse ──
  {
    moveId: 'dark-pulse',
    phases: [
      { type: 'audio', moveName: 'Dark Pulse' },
      {
        type: 'parallel',
        phases: [
          { type: 'color-grade', color: '#1a0a2e', opacity: 0.12, duration: 600 },
          { type: 'screen-shake', intensity: 3, duration: 400 },
        ],
      },
      { type: 'projectile', image: './fx/shadowball-sprite.png', sheet: SHEETS.shadowball, from: 'attacker', to: 'defender', duration: 300, scale: 0.5, trail: true, trailCount: 3, blend: 'lighter' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.3, tint: '#1a0a2e' },
          { type: 'hit-stop', duration: 50 },
          { type: 'camera-zoom', scale: 1.03, duration: 400 },
        ],
      },
      { type: 'screen-flash', color: '#000000', duration: 150, opacity: 0.4 },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 250 },
    ],
  },

  // ── Moonblast ──
  {
    moveId: 'moonblast',
    phases: [
      { type: 'audio', moveName: 'Moonblast' },
      {
        type: 'parallel',
        phases: [
          { type: 'projectile', image: './fx/moon.png', from: 'screen', to: 'defender', duration: 100, scale: 0.8 },
          { type: 'lighting', color: '#ff88cc', at: 'screen', radius: 250, intensity: 0.3, duration: 800 },
          { type: 'color-grade', color: '#ff88cc', opacity: 0.08, duration: 800 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 6, origin: 'defender', spread: 80, duration: 600, gravity: 2, fadeOut: true, scale: [0.3, 0.7], rotation: true, blend: 'lighter' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.3, tint: '#ff88cc' },
          { type: 'screen-flash', color: '#ff88cc', duration: 200, opacity: 0.35 },
          { type: 'camera-zoom', scale: 1.03, duration: 400 },
        ],
      },
    ],
  },

  // ── Giga Drain ──
  {
    moveId: 'giga-drain',
    phases: [
      { type: 'audio', moveName: 'Giga Drain' },
      { type: 'spritesheet', sheet: SHEETS.drain, at: 'defender', tint: '#44cc44' },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/petal.png', count: 5, origin: 'defender', spread: 60, duration: 600, gravity: -1, fadeOut: true, scale: [0.3, 0.5], rotation: true, velocity: { x: [-3, 0], y: [-3, -1] } },
          { type: 'lighting', color: '#44cc44', at: 'attacker', radius: 120, intensity: 0.4, duration: 600 },
          { type: 'color-grade', color: '#44cc44', opacity: 0.05, duration: 600 },
        ],
      },
      { type: 'spritesheet', sheet: SHEETS.heal, at: 'attacker', scale: 0.8 },
    ],
  },

  // ── Solar Beam (strike phase — charge is separate via 'charging' event) ──
  {
    moveId: 'solar-beam',
    phases: [
      { type: 'audio', moveName: 'Solar Beam' },
      {
        type: 'parallel',
        phases: [
          { type: 'lighting', color: '#ffdd00', at: 'attacker', radius: 200, intensity: 0.6, duration: 400 },
          { type: 'camera-zoom', scale: 1.02, duration: 300 },
        ],
      },
      { type: 'projectile', image: './fx/beam.png', from: 'attacker', to: 'defender', duration: 250, scale: 1.0, trail: true, trailCount: 5, blend: 'lighter', tint: '#ccff44' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.5, tint: '#ccff44' },
          { type: 'screen-flash', color: '#ffffff', duration: 200, opacity: 0.5 },
          { type: 'camera-zoom', scale: 1.06, duration: 500 },
          { type: 'hit-stop', duration: 80 },
          { type: 'lighting', color: '#ffdd00', at: 'defender', radius: 200, intensity: 0.6, duration: 500 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 5, origin: 'defender', spread: 80, duration: 600, gravity: -1, fadeOut: true, scale: [0.3, 0.7], rotation: true, blend: 'lighter' },
    ],
  },
];
