import { AbilityId, BattleStatName, BattlePosition, MajorStatus, Weather } from './common';
import type { MoveData } from './move';
import type { PokemonBattleState } from './pokemon';

export interface AbilityData {
  id: AbilityId;
  name: string;
  description: string;
  triggers: AbilityTrigger[];
}

export type AbilityTrigger =
  | 'onSwitchIn'
  | 'onSwitchOut'
  | 'beforeMove'
  | 'afterMove'
  | 'onBeingHit'
  | 'onHitting'
  | 'onDamageReceived'
  | 'onStatusApplied'
  | 'onStatChange'
  | 'onTurnEnd'
  | 'onTurnStart'
  | 'onWeatherChange'
  | 'onWeatherActive'
  | 'onResidual'
  | 'onFaint'
  | 'onAllyFaint'
  | 'onTryHit'
  | 'modifyDamage'
  | 'modifyAtk'
  | 'modifyDef'
  | 'modifySpa'
  | 'modifySpd'
  | 'modifySpe'
  | 'modifyAccuracy'
  | 'modifyCritRatio';

export interface AbilityHookContext {
  source: PokemonBattleState;
  target?: PokemonBattleState;
  allAllies?: PokemonBattleState[];
  allOpponents?: PokemonBattleState[];
  move?: MoveData;
  damage?: number;
  status?: MajorStatus;
  weather?: Weather | null;
  statChange?: { stat: BattleStatName; stages: number };
}

export type AbilityHookResult =
  | { action: 'none' }
  | { action: 'prevent' }
  | { action: 'modify-damage'; factor: number }
  | { action: 'modify-stat'; factor: number }
  | { action: 'heal'; amount: number }
  | { action: 'inflict-status'; status: MajorStatus; target: BattlePosition }
  | { action: 'set-weather'; weather: Weather }
  | { action: 'boost-stat'; stat: BattleStatName; stages: number; target: BattlePosition }
  | { action: 'message'; text: string };

export type AbilityHandler = (ctx: AbilityHookContext) => AbilityHookResult | AbilityHookResult[];
export type AbilityHandlerMap = Partial<Record<AbilityTrigger, AbilityHandler>>;
