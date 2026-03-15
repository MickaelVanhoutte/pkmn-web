import {
  PokemonId, TypeName, StatBlock, AbilityId, MoveId, MajorStatus,
  VolatileStatus, StatStages, ItemId, NatureName, SlotIndex, BattlePosition,
} from './common';

export interface PokemonSpecies {
  id: PokemonId;
  name: string;
  types: [TypeName] | [TypeName, TypeName];
  baseStats: StatBlock;
  possibleAbilities: AbilityId[];
  learnableMoves: MoveId[];
}

export interface PokemonConfig {
  speciesId: PokemonId;
  nickname?: string;
  level: number;
  abilityId: AbilityId;
  moveIds: MoveId[];
  itemId?: ItemId;
  nature?: NatureName;
  evs?: Partial<StatBlock>;
  ivs?: Partial<StatBlock>;
}

export interface MoveInstanceState {
  moveId: MoveId;
  currentPp: number;
  maxPp: number;
  disabled: boolean;
}

export interface PokemonBattleState {
  readonly config: PokemonConfig;
  readonly species: PokemonSpecies;
  readonly calculatedStats: StatBlock;

  currentHp: number;
  maxHp: number;
  status: MajorStatus | null;
  statusTurns: number;
  volatileStatuses: VolatileStatus[];
  statStages: StatStages;
  moves: MoveInstanceState[];
  isActive: boolean;
  isFainted: boolean;
  item: ItemId | null;
  ability: AbilityId;
  lastMoveUsed: MoveId | null;
  turnsSinceSwitch: number;
  slotIndex: SlotIndex;
  teamIndex: number;
  substituteHp: number;
  confusionTurns: number;
  chargeMoveId: MoveId | null;
  chargeMoveTargetPos: BattlePosition | null;
  choiceLocked: MoveId | null;
}
