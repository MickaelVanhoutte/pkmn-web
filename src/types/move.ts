import { TypeName, MoveCategory, MoveId, BattleStatName, MajorStatus } from './common';

export interface MoveData {
  id: MoveId;
  name: string;
  type: TypeName;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  contact: boolean;
  sound: boolean;
  target: MoveTarget;
  effects: MoveEffect[];
  flags: MoveFlags;
}

export type MoveTarget =
  | 'adjacent-foe'
  | 'all-adjacent-foes'
  | 'adjacent-ally'
  | 'self'
  | 'all-adjacent'
  | 'all-field'
  | 'foe-side'
  | 'ally-side';

export interface MoveEffect {
  type: MoveEffectType;
  chance: number;
  target: 'self' | 'target';
  value?: number;
  stat?: BattleStatName;
  status?: MajorStatus;
  weather?: string;
  hazard?: string;
  hits?: number;
  screen?: 'lightScreen' | 'reflect';
  terrain?: string;
}

export type MoveEffectType =
  | 'inflict-status'
  | 'stat-change'
  | 'recoil'
  | 'drain'
  | 'flinch'
  | 'multi-hit'
  | 'fixed-multi-hit'
  | 'protect'
  | 'set-weather'
  | 'set-hazard'
  | 'clear-hazards'
  | 'force-switch'
  | 'self-destruct'
  | 'charge-turn'
  | 'heal'
  | 'cure-status'
  | 'set-screen'
  | 'substitute'
  | 'inflict-confusion'
  | 'set-terrain'
  | 'pursuit';

export interface MoveFlags {
  isProtectable: boolean;
  isReflectable: boolean;
  isMirrorMoveable: boolean;
  isSnatchable: boolean;
  isPunch: boolean;
  isBite: boolean;
  isBullet: boolean;
  isSlicing: boolean;
}

export const DEFAULT_MOVE_FLAGS: MoveFlags = {
  isProtectable: true,
  isReflectable: false,
  isMirrorMoveable: true,
  isSnatchable: false,
  isPunch: false,
  isBite: false,
  isBullet: false,
  isSlicing: false,
};
