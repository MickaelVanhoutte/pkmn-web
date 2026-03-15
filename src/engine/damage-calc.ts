import type { TypeName, Weather } from '../types';
import { getTypeEffectiveness, getEffectivenessLabel } from '../data/type-chart';

export interface DamageCalcInput {
  level: number;
  power: number;
  attack: number;
  defense: number;
  stab: boolean;
  moveType: TypeName;
  defenderTypes: TypeName[];
  isCritical: boolean;
  weather: Weather | null;
  isDoubles: boolean;
  isSpread: boolean;
  randomFactor: number;
  otherModifiers: number;
  burnModifier: number;
}

export interface DamageCalcResult {
  damage: number;
  effectiveness: number;
  effectivenessLabel: 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';
  isCritical: boolean;
}

export function calculateDamage(input: DamageCalcInput): DamageCalcResult {
  const effectiveness = getTypeEffectiveness(input.moveType, input.defenderTypes);

  if (effectiveness === 0) {
    return {
      damage: 0,
      effectiveness: 0,
      effectivenessLabel: 'immune',
      isCritical: false,
    };
  }

  const baseDamage = Math.floor(
    ((2 * input.level / 5 + 2) * input.power * input.attack / input.defense) / 50,
  ) + 2;

  let modifier = 1.0;

  // Doubles spread penalty
  if (input.isDoubles && input.isSpread) {
    modifier *= 0.75;
  }

  // Weather modifier
  modifier *= getWeatherModifier(input.weather, input.moveType);

  // Critical hit
  if (input.isCritical) {
    modifier *= 1.5;
  }

  // Random factor (0.85-1.00)
  modifier *= input.randomFactor;

  // STAB
  if (input.stab) {
    modifier *= 1.5;
  }

  // Type effectiveness
  modifier *= effectiveness;

  // Burn (physical move while burned)
  modifier *= input.burnModifier;

  // Other (abilities, items, etc.)
  modifier *= input.otherModifiers;

  const damage = Math.max(1, Math.floor(baseDamage * modifier));

  return {
    damage,
    effectiveness,
    effectivenessLabel: getEffectivenessLabel(effectiveness),
    isCritical: input.isCritical,
  };
}

export function getWeatherModifier(weather: Weather | null, moveType: TypeName): number {
  if (!weather) return 1.0;

  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }

  return 1.0;
}

export function getCriticalHitStage(baseCritStage: number): number {
  // Gen 6+ crit rates: stage 0 = 1/24, 1 = 1/8, 2 = 1/2, 3+ = always
  const rates = [1 / 24, 1 / 8, 1 / 2, 1];
  const clamped = Math.min(baseCritStage, 3);
  return rates[clamped];
}
