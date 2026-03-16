import type { MoveAnimationDef } from '../types';
import { SHEETS } from '../types';

export const statusMoves: MoveAnimationDef[] = [
  // ── Protect ──
  {
    moveId: 'protect',
    phases: [
      { type: 'audio', moveName: 'Protect' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.buff, at: 'attacker', tint: '#44cc44', scale: 1.3 },
          { type: 'color-grade', color: '#44cc44', opacity: 0.1, duration: 500 },
          { type: 'lighting', color: '#44cc44', at: 'attacker', radius: 120, intensity: 0.4, duration: 600 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 6, origin: 'attacker', spread: 40, duration: 500, gravity: -1, fadeOut: true, scale: [0.2, 0.4], blend: 'lighter' },
    ],
  },

  // ── Stealth Rock ──
  {
    moveId: 'stealth-rock',
    phases: [
      { type: 'audio', moveName: 'Stealth Rock' },
      { type: 'particles', image: './fx/rock.png', count: 4, origin: 'attacker', spread: 30, duration: 600, gravity: -2, fadeOut: false, scale: [0.4, 0.8], rotation: true, velocity: { x: [2, 5], y: [-4, -1] } },
      { type: 'pause', duration: 200 },
      { type: 'particles', image: './fx/rock.png', count: 3, origin: 'defender', spread: 60, duration: 300, gravity: 1, fadeOut: true, scale: [0.3, 0.6], rotation: true, velocity: { x: [-1, 1], y: [-2, 0] } },
    ],
  },

  // ── Spikes ──
  {
    moveId: 'spikes',
    phases: [
      { type: 'audio', moveName: 'Spikes' },
      { type: 'particles', image: './fx/caltrop.png', count: 5, origin: 'defender', spread: 80, duration: 350, gravity: 2, fadeOut: false, scale: [0.4, 0.7], velocity: { x: [-2, 2], y: [-2, 0] } },
    ],
  },

  // ── Recover ──
  {
    moveId: 'recover',
    phases: [
      { type: 'audio', moveName: 'Recover', part: 1 },
      { type: 'pause', duration: 300 },
      { type: 'audio', moveName: 'Recover' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.heal, at: 'attacker', scale: 1.2 },
          { type: 'lighting', color: '#44ee44', at: 'attacker', radius: 130, intensity: 0.4, duration: 600 },
          { type: 'color-grade', color: '#44ee44', opacity: 0.08, duration: 600 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 4, origin: 'attacker', spread: 40, duration: 500, gravity: -2, fadeOut: true, scale: [0.3, 0.6], blend: 'lighter' },
    ],
  },

  // ── Swords Dance ──
  {
    moveId: 'swords-dance',
    phases: [
      { type: 'audio', moveName: 'Swords Dance' },
      { type: 'particles', image: './fx/sword.png', count: 2, origin: 'attacker', spread: 30, duration: 800, gravity: 0, drag: 0.01, fadeOut: true, scale: [0.5, 0.8], rotation: true, velocity: { x: [-2, 2], y: [-2, 2] } },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.buff, at: 'attacker', tint: '#ff4444' },
          { type: 'camera-zoom', scale: 1.02, duration: 400 },
          { type: 'color-grade', color: '#ff4444', opacity: 0.08, duration: 500 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 3, origin: 'attacker', spread: 30, duration: 400, gravity: -2, fadeOut: true, scale: [0.2, 0.4], blend: 'lighter' },
    ],
  },

  // ── Will-O-Wisp ──
  {
    moveId: 'will-o-wisp',
    phases: [
      { type: 'audio', moveName: 'Will-O-Wisp', part: 1 },
      { type: 'particles', image: './fx/shine.png', count: 3, origin: 'attacker', spread: 20, duration: 400, gravity: -1, fadeOut: true, scale: [0.3, 0.5], blend: 'lighter' },
      { type: 'audio', moveName: 'Will-O-Wisp' },
      { type: 'projectile', image: './fx/fire-sprite.png', sheet: SHEETS.fire, from: 'attacker', to: 'defender', duration: 500, scale: 0.3, trail: true, trailCount: 2, arc: 20, blend: 'lighter' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.fire, at: 'defender', scale: 0.8, blend: 'lighter' },
          { type: 'lighting', color: '#ff6600', at: 'defender', radius: 100, intensity: 0.3, duration: 400 },
        ],
      },
    ],
  },

  // ── Thunder Wave ──
  {
    moveId: 'thunder-wave',
    phases: [
      { type: 'audio', moveName: 'Thunder Wave', part: 1 },
      { type: 'pause', duration: 200 },
      { type: 'audio', moveName: 'Thunder Wave' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.thunderball, at: 'defender', scale: 1.0, blend: 'lighter' },
          { type: 'spritesheet', sheet: SHEETS.thunder, at: 'defender', scale: 0.8, blend: 'lighter' },
          { type: 'particles', image: './fx/shine.png', count: 4, origin: 'defender', spread: 40, duration: 400, gravity: 0, fadeOut: true, scale: [0.2, 0.4], blend: 'lighter' },
          { type: 'lighting', color: '#ffee00', at: 'defender', radius: 120, intensity: 0.4, duration: 400 },
        ],
      },
    ],
  },

  // ── Rain Dance ──
  // Persistent weather effect starts immediately; audio plays alongside
  {
    moveId: 'rain-dance',
    phases: [
      { type: 'start-weather', weather: 'rain' },
      { type: 'audio', moveName: 'Rain Dance', part: 1 },
      { type: 'pause', duration: 200 },
      { type: 'audio', moveName: 'Rain Dance', part: 2 },
      { type: 'pause', duration: 300 },
      { type: 'audio', moveName: 'Rain Dance' },
    ],
  },

  // ── Sunny Day ──
  {
    moveId: 'sunny-day',
    phases: [
      { type: 'start-weather', weather: 'sun' },
      { type: 'audio', moveName: 'Sunny Day' },
    ],
  },

  // ── Sandstorm ──
  {
    moveId: 'sandstorm',
    phases: [
      { type: 'start-weather', weather: 'sandstorm' },
      { type: 'audio', moveName: 'Sandstorm', part: 1 },
      { type: 'audio', moveName: 'Sandstorm', part: 2 },
      { type: 'pause', duration: 300 },
      { type: 'audio', moveName: 'Sandstorm' },
    ],
  },

  // ── Hail ──
  {
    moveId: 'hail',
    phases: [
      { type: 'start-weather', weather: 'hail' },
      { type: 'audio', moveName: 'Hail' },
    ],
  },

  // ── Light Screen ──
  {
    moveId: 'light-screen',
    phases: [
      { type: 'audio', moveName: 'Light Screen' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.buff, at: 'attacker', scale: 1.5, tint: '#ffcc44' },
          { type: 'color-grade', color: '#ffcc44', opacity: 0.08, duration: 600 },
          { type: 'lighting', color: '#ffcc44', at: 'attacker', radius: 180, intensity: 0.4, duration: 600 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 4, origin: 'attacker', spread: 60, duration: 500, gravity: -1, fadeOut: true, scale: [0.3, 0.5], blend: 'lighter' },
    ],
  },

  // ── Reflect ──
  {
    moveId: 'reflect',
    phases: [
      { type: 'audio', moveName: 'Reflect' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.buff, at: 'attacker', scale: 1.5, tint: '#4488ff' },
          { type: 'color-grade', color: '#4488ff', opacity: 0.08, duration: 600 },
          { type: 'lighting', color: '#4488ff', at: 'attacker', radius: 180, intensity: 0.4, duration: 600 },
        ],
      },
      { type: 'particles', image: './fx/shine.png', count: 4, origin: 'attacker', spread: 60, duration: 500, gravity: -1, fadeOut: true, scale: [0.3, 0.5], blend: 'lighter' },
    ],
  },

  // ── Substitute ──
  // Move animation only slides the pokemon off-screen.
  // The sprite swap + slide-in is handled by the battle controller on substitute-created.
  {
    moveId: 'substitute',
    phases: [
      { type: 'audio', moveName: 'Substitute' },
      { type: 'sprite-move', target: 'attacker', motion: 'slide-out', duration: 350 },
    ],
  },

  // ── Substitute appear (played after sprite swap to substitute) ──
  {
    moveId: 'substitute-appear',
    phases: [
      { type: 'sprite-move', target: 'attacker', motion: 'slide-in', duration: 350 },
    ],
  },

  // ── Substitute break (played when substitute HP reaches 0) ──
  // Slides substitute off, then controller swaps sprite, then slides pokemon back.
  {
    moveId: 'substitute-break-out',
    phases: [
      { type: 'sprite-move', target: 'defender', motion: 'slide-out', duration: 300 },
    ],
  },
  {
    moveId: 'substitute-break-in',
    phases: [
      { type: 'sprite-move', target: 'defender', motion: 'slide-in', duration: 300 },
    ],
  },

  // ── Confuse Ray ──
  {
    moveId: 'confuse-ray',
    phases: [
      { type: 'audio', moveName: 'Confuse Ray', part: 1 },
      { type: 'pause', duration: 200 },
      { type: 'audio', moveName: 'Confuse Ray' },
      { type: 'projectile', image: './fx/lightball-sprite.png', sheet: SHEETS.lightball, from: 'attacker', to: 'defender', duration: 500, scale: 0.4, trail: true, trailCount: 3, arc: 30, blend: 'lighter', tint: '#aa44ff' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.lightball, at: 'defender', scale: 0.8, tint: '#aa44ff', blend: 'lighter' },
          { type: 'lighting', color: '#aa44ff', at: 'defender', radius: 120, intensity: 0.4, duration: 500 },
        ],
      },
    ],
  },

  // ── Fly (charge phase) ──
  // Note: This is used for the 'charging' event. The strike uses 'fly-strike' below.
  {
    moveId: 'fly-charge',
    phases: [
      { type: 'audio', moveName: 'Fly', part: 1 },
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'fly-up', duration: 500 },
          { type: 'afterimage', target: 'attacker', count: 4, duration: 500 },
          { type: 'particles', image: './fx/feather.png', count: 3, origin: 'attacker', spread: 40, duration: 500, gravity: -2, fadeOut: true, scale: [0.3, 0.6], rotation: true },
        ],
      },
    ],
  },

  // ── Fly (strike phase) ──
  {
    moveId: 'fly',
    phases: [
      { type: 'audio', moveName: 'Fly', part: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'sprite-move', target: 'attacker', motion: 'fly-down', duration: 300 },
          { type: 'afterimage', target: 'attacker', count: 4, duration: 300 },
        ],
      },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.impact, at: 'defender', scale: 1.4 },
          { type: 'camera-zoom', scale: 1.05, duration: 500 },
          { type: 'screen-shake', intensity: 8, duration: 300 },
          { type: 'hit-stop', duration: 60 },
        ],
      },
      { type: 'sprite-move', target: 'defender', motion: 'shake', duration: 300 },
      { type: 'particles', image: './fx/feather.png', count: 3, origin: 'defender', spread: 50, duration: 400, gravity: 1, fadeOut: true, scale: [0.3, 0.6], rotation: true },
    ],
  },

  // ── Solar Beam (charge phase) ──
  {
    moveId: 'solar-beam-charge',
    phases: [
      { type: 'audio', moveName: 'Solar Beam', part: 1 },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/shine.png', count: 6, origin: 'attacker', spread: 100, duration: 800, gravity: 0, drag: 0.02, fadeOut: false, scale: [0.3, 0.6], blend: 'lighter', velocity: { x: [-1, 1], y: [-1, 1] } },
          { type: 'lighting', color: '#ffdd00', at: 'attacker', radius: 150, intensity: 0.5, duration: 800 },
          { type: 'camera-zoom', scale: 1.02, duration: 800 },
        ],
      },
    ],
  },

  // ── Whirlwind ──
  {
    moveId: 'whirlwind',
    phases: [
      { type: 'audio', moveName: 'Whirlwind' },
      {
        type: 'parallel',
        phases: [
          { type: 'spritesheet', sheet: SHEETS.wind, at: 'defender', scale: 1.5 },
          { type: 'particles', image: './fx/feather.png', count: 4, origin: 'defender', spread: 80, duration: 600, gravity: 0, drag: 0.01, fadeOut: true, scale: [0.3, 0.6], rotation: true, velocity: { x: [2, 5], y: [-2, 2] } },
          { type: 'screen-shake', intensity: 4, duration: 400, axis: 'x' },
        ],
      },
    ],
  },

  // ── Roar ──
  {
    moveId: 'roar',
    phases: [
      { type: 'audio', moveName: 'Roar' },
      {
        type: 'parallel',
        phases: [
          { type: 'screen-shake', intensity: 6, duration: 500 },
          { type: 'camera-zoom', scale: 1.03, duration: 500 },
          { type: 'particles', image: './fx/feather.png', count: 3, origin: 'attacker', spread: 40, duration: 500, gravity: 0, fadeOut: true, scale: [0.4, 0.8], velocity: { x: [3, 6], y: [-1, 1] } },
        ],
      },
    ],
  },

  // ── Electric Terrain ──
  {
    moveId: 'electric-terrain',
    phases: [
      { type: 'audio', moveName: 'Electric Terrain', part: 1 },
      { type: 'audio', moveName: 'Electric Terrain', part: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/shine.png', count: 8, origin: 'screen', spread: 300, duration: 800, gravity: -1, fadeOut: true, scale: [0.2, 0.5], blend: 'lighter', velocity: { x: [-1, 1], y: [-2, 0] } },
          { type: 'color-grade', color: '#ffee44', opacity: 0.05, duration: 800 },
          { type: 'lighting', color: '#ffee00', at: 'screen', radius: 300, intensity: 0.3, duration: 800 },
        ],
      },
      { type: 'start-terrain', terrain: 'electric' },
      { type: 'audio', moveName: 'Electric Terrain' },
    ],
  },

  // ── Grassy Terrain ──
  {
    moveId: 'grassy-terrain',
    phases: [
      { type: 'audio', moveName: 'Grassy Terrain', part: 1 },
      { type: 'audio', moveName: 'Grassy Terrain', part: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/petal.png', count: 8, origin: 'screen', spread: 300, duration: 800, gravity: -1, fadeOut: true, scale: [0.3, 0.6], rotation: true, velocity: { x: [-1, 1], y: [-2, 0] } },
          { type: 'particles', image: './fx/elements/grass.png', count: 4, origin: 'screen', spread: 250, duration: 800, gravity: -1, fadeOut: true, scale: [0.15, 0.3] },
          { type: 'color-grade', color: '#44cc44', opacity: 0.05, duration: 800 },
          { type: 'lighting', color: '#44cc44', at: 'screen', radius: 300, intensity: 0.3, duration: 800 },
        ],
      },
      { type: 'start-terrain', terrain: 'grassy' },
      { type: 'audio', moveName: 'Grassy Terrain' },
    ],
  },

  // ── Psychic Terrain ──
  {
    moveId: 'psychic-terrain',
    phases: [
      { type: 'audio', moveName: 'Psychic Terrain', part: 1 },
      { type: 'audio', moveName: 'Psychic Terrain', part: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/shine.png', count: 8, origin: 'screen', spread: 300, duration: 800, gravity: -1, fadeOut: true, scale: [0.2, 0.5], blend: 'lighter', velocity: { x: [-1, 1], y: [-2, 0] } },
          { type: 'color-grade', color: '#ff66cc', opacity: 0.06, duration: 800 },
          { type: 'lighting', color: '#ff66cc', at: 'screen', radius: 300, intensity: 0.3, duration: 800 },
        ],
      },
      { type: 'start-terrain', terrain: 'psychic' },
      { type: 'audio', moveName: 'Psychic Terrain' },
    ],
  },

  // ── Misty Terrain ──
  {
    moveId: 'misty-terrain',
    phases: [
      { type: 'audio', moveName: 'Misty Terrain', part: 1 },
      { type: 'audio', moveName: 'Misty Terrain', part: 2 },
      {
        type: 'parallel',
        phases: [
          { type: 'particles', image: './fx/elements/water.png', count: 6, origin: 'screen', spread: 300, duration: 800, gravity: -1, fadeOut: true, scale: [0.15, 0.3], velocity: { x: [-1, 1], y: [-2, 0] } },
          { type: 'color-grade', color: '#ff88cc', opacity: 0.05, duration: 800 },
          { type: 'lighting', color: '#ff88cc', at: 'screen', radius: 300, intensity: 0.25, duration: 800 },
        ],
      },
      { type: 'start-terrain', terrain: 'misty' },
      { type: 'audio', moveName: 'Misty Terrain' },
    ],
  },
];
