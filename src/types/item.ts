import { ItemId, MajorStatus } from './common';

export interface ItemData {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  effect: ItemEffect;
}

export type ItemCategory = 'healing' | 'status-cure' | 'held' | 'pokeball' | 'battle';

export interface ItemEffect {
  type: ItemEffectType;
  value?: number;
  status?: MajorStatus;
}

export type ItemEffectType =
  | 'heal-hp'
  | 'heal-pp'
  | 'cure-status'
  | 'revive'
  | 'boost-stat'
  | 'held-heal'
  | 'held-weather-extend'
  | 'held-choice'
  | 'held-life-orb';
