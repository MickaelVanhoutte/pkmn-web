export type TypeName =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export const ALL_TYPES: TypeName[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export type StatBlock = Record<StatName, number>;

export type BattleStatName = Exclude<StatName, 'hp'> | 'accuracy' | 'evasion';

export type StatStages = Record<BattleStatName, number>;

export type MajorStatus = 'burn' | 'paralysis' | 'freeze' | 'poison' | 'sleep';

export type VolatileStatus =
  | 'confusion' | 'flinch' | 'protect' | 'substitute'
  | 'leechSeed' | 'encore' | 'taunt' | 'torment'
  | 'chargeMove' | 'focusEnergy' | 'destinationBond';

export type Weather = 'sun' | 'rain' | 'sandstorm' | 'hail';

export type Terrain = 'electric' | 'grassy' | 'psychic' | 'misty';

export type MoveCategory = 'physical' | 'special' | 'status';

export type BattleFormat = 'singles' | 'doubles';

export type PokemonId = string;
export type MoveId = string;
export type AbilityId = string;
export type ItemId = string;

export type PlayerIndex = 0 | 1;
export type SlotIndex = number;

export interface BattlePosition {
  player: PlayerIndex;
  slot: SlotIndex;
}

export type NatureName =
  | 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty'
  | 'bold' | 'docile' | 'relaxed' | 'impish' | 'lax'
  | 'timid' | 'hasty' | 'serious' | 'jolly' | 'naive'
  | 'modest' | 'mild' | 'quiet' | 'bashful' | 'rash'
  | 'calm' | 'gentle' | 'sassy' | 'careful' | 'quirky';

export interface NatureModifiers {
  plus: StatName | null;
  minus: StatName | null;
}

export const NATURES: Record<NatureName, NatureModifiers> = {
  hardy:   { plus: null, minus: null },
  lonely:  { plus: 'atk', minus: 'def' },
  brave:   { plus: 'atk', minus: 'spe' },
  adamant: { plus: 'atk', minus: 'spa' },
  naughty: { plus: 'atk', minus: 'spd' },
  bold:    { plus: 'def', minus: 'atk' },
  docile:  { plus: null, minus: null },
  relaxed: { plus: 'def', minus: 'spe' },
  impish:  { plus: 'def', minus: 'spa' },
  lax:     { plus: 'def', minus: 'spd' },
  timid:   { plus: 'spe', minus: 'atk' },
  hasty:   { plus: 'spe', minus: 'def' },
  serious: { plus: null, minus: null },
  jolly:   { plus: 'spe', minus: 'spa' },
  naive:   { plus: 'spe', minus: 'spd' },
  modest:  { plus: 'spa', minus: 'atk' },
  mild:    { plus: 'spa', minus: 'def' },
  quiet:   { plus: 'spa', minus: 'spe' },
  bashful: { plus: null, minus: null },
  rash:    { plus: 'spa', minus: 'spd' },
  calm:    { plus: 'spd', minus: 'atk' },
  gentle:  { plus: 'spd', minus: 'def' },
  sassy:   { plus: 'spd', minus: 'spe' },
  careful: { plus: 'spd', minus: 'spa' },
  quirky:  { plus: null, minus: null },
};

export const STATUS_TYPE_MAP: Record<Exclude<MajorStatus, 'sleep'>, TypeName> = {
  burn: 'fire',
  paralysis: 'electric',
  freeze: 'ice',
  poison: 'poison',
};

export const STATUS_STAT_REDUCTION: Record<Exclude<MajorStatus, 'sleep'>, BattleStatName> = {
  burn: 'atk',
  paralysis: 'spe',
  freeze: 'def',
  poison: 'spd',
};

export const STATUS_WEATHER_CURE: Record<Exclude<MajorStatus, 'sleep'>, Weather> = {
  burn: 'rain',
  paralysis: 'sandstorm',
  freeze: 'sun',
  poison: 'hail',
};

export const STATUS_MOVE_CURE: Record<Exclude<MajorStatus, 'sleep'>, TypeName> = {
  burn: 'water',
  paralysis: 'ground',
  freeze: 'fire',
  poison: 'ice',
};

export function defaultStatStages(): StatStages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
}
