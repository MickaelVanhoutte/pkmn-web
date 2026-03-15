import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../src/engine/damage-calc';
import { getTypeEffectiveness } from '../../src/data/type-chart';

const baseInput = {
  level: 50,
  power: 80,
  attack: 100,
  defense: 100,
  stab: false,
  isCritical: false,
  weather: null,
  isDoubles: false,
  isSpread: false,
  randomFactor: 1.0,
  otherModifiers: 1.0,
};

describe('Dual-Type Effectiveness', () => {
  describe('getTypeEffectiveness with dual types', () => {
    it('should give 4x for super-effective vs both types', () => {
      // Ice vs Dragon/Ground (Garchomp): 2x * 2x = 4x
      expect(getTypeEffectiveness('ice', ['dragon', 'ground'])).toBe(4);
    });

    it('should give 0.25x for resisted by both types', () => {
      // Fire vs Water/Rock: 0.5x * 0.5x = 0.25x
      expect(getTypeEffectiveness('fire', ['water', 'rock'])).toBe(0.25);
    });

    it('should give 1x when SE and NVE cancel out', () => {
      // Fire vs Grass/Water: 2x * 0.5x = 1x
      expect(getTypeEffectiveness('fire', ['grass', 'water'])).toBe(1);
    });

    it('should give 0x when one type is immune', () => {
      // Ground vs Dragon/Flying (Dragonite): Ground is immune to flying
      expect(getTypeEffectiveness('ground', ['dragon', 'flying'])).toBe(0);
    });

    it('should give 0x when normal hits ghost dual type', () => {
      // Normal vs Ghost/Poison (Gengar)
      expect(getTypeEffectiveness('normal', ['ghost', 'poison'])).toBe(0);
    });

    it('should give 2x for SE vs one, neutral vs other', () => {
      // Fire vs Bug/Steel (Scizor): 2x * 2x = 4x (both SE)
      expect(getTypeEffectiveness('fire', ['bug', 'steel'])).toBe(4);
    });

    it('should handle Electric vs Water/Ground (Swampert)', () => {
      // Electric vs Water/Ground: 2x * 0x = 0x (Ground immune)
      expect(getTypeEffectiveness('electric', ['water', 'ground'])).toBe(0);
    });

    it('should handle Fighting vs Rock/Dark (Tyranitar)', () => {
      // Fighting vs Rock/Dark: 2x * 2x = 4x
      expect(getTypeEffectiveness('fighting', ['rock', 'dark'])).toBe(4);
    });
  });

  describe('Damage calculation with dual types', () => {
    it('should calculate 4x damage correctly', () => {
      const result = calculateDamage({
        ...baseInput,
        moveType: 'ice',
        defenderTypes: ['dragon', 'ground'],
      });
      // Base = 37, effectiveness = 4, so damage = 37 * 4 = 148
      expect(result.damage).toBe(148);
      expect(result.effectiveness).toBe(4);
      expect(result.effectivenessLabel).toBe('super-effective');
    });

    it('should calculate 0.25x damage correctly', () => {
      const result = calculateDamage({
        ...baseInput,
        moveType: 'fire',
        defenderTypes: ['water', 'rock'],
      });
      // Base = 37, effectiveness = 0.25, damage = floor(37 * 0.25) = floor(9.25) = 9
      expect(result.damage).toBe(9);
      expect(result.effectiveness).toBe(0.25);
      expect(result.effectivenessLabel).toBe('not-very-effective');
    });

    it('should return immune for 0x matchup', () => {
      const result = calculateDamage({
        ...baseInput,
        moveType: 'ground',
        defenderTypes: ['dragon', 'flying'],
      });
      expect(result.damage).toBe(0);
      expect(result.effectiveness).toBe(0);
      expect(result.effectivenessLabel).toBe('immune');
    });

    it('should combine STAB with 4x effectiveness', () => {
      const result = calculateDamage({
        ...baseInput,
        moveType: 'ice',
        defenderTypes: ['dragon', 'ground'],
        stab: true,
      });
      // Base = 37, STAB 1.5x -> 55, then * 4 = 220
      expect(result.damage).toBe(220);
    });

    it('should combine weather with dual-type effectiveness', () => {
      const result = calculateDamage({
        ...baseInput,
        moveType: 'fire',
        defenderTypes: ['bug', 'steel'],
        weather: 'sun',
      });
      // Base = 37, weather 1.5x -> 55 (pokeRound), then * 4 = 220
      expect(result.damage).toBe(220);
    });
  });
});
