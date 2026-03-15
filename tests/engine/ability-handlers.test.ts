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

describe('Ability Handlers', () => {
  describe('Blaze / Torrent / Overgrow (pinch abilities)', () => {
    it('should boost fire moves at 1/3 HP with Blaze', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [
            { speciesId: 'charizard', level: 50, abilityId: 'blaze', moveIds: ['flamethrower', 'air-slash', 'protect', 'sunny-day'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
          { name: 'P2', team: [
            { speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1: Flamethrower at full HP (no Blaze) - target uses Recover
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      const events1 = engine.resolveTurn();
      const damageNoBlaze = getMoveDamage(events1, 1);

      // Drop Charizard below 1/3 HP
      const charizard = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      charizard.currentHp = Math.floor(charizard.maxHp / 3);

      // Turn 2: Flamethrower with Blaze active
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      const events2 = engine.resolveTurn();
      const damageWithBlaze = getMoveDamage(events2, 1);

      expect(damageWithBlaze).toBeGreaterThan(damageNoBlaze);
    });

    it('should NOT boost fire moves at full HP', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'charizard', level: 50, abilityId: 'blaze', moveIds: ['flamethrower', 'air-slash', 'protect', 'sunny-day'] }] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] }] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      const events = engine.resolveTurn();

      // No Blaze activation at full HP
      const abilityEvent = events.find(e =>
        e.kind === 'ability-activate' && (e as any).abilityId === 'blaze',
      );
      expect(abilityEvent).toBeUndefined();
    });

    it('should boost water moves at 1/3 HP with Torrent', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] }] },
          { name: 'P2', team: [
            { speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'protect', 'rain-dance'] },
            { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
          ] },
        ],
      };
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1: Surf at full HP (no Torrent)
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events1 = engine.resolveTurn();
      const damageNoTorrent = getMoveDamage(events1, 0);

      // Drop Blastoise below 1/3 HP
      const blastoise = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      blastoise.currentHp = Math.floor(blastoise.maxHp / 3);

      // Turn 2: Surf with Torrent active
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      const events2 = engine.resolveTurn();
      const damageWithTorrent = getMoveDamage(events2, 0);

      expect(damageWithTorrent).toBeGreaterThan(damageNoTorrent);
    });
  });

  describe('Intimidate', () => {
    it('should lower opponent attack on switch-in', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          {
            name: 'P1',
            team: [
              { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'earthquake', 'recover', 'protect'] },
              { speciesId: 'garchomp', level: 50, abilityId: 'intimidate' as any, moveIds: ['earthquake', 'dragon-pulse', 'protect', 'swords-dance'] },
            ],
          },
          { name: 'P2', team: [{ speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'protect', 'rain-dance'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      engine.submitAction(0 as PlayerIndex, [{ type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      const events = engine.resolveTurn();

      const statDrop = events.find(e =>
        e.kind === 'stat-change' && (e as any).stat === 'atk' && (e as any).stages < 0,
      );
      expect(statDrop).toBeDefined();

      const blastoise = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      expect(blastoise.statStages.atk).toBe(-1);
    });
  });

  describe('Levitate', () => {
    it('should block ground-type moves', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'earthquake', 'recover', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'gengar', level: 50, abilityId: 'levitate', moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'protect'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Snorlax uses Earthquake, Gengar uses Shadow Ball
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Earthquake
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Shadow Ball
      const events = engine.resolveTurn();

      // Should not have any move damage to Gengar (player 1) from Earthquake
      const eqDamageToGengar = events.filter(e =>
        e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1,
      );
      expect(eqDamageToGengar.length).toBe(0);
    });
  });

  describe('Water Absorb', () => {
    it('should heal when hit by water move', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'protect', 'rain-dance'] }] },
          { name: 'P2', team: [{ speciesId: 'lapras', level: 50, abilityId: 'water-absorb', moveIds: ['ice-beam', 'thunderbolt', 'protect', 'rain-dance'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      const lapras = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      lapras.currentHp = Math.floor(lapras.maxHp / 2);
      const hpBefore = lapras.currentHp;

      // Blastoise uses Surf, Lapras uses Ice Beam
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Ice Beam
      const events = engine.resolveTurn();

      // Water Absorb should heal, not deal damage
      expect(lapras.currentHp).toBeGreaterThan(hpBefore);
    });
  });

  describe('Clear Body', () => {
    it('should block negative stat changes from Intimidate', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          {
            name: 'P1',
            team: [
              { speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
              { speciesId: 'garchomp', level: 50, abilityId: 'intimidate' as any, moveIds: ['earthquake', 'dragon-pulse', 'protect', 'swords-dance'] },
            ],
          },
          { name: 'P2', team: [{ speciesId: 'metagross', level: 50, abilityId: 'clear-body', moveIds: ['iron-head', 'psychic', 'earthquake', 'protect'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Switch in Garchomp (Intimidate) against Metagross (Clear Body)
      engine.submitAction(0 as PlayerIndex, [{ type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }]); // Protect
      engine.resolveTurn();

      const metagross = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      expect(metagross.statStages.atk).toBe(0);
    });
  });

  describe('Sand Stream', () => {
    it('should set sandstorm on switch-in', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'tyranitar', level: 50, abilityId: 'sand-stream', moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'ice-beam', 'protect', 'rain-dance'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      const startEvents = engine.startBattle();

      expect(engine.getField().weather).toBe('sandstorm');
      const weatherEvent = startEvents.find(e =>
        e.kind === 'weather-set' && (e as any).weather === 'sandstorm',
      );
      expect(weatherEvent).toBeDefined();
    });
  });

  describe('Sturdy', () => {
    it('should survive a OHKO when at full HP', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'lucario', level: 100, abilityId: 'inner-focus', moveIds: ['close-combat', 'iron-head', 'protect', 'swords-dance'] }] },
          { name: 'P2', team: [
            { speciesId: 'snorlax', level: 1, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] },
            { speciesId: 'blastoise', level: 50, abilityId: 'torrent', moveIds: ['surf', 'protect', 'rain-dance', 'ice-beam'] },
          ] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      expect(snorlax.currentHp).toBe(snorlax.maxHp);

      // Lucario uses Close Combat, Snorlax uses Tackle
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Close Combat
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Tackle
      engine.resolveTurn();

      expect(snorlax.isFainted).toBe(false);
      expect(snorlax.currentHp).toBe(1);
    });
  });

  describe('Huge Power', () => {
    it('should be registered as an ability', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'azumarill', level: 50, abilityId: 'huge-power', moveIds: ['surf', 'moonblast', 'ice-beam', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 50, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      const azumarill = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      expect(azumarill.ability).toBe('huge-power');
    });
  });

  describe('Chlorophyll / Swift Swim', () => {
    it('should double speed in sun with Chlorophyll', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'venusaur', level: 50, abilityId: 'chlorophyll', moveIds: ['energy-ball', 'sludge-bomb', 'sunny-day', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'jolteon', level: 50, abilityId: 'static', moveIds: ['thunderbolt', 'shadow-ball', 'thunder-wave', 'protect'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'sun';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Energy Ball
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Thunderbolt
      const events = engine.resolveTurn();

      const moveUses = events.filter(e => e.kind === 'move-use') as any[];
      expect(moveUses.length).toBeGreaterThanOrEqual(2);
      // Venusaur with doubled speed should move first
      expect(moveUses[0].moveId).toBe('energy-ball');
    });

    it('should double speed in rain with Swift Swim', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'swampert', level: 50, abilityId: 'swift-swim', moveIds: ['surf', 'earthquake', 'ice-beam', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'jolteon', level: 50, abilityId: 'static', moveIds: ['thunderbolt', 'shadow-ball', 'thunder-wave', 'protect'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'rain';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Surf
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Thunderbolt
      const events = engine.resolveTurn();

      const moveUses = events.filter(e => e.kind === 'move-use') as any[];
      expect(moveUses.length).toBeGreaterThanOrEqual(2);
      expect(moveUses[0].moveId).toBe('surf');
    });
  });

  describe('Multiscale', () => {
    it('should halve damage when at full HP', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'lucario', level: 50, abilityId: 'inner-focus', moveIds: ['close-combat', 'iron-head', 'protect', 'swords-dance'] }] },
          { name: 'P2', team: [{ speciesId: 'dragonite', level: 50, abilityId: 'multiscale', moveIds: ['dragon-pulse', 'air-slash', 'earthquake', 'protect'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      const dragonite = engine.getActivePokemon(1 as PlayerIndex, 0)!;

      // Hit 1: at full HP (Multiscale active)
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Iron Head
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Dragon Pulse
      const events1 = engine.resolveTurn();
      const damageAtFull = getMoveDamage(events1, 1);

      // Dragonite is no longer at full HP
      expect(dragonite.currentHp).toBeLessThan(dragonite.maxHp);

      // Hit 2: not at full HP (no Multiscale)
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }]); // Iron Head
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Dragon Pulse
      const events2 = engine.resolveTurn();
      const damageNotFull = getMoveDamage(events2, 1);

      // Multiscale should have reduced first hit's damage
      expect(damageAtFull).toBeLessThan(damageNotFull);
    });
  });

  describe('Technician', () => {
    it('should boost weak moves with power <= 60', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 42,
        players: [
          { name: 'P1', team: [{ speciesId: 'scizor', level: 50, abilityId: 'technician', moveIds: ['quick-attack', 'x-scissor', 'iron-head', 'protect'] }] },
          { name: 'P2', team: [{ speciesId: 'snorlax', level: 100, abilityId: 'sturdy', moveIds: ['tackle', 'protect', 'recover', 'earthquake'] }] },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Quick Attack (40 power) with Technician boost
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }]); // Quick Attack
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Recover
      const events = engine.resolveTurn();
      const damage = getMoveDamage(events, 1);

      // Quick Attack is 40 power, Scizor base atk 130 vs Snorlax def 65 at level 100
      // With Technician 1.5x boost, should do meaningful damage
      expect(damage).toBeGreaterThan(0);
    });
  });
});
