import {
  BattleFormat, PlayerIndex, SlotIndex, Weather, Terrain,
  MoveId, ItemId, BattlePosition, StatStages,
} from './common';
import type { PokemonBattleState, PokemonConfig } from './pokemon';
import type { BattleEvent } from './events';

export type BattleType = 'wild' | 'trainer';

export interface BattleConfig {
  format: BattleFormat;
  players: [PlayerConfig, PlayerConfig];
  seed?: number;
  maxTurns?: number;
  battleType?: BattleType;
}

export interface PlayerConfig {
  name: string;
  team: PokemonConfig[];
}

export interface BattleState {
  config: BattleConfig;
  turn: number;
  phase: BattlePhase;
  players: [PlayerState, PlayerState];
  field: FieldState;
  actionQueue: ResolvedAction[];
  log: BattleEvent[];
  winner: PlayerIndex | null;
  isOver: boolean;
  rngState: number;
}

export type BattlePhase =
  | 'not-started'
  | 'team-preview'
  | 'awaiting-actions'
  | 'resolving-turn'
  | 'turn-end'
  | 'forced-switch'
  | 'battle-over';

export interface PlayerState {
  index: PlayerIndex;
  name: string;
  team: PokemonBattleState[];
  activePokemon: number[];
}

export interface FieldState {
  weather: Weather | null;
  weatherTurnsRemaining: number;
  terrain: Terrain | null;
  terrainTurnsRemaining: number;
  trickRoom: number; // turns remaining, 0 = inactive
  sides: [SideState, SideState];
}

export interface SideState {
  stealthRock: boolean;
  spikesLayers: number;
  toxicSpikesLayers: number;
  lightScreen: number;
  reflect: number;
  tailwind: number;
  stickyWeb: boolean;
}

export function defaultSideState(): SideState {
  return {
    stealthRock: false,
    spikesLayers: 0,
    toxicSpikesLayers: 0,
    lightScreen: 0,
    reflect: 0,
    tailwind: 0,
    stickyWeb: false,
  };
}

export type TurnAction =
  | MoveAction
  | SwitchAction
  | ItemAction
  | RunAction
  | CatchAction;

export interface MoveAction {
  type: 'move';
  player: PlayerIndex;
  slot: SlotIndex;
  moveIndex: number;
  targetPosition?: BattlePosition;
}

export interface SwitchAction {
  type: 'switch';
  player: PlayerIndex;
  slot: SlotIndex;
  switchToIndex: number;
}

export interface ItemAction {
  type: 'item';
  player: PlayerIndex;
  itemId: ItemId;
  targetTeamIndex: number;
}

export interface RunAction {
  type: 'run';
  player: PlayerIndex;
}

export interface CatchAction {
  type: 'catch';
  player: PlayerIndex;
  /** ID of the ball item used (for future expansion) */
  ballId?: ItemId;
}

export interface ResolvedAction {
  action: TurnAction;
  priority: number;
  speed: number;
  order: number;
  consumed?: boolean;
  tiebreaker: number;
}
