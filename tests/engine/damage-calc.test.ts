import { describe, it, expect } from 'vitest';
import { calculateDamage, getWeatherModifier } from '../../src/engine/damage-calc';

describe('Damage Calculation', () => {
  const baseDamageInput = {
    level: 50,
    power: 80,
    attack: 100,
    defense: 100,
    stab: false,
    moveType: 'normal' as const,
    defenderTypes: ['normal' as const],
    isCritical: false,
    weather: null,
    isDoubles: false,
    isSpread: false,
    randomFactor: 1.0,
    otherModifiers: 1.0,
  };

  it('should calculate base damage correctly', () => {
    const result = calculateDamage(baseDamageInput);
    // ((2*50/5+2) * 80 * 100/100) / 50 + 2 = (22*80*1)/50 + 2 = 35.2 -> 35 + 2 = 37
    // No modifiers, randomFactor=1.0, so damage = 37 * 0.5 (NVE Rock) ? No, normal vs normal = 0.5 (NVE)...
    // Actually normal vs normal = 1 (neutral)
    // So damage = max(1, floor(37 * 1)) = 37
    expect(result.damage).toBe(37);
    expect(result.effectiveness).toBe(1);
    expect(result.effectivenessLabel).toBe('neutral');
    expect(result.isCritical).toBe(false);
  });

  it('should apply STAB correctly (1.5x)', () => {
    const result = calculateDamage({ ...baseDamageInput, stab: true });
    // 37 * 1.5 = 55.5 -> 55
    expect(result.damage).toBe(55);
  });

  it('should apply type effectiveness', () => {
    const result = calculateDamage({
      ...baseDamageInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
    });
    // 37 * 2.0 = 74
    expect(result.damage).toBe(74);
    expect(result.effectiveness).toBe(2);
    expect(result.effectivenessLabel).toBe('super-effective');
  });

  it('should return 0 damage for immune matchups', () => {
    const result = calculateDamage({
      ...baseDamageInput,
      moveType: 'normal',
      defenderTypes: ['ghost'],
    });
    expect(result.damage).toBe(0);
    expect(result.effectiveness).toBe(0);
    expect(result.effectivenessLabel).toBe('immune');
  });

  it('should apply critical hit multiplier (1.5x)', () => {
    const result = calculateDamage({ ...baseDamageInput, isCritical: true });
    // 37 * 1.5 = 55.5 -> 55
    expect(result.damage).toBe(55);
    expect(result.isCritical).toBe(true);
  });

  it('should apply random factor', () => {
    const result = calculateDamage({ ...baseDamageInput, randomFactor: 0.85 });
    // 37 * 0.85 = 31.45 -> 31
    expect(result.damage).toBe(31);
  });

  it('should apply doubles spread penalty', () => {
    const result = calculateDamage({
      ...baseDamageInput,
      isDoubles: true,
      isSpread: true,
    });
    // Step-by-step rounding (Showdown-accurate): spread penalty applied and floored per step -> 28
    expect(result.damage).toBe(28);
  });

  it('should always do at least 1 damage for non-immune hits', () => {
    const result = calculateDamage({
      ...baseDamageInput,
      power: 1,
      attack: 1,
      defense: 999,
    });
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });
});

describe('Weather Modifier', () => {
  it('should boost fire in sun', () => {
    expect(getWeatherModifier('sun', 'fire')).toBe(1.5);
  });
  it('should weaken water in sun', () => {
    expect(getWeatherModifier('sun', 'water')).toBe(0.5);
  });
  it('should boost water in rain', () => {
    expect(getWeatherModifier('rain', 'water')).toBe(1.5);
  });
  it('should weaken fire in rain', () => {
    expect(getWeatherModifier('rain', 'fire')).toBe(0.5);
  });
  it('should return 1 for other combos', () => {
    expect(getWeatherModifier('sun', 'electric')).toBe(1);
    expect(getWeatherModifier('sandstorm', 'fire')).toBe(1);
    expect(getWeatherModifier(null, 'fire')).toBe(1);
  });
});
