import { describe, it, expect } from 'vitest';
import { getSingleTypeEffectiveness, getTypeEffectiveness } from '../../src/data/type-chart';

describe('Type Chart', () => {
  describe('getSingleTypeEffectiveness', () => {
    it('should return 2 for super effective matchups', () => {
      expect(getSingleTypeEffectiveness('fire', 'grass')).toBe(2);
      expect(getSingleTypeEffectiveness('water', 'fire')).toBe(2);
      expect(getSingleTypeEffectiveness('electric', 'water')).toBe(2);
      expect(getSingleTypeEffectiveness('grass', 'water')).toBe(2);
      expect(getSingleTypeEffectiveness('ice', 'dragon')).toBe(2);
      expect(getSingleTypeEffectiveness('fighting', 'normal')).toBe(2);
    });

    it('should return 0.5 for not very effective matchups', () => {
      expect(getSingleTypeEffectiveness('fire', 'water')).toBe(0.5);
      expect(getSingleTypeEffectiveness('water', 'grass')).toBe(0.5);
      expect(getSingleTypeEffectiveness('electric', 'grass')).toBe(0.5);
      expect(getSingleTypeEffectiveness('grass', 'fire')).toBe(0.5);
    });

    it('should return 0 for immune matchups', () => {
      expect(getSingleTypeEffectiveness('normal', 'ghost')).toBe(0);
      expect(getSingleTypeEffectiveness('ghost', 'normal')).toBe(0);
      expect(getSingleTypeEffectiveness('electric', 'ground')).toBe(0);
      expect(getSingleTypeEffectiveness('ground', 'flying')).toBe(0);
      expect(getSingleTypeEffectiveness('psychic', 'dark')).toBe(0);
      expect(getSingleTypeEffectiveness('fighting', 'ghost')).toBe(0);
      expect(getSingleTypeEffectiveness('poison', 'steel')).toBe(0);
      expect(getSingleTypeEffectiveness('dragon', 'fairy')).toBe(0);
    });

    it('should return 1 for neutral matchups', () => {
      expect(getSingleTypeEffectiveness('normal', 'normal')).toBe(1);
      expect(getSingleTypeEffectiveness('fire', 'electric')).toBe(1);
    });

    it('should handle fairy type correctly', () => {
      expect(getSingleTypeEffectiveness('fairy', 'dragon')).toBe(2);
      expect(getSingleTypeEffectiveness('fairy', 'fighting')).toBe(2);
      expect(getSingleTypeEffectiveness('fairy', 'dark')).toBe(2);
      expect(getSingleTypeEffectiveness('fairy', 'fire')).toBe(0.5);
      expect(getSingleTypeEffectiveness('fairy', 'poison')).toBe(0.5);
      expect(getSingleTypeEffectiveness('fairy', 'steel')).toBe(0.5);
      expect(getSingleTypeEffectiveness('poison', 'fairy')).toBe(2);
      expect(getSingleTypeEffectiveness('steel', 'fairy')).toBe(2);
    });
  });

  describe('getTypeEffectiveness (dual type)', () => {
    it('should return 4 for double super effective', () => {
      // Fire vs Grass/Ice (2 * 2 = 4)
      expect(getTypeEffectiveness('fire', ['grass', 'ice'])).toBe(4);
      // Ground vs Fire/Steel (2 * 2 = 4)
      expect(getTypeEffectiveness('ground', ['fire', 'steel'])).toBe(4);
    });

    it('should return 0.25 for double resisted', () => {
      // Fire vs Water/Dragon (0.5 * 0.5 = 0.25)
      expect(getTypeEffectiveness('fire', ['water', 'dragon'])).toBe(0.25);
    });

    it('should return 0 if one type is immune', () => {
      // Normal vs Ghost/Dark (0 * anything = 0)
      expect(getTypeEffectiveness('normal', ['ghost', 'dark'])).toBe(0);
      // Electric vs Ground/Water (0 * 2 = 0)
      expect(getTypeEffectiveness('electric', ['ground', 'water'])).toBe(0);
    });

    it('should cancel out SE and NVE (1x)', () => {
      // Fire vs Water/Grass (0.5 * 2 = 1)
      expect(getTypeEffectiveness('fire', ['water', 'grass'])).toBe(1);
    });

    it('should work with single type arrays', () => {
      expect(getTypeEffectiveness('fire', ['grass'])).toBe(2);
      expect(getTypeEffectiveness('fire', ['water'])).toBe(0.5);
    });
  });
});
