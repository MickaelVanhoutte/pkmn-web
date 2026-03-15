import {
  PlayerIndex, SlotIndex, MoveId, TypeName, Weather, Terrain,
  MajorStatus, VolatileStatus, BattleStatName, BattlePosition, AbilityId, ItemId,
} from './common';

export type BattleEvent =
  | BattleStartEvent
  | TurnStartEvent
  | TurnEndEvent
  | MoveUseEvent
  | DamageEvent
  | HealEvent
  | FaintEvent
  | SwitchInEvent
  | SwitchOutEvent
  | StatusAppliedEvent
  | StatusCuredEvent
  | StatusDamageEvent
  | StatChangeEvent
  | WeatherSetEvent
  | WeatherDamageEvent
  | WeatherEndEvent
  | CriticalHitEvent
  | TypeEffectivenessEvent
  | MissEvent
  | FailEvent
  | ImmunityEvent
  | AbilityActivateEvent
  | HazardSetEvent
  | HazardDamageEvent
  | HazardClearedEvent
  | ItemUsedEvent
  | RunAttemptEvent
  | BattleEndEvent
  | MessageEvent
  | ScreenSetEvent
  | ScreenEndEvent
  | SubstituteCreatedEvent
  | SubstituteBrokenEvent
  | SubstituteBlockedEvent
  | MultiHitCompleteEvent
  | ConfusionStartEvent
  | ConfusionEndEvent
  | ConfusionHitSelfEvent
  | ChargingEvent
  | ForceSwitchEvent
  | PursuitHitEvent
  | TerrainSetEvent
  | TerrainEndEvent
  | ForceSwitchNeededEvent;

interface BaseEvent {
  turn: number;
}

export interface BattleStartEvent extends BaseEvent {
  kind: 'battle-start';
  format: string;
  players: [string, string];
}

export interface TurnStartEvent extends BaseEvent {
  kind: 'turn-start';
}

export interface TurnEndEvent extends BaseEvent {
  kind: 'turn-end';
}

export interface MoveUseEvent extends BaseEvent {
  kind: 'move-use';
  user: BattlePosition;
  moveName: string;
  moveId: MoveId;
  moveType: TypeName;
  targets: BattlePosition[];
}

export interface DamageEvent extends BaseEvent {
  kind: 'damage';
  target: BattlePosition;
  amount: number;
  currentHp: number;
  maxHp: number;
  source: 'move' | 'status' | 'weather' | 'hazard' | 'recoil' | 'item' | 'ability';
  sourceDetail?: string; // e.g., move name, item name, ability name
}

export interface HealEvent extends BaseEvent {
  kind: 'heal';
  target: BattlePosition;
  amount: number;
  currentHp: number;
  maxHp: number;
  source: 'move' | 'status' | 'item' | 'ability' | 'drain' | 'terrain';
  sourceDetail?: string; // e.g., item name, move name
}

export interface FaintEvent extends BaseEvent {
  kind: 'faint';
  target: BattlePosition;
  pokemonName: string;
}

export interface SwitchInEvent extends BaseEvent {
  kind: 'switch-in';
  player: PlayerIndex;
  slot: SlotIndex;
  pokemonName: string;
  speciesId: string;
  teamIndex: number;
  currentHp: number;
  maxHp: number;
}

export interface SwitchOutEvent extends BaseEvent {
  kind: 'switch-out';
  player: PlayerIndex;
  slot: SlotIndex;
  pokemonName: string;
}

export interface StatusAppliedEvent extends BaseEvent {
  kind: 'status-applied';
  target: BattlePosition;
  status: MajorStatus;
  pokemonName: string;
}

export interface StatusCuredEvent extends BaseEvent {
  kind: 'status-cured';
  target: BattlePosition;
  status: MajorStatus;
  pokemonName: string;
  source: 'weather' | 'move' | 'ability' | 'item' | 'natural';
}

export interface StatusDamageEvent extends BaseEvent {
  kind: 'status-damage';
  target: BattlePosition;
  status: MajorStatus;
  amount: number;
  currentHp: number;
  maxHp: number;
}

export interface StatChangeEvent extends BaseEvent {
  kind: 'stat-change';
  target: BattlePosition;
  stat: BattleStatName;
  stages: number;
  currentStage: number;
  pokemonName: string;
}

export interface WeatherSetEvent extends BaseEvent {
  kind: 'weather-set';
  weather: Weather;
  turns: number;
}

export interface WeatherDamageEvent extends BaseEvent {
  kind: 'weather-damage';
  target: BattlePosition;
  weather: Weather;
  amount: number;
  currentHp: number;
  maxHp: number;
}

export interface WeatherEndEvent extends BaseEvent {
  kind: 'weather-end';
  weather: Weather;
}

export interface CriticalHitEvent extends BaseEvent {
  kind: 'critical-hit';
  target: BattlePosition;
}

export interface TypeEffectivenessEvent extends BaseEvent {
  kind: 'type-effectiveness';
  target: BattlePosition;
  effectiveness: 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';
}

export interface MissEvent extends BaseEvent {
  kind: 'miss';
  user: BattlePosition;
  target: BattlePosition;
  moveId: MoveId;
}

export interface FailEvent extends BaseEvent {
  kind: 'fail';
  user: BattlePosition;
  reason: string;
}

export interface ImmunityEvent extends BaseEvent {
  kind: 'immunity';
  target: BattlePosition;
  reason: string;
}

export interface AbilityActivateEvent extends BaseEvent {
  kind: 'ability-activate';
  pokemon: BattlePosition;
  abilityId: AbilityId;
  abilityName: string;
  message: string;
}

export interface HazardSetEvent extends BaseEvent {
  kind: 'hazard-set';
  side: PlayerIndex;
  hazard: string;
  layers?: number;
}

export interface HazardDamageEvent extends BaseEvent {
  kind: 'hazard-damage';
  target: BattlePosition;
  hazard: string;
  amount: number;
  currentHp: number;
  maxHp: number;
}

export interface HazardClearedEvent extends BaseEvent {
  kind: 'hazard-cleared';
  side: PlayerIndex;
  hazard: string;
}

export interface ItemUsedEvent extends BaseEvent {
  kind: 'item-used';
  player: PlayerIndex;
  itemId: ItemId;
  itemName: string;
  target: BattlePosition;
}

export interface RunAttemptEvent extends BaseEvent {
  kind: 'run-attempt';
  player: PlayerIndex;
  success: boolean;
}

export interface BattleEndEvent extends BaseEvent {
  kind: 'battle-end';
  winner: PlayerIndex | null;
  reason: 'all-fainted' | 'forfeit' | 'turn-limit' | 'run';
}

export interface MessageEvent extends BaseEvent {
  kind: 'message';
  text: string;
}

export interface ScreenSetEvent extends BaseEvent {
  kind: 'screen-set';
  side: PlayerIndex;
  screen: 'lightScreen' | 'reflect' | 'tailwind';
  turns: number;
}

export interface ScreenEndEvent extends BaseEvent {
  kind: 'screen-end';
  side: PlayerIndex;
  screen: 'lightScreen' | 'reflect' | 'tailwind';
}

export interface SubstituteCreatedEvent extends BaseEvent {
  kind: 'substitute-created';
  target: BattlePosition;
  hpCost: number;
}

export interface SubstituteBrokenEvent extends BaseEvent {
  kind: 'substitute-broken';
  target: BattlePosition;
}

export interface SubstituteBlockedEvent extends BaseEvent {
  kind: 'substitute-blocked';
  target: BattlePosition;
}

export interface MultiHitCompleteEvent extends BaseEvent {
  kind: 'multi-hit-complete';
  target: BattlePosition;
  hitCount: number;
}

export interface ConfusionStartEvent extends BaseEvent {
  kind: 'confusion-start';
  target: BattlePosition;
  pokemonName: string;
}

export interface ConfusionEndEvent extends BaseEvent {
  kind: 'confusion-end';
  target: BattlePosition;
  pokemonName: string;
}

export interface ConfusionHitSelfEvent extends BaseEvent {
  kind: 'confusion-hit-self';
  target: BattlePosition;
  damage: number;
  currentHp: number;
  maxHp: number;
}

export interface ChargingEvent extends BaseEvent {
  kind: 'charging';
  user: BattlePosition;
  moveName: string;
  moveId: MoveId;
}

export interface ForceSwitchEvent extends BaseEvent {
  kind: 'force-switch';
  target: BattlePosition;
  reason: string;
}

export interface PursuitHitEvent extends BaseEvent {
  kind: 'pursuit-hit';
  user: BattlePosition;
  target: BattlePosition;
}

export interface TerrainSetEvent extends BaseEvent {
  kind: 'terrain-set';
  terrain: Terrain;
  turns: number;
}

export interface TerrainEndEvent extends BaseEvent {
  kind: 'terrain-end';
  terrain: Terrain;
}

export interface ForceSwitchNeededEvent extends BaseEvent {
  kind: 'force-switch-needed';
  player: PlayerIndex;
  slot: SlotIndex;
}
