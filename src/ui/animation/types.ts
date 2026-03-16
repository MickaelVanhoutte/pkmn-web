import type { PlayerIndex } from '@/types/common';

// ── Geometry ──

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface BattlePosition {
  player: PlayerIndex;
  slot: number;
}

// ── Asset references ──

export interface SpritesheetRef {
  src: string;
  frameSize: number; // width & height of each frame (192 for all FX sheets)
  frameCount: number;
  fps?: number; // default 12
}

// ── Targets ──

export type AnimTarget = 'attacker' | 'defender' | 'center' | 'screen';

// ── Phase types (discriminated union) ──

export interface SpriteMovementPhase {
  type: 'sprite-move';
  target: 'attacker' | 'defender';
  motion: 'lunge' | 'recoil' | 'hop' | 'shake' | 'fly-up' | 'fly-down' | 'spin' | 'flip' | 'slide-out' | 'slide-in';
  duration: number;
  easing?: string;
}

export interface SpritesheetPhase {
  type: 'spritesheet';
  sheet: SpritesheetRef;
  at: AnimTarget;
  scale?: number;
  tint?: string;
  blend?: GlobalCompositeOperation;
  loops?: number;
  offset?: CanvasPoint;
}

export interface ProjectilePhase {
  type: 'projectile';
  image: string;
  from: AnimTarget;
  to: AnimTarget;
  duration: number;
  scale?: number;
  tint?: string;
  trail?: boolean;
  trailCount?: number;
  arc?: number; // arc height in px (positive = upward arc)
  blend?: GlobalCompositeOperation;
  /** When set, the projectile animates through spritesheet frames while flying. */
  sheet?: SpritesheetRef;
}

export interface ParticlesPhase {
  type: 'particles';
  image: string;
  count: number;
  origin: AnimTarget;
  spread: number;
  duration: number;
  gravity?: number;
  drag?: number;
  fadeOut?: boolean;
  scale?: [number, number]; // [min, max]
  rotation?: boolean;
  blend?: GlobalCompositeOperation;
  velocity?: { x?: [number, number]; y?: [number, number] };
}

export interface ScreenFlashPhase {
  type: 'screen-flash';
  color: string;
  duration: number;
  opacity?: number;
}

export interface ScreenShakePhase {
  type: 'screen-shake';
  intensity: number;
  duration: number;
  axis?: 'x' | 'y' | 'both';
}

export interface CameraZoomPhase {
  type: 'camera-zoom';
  scale: number;
  duration: number;
  easing?: string;
}

export interface LightingPhase {
  type: 'lighting';
  color: string;
  at: AnimTarget;
  radius: number;
  intensity: number;
  duration: number;
}

export interface ColorGradePhase {
  type: 'color-grade';
  color: string;
  opacity: number;
  duration: number;
}

export interface HitStopPhase {
  type: 'hit-stop';
  duration: number;
}

export interface AfterimagePhase {
  type: 'afterimage';
  target: 'attacker' | 'defender';
  count: number;
  duration: number;
}

export interface AudioPhase {
  type: 'audio';
  moveName: string;
  part?: number;
}

export interface PausePhase {
  type: 'pause';
  duration: number;
}

export interface StartWeatherPhase {
  type: 'start-weather';
  weather: string;
}

export interface StartTerrainPhase {
  type: 'start-terrain';
  terrain: string;
}

export interface ParallelPhase {
  type: 'parallel';
  phases: AnimationPhase[];
}

export type AnimationPhase =
  | SpriteMovementPhase
  | SpritesheetPhase
  | ProjectilePhase
  | ParticlesPhase
  | ScreenFlashPhase
  | ScreenShakePhase
  | CameraZoomPhase
  | LightingPhase
  | ColorGradePhase
  | HitStopPhase
  | AfterimagePhase
  | AudioPhase
  | PausePhase
  | StartWeatherPhase
  | StartTerrainPhase
  | ParallelPhase;

// ── Top-level move definition ──

export interface MoveAnimationDef {
  moveId: string;
  phases: AnimationPhase[];
}

// ── Helpers for building definitions ──

export function sheet(
  name: string,
  frameCount: number,
  fps?: number,
): SpritesheetRef {
  return {
    src: `./fx/${name}-sprite.png`,
    frameSize: 192,
    frameCount,
    fps: fps ?? 12,
  };
}

// Pre-built spritesheet refs for convenience
export const SHEETS = {
  fire: sheet('fire', 8),
  water: sheet('water', 8),
  ice: sheet('ice', 6),
  thunder: sheet('thunder', 6),
  thunderball: sheet('thunderball', 6),
  lightball: sheet('lightball', 8),
  leaf: sheet('leaf', 6),
  vines: sheet('vines', 6),
  drain: sheet('drain', 8),
  shadowball: sheet('shadowball', 6),
  poison: sheet('poison', 9),
  rock: sheet('rock', 7),
  wind: sheet('wind', 8),
  slash: sheet('slash', 5),
  claws: sheet('claws', 8),
  crunch: sheet('crunch', 6),
  fist: sheet('fist', 5),
  foot: sheet('foot', 5),
  impact: sheet('impact', 4),
  heal: sheet('heal', 7),
  buff: sheet('buff', 6),
  debuff: sheet('debuff', 6),
  waterdrop: sheet('waterdrop', 3),
  chop: sheet('chop', 4),
} as const;
