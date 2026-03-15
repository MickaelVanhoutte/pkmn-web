import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig } from '../../src/types/battle';
import type { PlayerIndex } from '../../src/types/common';

function createEndOfTurnConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 42,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'recover', 'protect', 'earthquake'],
          },
          {
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'protect', 'sunny-day', 'air-slash'],
          },
        ],
      },
      {
        name: 'Player 2',
        team: [
          {
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'recover', 'protect', 'earthquake'],
          },
          {
            speciesId: 'blastoise',
            level: 50,
            abilityId: 'torrent',
            moveIds: ['surf', 'protect', 'rain-dance', 'ice-beam'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('End-of-Turn Processing', () => {
  describe('End-of-turn order', () => {
    it('should process weather damage before status damage', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Set sandstorm and burn on Snorlax P2
      (engine.getField() as any).weather = 'sandstorm';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      snorlax.status = 'burn';

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      const events = engine.resolveTurn();

      // Weather damage should come before status damage
      const weatherDamageIdx = events.findIndex(e => e.kind === 'weather-damage' && (e as any).target.player === 1);
      const statusDamageIdx = events.findIndex(e => e.kind === 'status-damage' && (e as any).target.player === 1);

      expect(weatherDamageIdx).toBeGreaterThan(-1);
      expect(statusDamageIdx).toBeGreaterThan(-1);
      expect(weatherDamageIdx).toBeLessThan(statusDamageIdx);
    });
  });

  describe('Leftovers healing', () => {
    it('should heal 1/16 HP at end of turn', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      snorlax.item = 'leftovers';
      snorlax.currentHp = Math.floor(snorlax.maxHp / 2);
      const hpBefore = snorlax.currentHp;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      const events = engine.resolveTurn();

      const healEvent = events.find(e =>
        e.kind === 'heal' && (e as any).source === 'item' && (e as any).target.player === 0,
      );
      expect(healEvent).toBeDefined();
      expect(snorlax.currentHp).toBeGreaterThan(hpBefore);

      const expectedHeal = Math.max(1, Math.floor(snorlax.maxHp / 16));
      expect(snorlax.currentHp).toBe(hpBefore + expectedHeal);
    });

    it('should not overheal above max HP', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      snorlax.item = 'leftovers';
      // Already at max HP
      expect(snorlax.currentHp).toBe(snorlax.maxHp);

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]); // Protect
      engine.resolveTurn();

      expect(snorlax.currentHp).toBe(snorlax.maxHp);
    });
  });

  describe('Screen countdown', () => {
    it('should decrement Light Screen each turn and expire', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Set light screen with 2 turns remaining
      (engine.getField() as any).sides[0].lightScreen = 2;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.resolveTurn();

      expect(engine.getField().sides[0].lightScreen).toBe(1);

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      expect(engine.getField().sides[0].lightScreen).toBe(0);
      const screenEnd = events.find(e =>
        e.kind === 'screen-end' && (e as any).screen === 'lightScreen',
      );
      expect(screenEnd).toBeDefined();
    });

    it('should decrement Tailwind and emit end event', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).sides[0].tailwind = 1;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      expect(engine.getField().sides[0].tailwind).toBe(0);
      const tailwindEnd = events.find(e =>
        e.kind === 'screen-end' && (e as any).screen === 'tailwind',
      );
      expect(tailwindEnd).toBeDefined();
    });
  });

  describe('Trick Room countdown', () => {
    it('should decrement Trick Room and emit message when it ends', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).trickRoom = 1;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      expect(engine.getField().trickRoom).toBe(0);
      const trickRoomMsg = events.find(e =>
        e.kind === 'message' && (e as any).text.includes('twisted dimensions'),
      );
      expect(trickRoomMsg).toBeDefined();
    });
  });

  describe('Status weather curing', () => {
    it('should cure burn in rain before burn deals damage', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'rain';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      snorlax.status = 'burn';
      const hpBefore = snorlax.currentHp;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      // Burn should be cured by rain, no burn damage
      expect(snorlax.status).toBeNull();
      const statusCured = events.find(e =>
        e.kind === 'status-cured' && (e as any).status === 'burn' && (e as any).source === 'weather',
      );
      expect(statusCured).toBeDefined();
    });
  });

  describe('maxTurns enforcement', () => {
    it('should end battle when maxTurns is reached', () => {
      const config = createEndOfTurnConfig({ maxTurns: 2 });
      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.resolveTurn();
      expect(engine.isOver()).toBe(false);

      // Turn 2
      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      expect(engine.isOver()).toBe(true);
      const battleEnd = events.find(e => e.kind === 'battle-end') as any;
      expect(battleEnd).toBeDefined();
      expect(battleEnd.reason).toBe('turn-limit');
      expect(battleEnd.winner).toBeNull(); // draw
    });
  });

  describe('Grassy Terrain healing', () => {
    it('should heal grounded pokemon 1/16 HP at end of turn', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).terrain = 'grassy';
      (engine.getField() as any).terrainTurnsRemaining = 5;

      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      snorlax.currentHp = Math.floor(snorlax.maxHp / 2);
      const hpBefore = snorlax.currentHp;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      const healEvent = events.find(e =>
        e.kind === 'heal' && (e as any).source === 'terrain',
      );
      expect(healEvent).toBeDefined();
      expect(snorlax.currentHp).toBeGreaterThan(hpBefore);
    });
  });

  describe('Terrain expiry', () => {
    it('should end terrain after turns expire', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).terrain = 'electric';
      (engine.getField() as any).terrainTurnsRemaining = 1;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      const events = engine.resolveTurn();

      expect(engine.getField().terrain).toBeNull();
      const terrainEnd = events.find(e => e.kind === 'terrain-end');
      expect(terrainEnd).toBeDefined();
    });
  });

  describe('Win condition check at end of turn', () => {
    it('should end battle if pokemon faints from status damage', () => {
      const config = createEndOfTurnConfig();
      // Only 1 pokemon per team
      config.players[1].team = [{
        speciesId: 'charizard',
        level: 50,
        abilityId: 'blaze',
        moveIds: ['flamethrower', 'protect', 'sunny-day', 'air-slash'],
      }];
      const engine = new BattleEngine(config);
      engine.startBattle();

      const charizard = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      charizard.status = 'burn';
      charizard.currentHp = 1; // will die to burn damage

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]);
      const events = engine.resolveTurn();

      expect(engine.isOver()).toBe(true);
      expect(engine.getWinner()).toBe(0);
    });

    it('should end battle if pokemon faints from weather damage', () => {
      const config = createEndOfTurnConfig();
      config.players[1].team = [{
        speciesId: 'charizard',
        level: 50,
        abilityId: 'blaze',
        moveIds: ['flamethrower', 'protect', 'sunny-day', 'air-slash'],
      }];
      const engine = new BattleEngine(config);
      engine.startBattle();

      (engine.getField() as any).weather = 'sandstorm';
      (engine.getField() as any).weatherTurnsRemaining = 5;

      const charizard = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      charizard.currentHp = 1;

      engine.submitAction(0 as PlayerIndex, [{ type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }]);
      engine.submitAction(1 as PlayerIndex, [{ type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }]);
      const events = engine.resolveTurn();

      expect(engine.isOver()).toBe(true);
      expect(engine.getWinner()).toBe(0);
    });
  });

  describe('Forfeit', () => {
    it('should end the battle with the other player winning', () => {
      const config = createEndOfTurnConfig();
      const engine = new BattleEngine(config);
      engine.startBattle();

      const events = engine.forfeit(0 as PlayerIndex);

      expect(engine.isOver()).toBe(true);
      expect(engine.getWinner()).toBe(1);
      const battleEnd = events.find(e => e.kind === 'battle-end') as any;
      expect(battleEnd.reason).toBe('forfeit');
      expect(battleEnd.winner).toBe(1);
    });
  });
});
