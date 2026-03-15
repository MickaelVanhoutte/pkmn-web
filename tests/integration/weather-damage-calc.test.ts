import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig } from '../../src/types/battle';
import type { PlayerIndex } from '../../src/types/common';

/** Extract total move damage dealt to a player from events */
function getMoveDamage(events: any[], targetPlayer: number): number {
  return events
    .filter(e => e.kind === 'damage' && e.source === 'move' && e.target.player === targetPlayer)
    .reduce((sum: number, e: any) => sum + e.amount, 0);
}

describe('Weather + Damage Calc Integration', () => {
  describe('Sun weather', () => {
    it('should boost fire moves in sun', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [
            { speciesId: 'charizard', level: 50, abilityId: 'blaze', moveIds: ['flamethrower', 'air-slash', 'sunny-day', 'protect'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Flamethrower without weather
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      const events1 = engine.resolveTurn();
      const damageNoWeather = getMoveDamage(events1, 1);

      // Set sun
      (engine.getField() as any).weather = 'sun';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      // Flamethrower in sun
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      const events2 = engine.resolveTurn();
      const damageWithSun = getMoveDamage(events2, 1);

      expect(damageNoWeather).toBeGreaterThan(0);
      expect(damageWithSun).toBeGreaterThan(damageNoWeather);
    });

    it('should weaken water moves in sun', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
          { name: 'P2', team: [
            { speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'rain-dance', 'protect'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Surf without weather
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events1 = engine.resolveTurn();
      const damageNoWeather = getMoveDamage(events1, 0);

      // Set sun
      (engine.getField() as any).weather = 'sun';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events2 = engine.resolveTurn();
      const damageInSun = getMoveDamage(events2, 0);

      expect(damageNoWeather).toBeGreaterThan(0);
      expect(damageInSun).toBeLessThan(damageNoWeather);
    });
  });

  describe('Rain weather', () => {
    it('should boost water moves in rain', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
          { name: 'P2', team: [
            { speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'rain-dance', 'protect'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Surf without weather
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events1 = engine.resolveTurn();
      const damageNoWeather = getMoveDamage(events1, 0);

      // Set rain
      (engine.getField() as any).weather = 'rain';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events2 = engine.resolveTurn();
      const damageWithRain = getMoveDamage(events2, 0);

      expect(damageNoWeather).toBeGreaterThan(0);
      expect(damageWithRain).toBeGreaterThan(damageNoWeather);
    });

    it('should weaken fire moves in rain', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [
            { speciesId: 'charizard', level: 50, abilityId: 'blaze', moveIds: ['flamethrower', 'air-slash', 'sunny-day', 'protect'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Flamethrower without weather
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      const events1 = engine.resolveTurn();
      const damageNoWeather = getMoveDamage(events1, 1);

      // Set rain
      (engine.getField() as any).weather = 'rain';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Recover
      const events2 = engine.resolveTurn();
      const damageInRain = getMoveDamage(events2, 1);

      expect(damageNoWeather).toBeGreaterThan(0);
      expect(damageInRain).toBeLessThan(damageNoWeather);
    });
  });

  describe('Sandstorm/Hail damage', () => {
    it('should deal sandstorm damage to non-immune types at end of turn', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'tyranitar', level: 50, abilityId: 'sand-stream', moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'charizard', level: 50, abilityId: 'blaze', moveIds: ['flamethrower', 'air-slash', 'protect', 'sunny-day'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();
      expect(engine.getField().weather).toBe('sandstorm');

      const charizard = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      const hpBefore = charizard.currentHp;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 3 }]); // Protect
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      const events = engine.resolveTurn();

      expect(charizard.currentHp).toBeLessThan(hpBefore);

      // Tyranitar (rock) immune to sandstorm
      const tyranitarDamage = events.find(e =>
        e.kind === 'weather-damage' && (e as any).target.player === 0,
      );
      expect(tyranitarDamage).toBeUndefined();
    });

    it('should deal hail damage to non-ice types', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'lapras', level: 50, abilityId: 'water-absorb', moveIds: ['ice-beam', 'surf', 'protect', 'rain-dance'] }] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'hail';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      const lapras = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      const snorlaxHpBefore = snorlax.currentHp;
      const laprasHpBefore = lapras.currentHp;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.resolveTurn();

      expect(snorlax.currentHp).toBeLessThan(snorlaxHpBefore);
      expect(lapras.currentHp).toBe(laprasHpBefore); // Ice-type immune
    });
  });

  describe('Weather expiry', () => {
    it('should end weather after turns expire', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'recover', 'protect', 'earthquake'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'rain';
      (engine.getField() as any).weatherTurnsRemaining = 1;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      const weatherEnd = events.find(e => e.kind === 'weather-end');
      expect(weatherEnd).toBeDefined();
      expect(engine.getField().weather).toBeNull();
    });
  });
});
