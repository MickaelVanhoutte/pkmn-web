import type { StatBlock, StatName, NatureName, BattleStatName } from '../types';
import { NATURES } from '../types/common';

export function calculateStat(
  statName: StatName,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureName,
): number {
  if (statName === 'hp') {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }

  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  const natureMod = getNatureModifier(statName, nature);
  return Math.floor(raw * natureMod);
}

export function calculateAllStats(
  baseStats: StatBlock,
  ivs: Partial<StatBlock>,
  evs: Partial<StatBlock>,
  level: number,
  nature: NatureName,
): StatBlock {
  const statNames: StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const result = {} as StatBlock;

  for (const stat of statNames) {
    result[stat] = calculateStat(
      stat,
      baseStats[stat],
      ivs[stat] ?? 31,
      evs[stat] ?? 0,
      level,
      nature,
    );
  }

  return result;
}

function getNatureModifier(stat: StatName, nature: NatureName): number {
  const mod = NATURES[nature];
  if (mod.plus === stat) return 1.1;
  if (mod.minus === stat) return 0.9;
  return 1.0;
}

const STAT_STAGE_MULTIPLIERS: Record<string, number> = {
  '-6': 2 / 8,
  '-5': 2 / 7,
  '-4': 2 / 6,
  '-3': 2 / 5,
  '-2': 2 / 4,
  '-1': 2 / 3,
  '0': 1,
  '1': 3 / 2,
  '2': 4 / 2,
  '3': 5 / 2,
  '4': 6 / 2,
  '5': 7 / 2,
  '6': 8 / 2,
};

export function getStatStageMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  return STAT_STAGE_MULTIPLIERS[String(clamped)] ?? 1;
}

const ACC_EVA_MULTIPLIERS: Record<string, number> = {
  '-6': 3 / 9,
  '-5': 3 / 8,
  '-4': 3 / 7,
  '-3': 3 / 6,
  '-2': 3 / 5,
  '-1': 3 / 4,
  '0': 1,
  '1': 4 / 3,
  '2': 5 / 3,
  '3': 6 / 3,
  '4': 7 / 3,
  '5': 8 / 3,
  '6': 9 / 3,
};

export function getAccuracyEvasionMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  return ACC_EVA_MULTIPLIERS[String(clamped)] ?? 1;
}

export function clampStatStage(current: number, change: number): number {
  return Math.max(-6, Math.min(6, current + change));
}

export function getEffectiveStat(
  base: number,
  stage: number,
  statName: BattleStatName,
): number {
  if (statName === 'accuracy' || statName === 'evasion') {
    return Math.floor(base * getAccuracyEvasionMultiplier(stage));
  }
  return Math.floor(base * getStatStageMultiplier(stage));
}
