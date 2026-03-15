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
}

export interface DamageCalcResult {
  damage: number;
  effectiveness: number;
  effectivenessLabel: 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';
  isCritical: boolean;
}

/**
 * Pokemon-round: round to nearest, 0.5 rounds down (matches game hardware).
 */
function pokeRound(n: number): number {
  return (n % 1 > 0.5) ? Math.ceil(n) : Math.floor(n);
}

/**
 * Apply a modifier with intermediate rounding, matching Showdown's chained modifier system.
 * Each modifier is applied individually with a round after, to match the game's fixed-point arithmetic.
 */
function applyModifier(damage: number, modifier: number): number {
  return pokeRound(damage * modifier);
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

  let damage = Math.floor(
    ((2 * input.level / 5 + 2) * input.power * input.attack / input.defense) / 50,
  ) + 2;

  // Each modifier applied with intermediate rounding (Gen 5+ order)

  // 1. Doubles spread penalty
  if (input.isDoubles && input.isSpread) {
    damage = applyModifier(damage, 0.75);
  }

  // 2. Weather modifier
  const weatherMod = getWeatherModifier(input.weather, input.moveType);
  if (weatherMod !== 1.0) {
    damage = applyModifier(damage, weatherMod);
  }

  // 3. Critical hit
  if (input.isCritical) {
    damage = applyModifier(damage, 1.5);
  }

  // 4. Random factor (0.85-1.00) — always floor
  damage = Math.floor(damage * input.randomFactor);

  // 5. STAB
  if (input.stab) {
    damage = applyModifier(damage, 1.5);
  }

  // 6. Type effectiveness (can be 0.25, 0.5, 2, 4, etc.)
  damage = Math.floor(damage * effectiveness);

  // 7. Other modifiers (abilities, items, screens, terrain)
  if (input.otherModifiers !== 1.0) {
    damage = applyModifier(damage, input.otherModifiers);
  }

  damage = Math.max(1, damage);

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
