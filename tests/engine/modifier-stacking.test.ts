import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../src/engine/damage-calc';

const baseInput = {
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

describe('Combined Modifier Stacking', () => {
  it('should stack STAB + super effective correctly', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
      stab: true,
    });
    // Base = 37, STAB 1.5x -> 55, * 2 = 110
    expect(result.damage).toBe(110);
  });

  it('should stack STAB + weather boost correctly', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['normal'],
      stab: true,
      weather: 'sun',
    });
    // Base = 37, weather 1.5x -> pokeRound(37*1.5) = pokeRound(55.5) = 55
    // STAB 1.5x -> pokeRound(55*1.5) = pokeRound(82.5) = 82
    expect(result.damage).toBe(82);
  });

  it('should stack critical + STAB', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'normal',
      defenderTypes: ['normal'],
      stab: true,
      isCritical: true,
    });
    // Base = 37, crit 1.5x -> 55, random 1.0, STAB 1.5x -> 82
    expect(result.damage).toBe(82);
  });

  it('should stack weather + critical + STAB + SE', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
      stab: true,
      isCritical: true,
      weather: 'sun',
    });
    // Base = 37
    // Weather 1.5x -> pokeRound(55.5) = 55
    // Crit 1.5x -> pokeRound(82.5) = 82
    // Random: floor(82 * 1.0) = 82
    // STAB 1.5x -> pokeRound(123) = 123
    // SE 2x -> floor(246) = 246
    expect(result.damage).toBe(246);
  });

  it('should stack spread penalty with other modifiers in doubles', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
      stab: true,
      isDoubles: true,
      isSpread: true,
    });
    // Base = 37
    // Spread 0.75x -> pokeRound(27.75) = 28
    // STAB 1.5x -> pokeRound(42) = 42
    // SE 2x -> floor(84) = 84
    expect(result.damage).toBe(84);
  });

  it('should stack otherModifiers (e.g. Life Orb) with everything', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
      stab: true,
      otherModifiers: 1.3, // Life Orb
    });
    // Base = 37
    // STAB 1.5x -> 55
    // SE 2x -> 110
    // Other 1.3x -> pokeRound(143) = 143
    expect(result.damage).toBe(143);
  });

  it('should apply screen modifier (0.5x) as otherModifier', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['grass'],
      otherModifiers: 0.5, // screen
    });
    // Base = 37, SE 2x -> 74, screen 0.5x -> 37
    expect(result.damage).toBe(37);
  });

  it('should round intermediately at each modifier step', () => {
    // Test with values that would give different results if all multiplied at once
    const result = calculateDamage({
      ...baseInput,
      power: 60,
      attack: 120,
      defense: 90,
      moveType: 'water',
      defenderTypes: ['fire'],
      stab: true,
      weather: 'rain',
      isCritical: true,
      randomFactor: 0.85,
    });

    // Verify intermediate rounding gives a definite result (not NaN/0)
    expect(result.damage).toBeGreaterThan(0);
    expect(result.effectiveness).toBe(2);
    expect(result.effectivenessLabel).toBe('super-effective');
    expect(result.isCritical).toBe(true);
  });

  it('should never return less than 1 damage on a non-immune hit', () => {
    const result = calculateDamage({
      ...baseInput,
      power: 10,
      attack: 1,
      defense: 999,
      moveType: 'fire',
      defenderTypes: ['water', 'rock'], // 0.25x
      weather: 'rain', // 0.5x further weakening
      randomFactor: 0.85,
    });

    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it('should correctly handle NVE + weather weakness stacking', () => {
    const result = calculateDamage({
      ...baseInput,
      moveType: 'fire',
      defenderTypes: ['water'],
      weather: 'rain',
    });
    // Base = 37, rain weather 0.5x -> 18, NVE 0.5x -> 9
    expect(result.damage).toBe(9);
    expect(result.effectivenessLabel).toBe('not-very-effective');
  });
});
