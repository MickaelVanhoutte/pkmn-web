import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createItemTestConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 12345,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'snorlax',
            level: 50,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover'],
          },
        ],
      },
      {
        name: 'Player 2',
        team: [
          {
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Item Effects', () => {
  describe('Potion', () => {
    it('should heal HP when used as an item action', () => {
      const engine = new BattleEngine(createItemTestConfig());
      engine.startBattle();

      const snorlaxBefore = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      const maxHp = snorlaxBefore.maxHp;

      // Turn 1: Both attack. Charizard's flamethrower damages Snorlax.
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
      ]);
      engine.resolveTurn();

      const snorlaxAfterTurn1 = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      const hpAfterDamage = snorlaxAfterTurn1.currentHp;
      expect(hpAfterDamage).toBeLessThan(maxHp);

      // Turn 2: Player 0 uses Potion on Snorlax (team index 0), Player 1 attacks.
      engine.submitAction(0 as PlayerIndex, [
        { type: 'item', player: 0 as PlayerIndex, itemId: 'potion', targetTeamIndex: 0 },
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
      ]);
      const turn2Events = engine.resolveTurn();

      // Should have an item-used event for the potion
      const itemUsedEvent = turn2Events.find(e => e.kind === 'item-used') as any;
      expect(itemUsedEvent).toBeDefined();
      expect(itemUsedEvent.itemId).toBe('potion');

      // Should have a heal event from 'item' source
      const healEvent = turn2Events.find(
        e => e.kind === 'heal' && (e as any).source === 'item'
      ) as any;
      expect(healEvent).toBeDefined();
      expect(healEvent.amount).toBeLessThanOrEqual(20); // potion heals up to 20 HP
      expect(healEvent.amount).toBeGreaterThan(0);
    });
  });

  describe('Leftovers', () => {
    it('should heal 1/16 max HP at end of turn', () => {
      const engine = new BattleEngine(createItemTestConfig({
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'snorlax',
                level: 50,
                abilityId: 'sturdy',
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover'],
                itemId: 'leftovers',
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'charizard',
                level: 50,
                abilityId: 'blaze',
                moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day'],
              },
            ],
          },
        ],
      }));
      engine.startBattle();

      // Verify Snorlax has leftovers equipped
      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      expect(snorlax.item).toBe('leftovers');
      const maxHp = snorlax.maxHp;

      // Turn 1: Both attack. Snorlax takes damage from flamethrower,
      // then leftovers should heal at end of turn.
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
      ]);
      const events = engine.resolveTurn();

      // Should have a heal event from 'item' source (leftovers end-of-turn heal)
      const healEvents = events.filter(
        e => e.kind === 'heal' && (e as any).source === 'item'
      ) as any[];
      expect(healEvents.length).toBeGreaterThanOrEqual(1);

      // The heal amount should be floor(maxHp / 16)
      const expectedHeal = Math.floor(maxHp / 16);
      const leftoversHeal = healEvents.find(
        (e: any) => e.target.player === 0
      );
      expect(leftoversHeal).toBeDefined();
      expect(leftoversHeal.amount).toBe(expectedHeal);
    });
  });

  describe('Life Orb', () => {
    it('should boost damage and cause recoil to the user', () => {
      const engine = new BattleEngine(createItemTestConfig({
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'snorlax',
                level: 50,
                abilityId: 'sturdy',
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover'],
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'charizard',
                level: 50,
                abilityId: 'blaze',
                moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day'],
                itemId: 'life-orb',
              },
            ],
          },
        ],
      }));
      engine.startBattle();

      const charizard = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      expect(charizard.item).toBe('life-orb');
      const charizardMaxHp = charizard.maxHp;

      // Turn 1: Both attack. Charizard with Life Orb uses flamethrower.
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
      ]);
      const events = engine.resolveTurn();

      // Charizard should take recoil damage from Life Orb (10% max HP)
      const recoilEvents = events.filter(
        e => e.kind === 'damage' && (e as any).source === 'recoil' && (e as any).target.player === 1
      ) as any[];
      expect(recoilEvents.length).toBeGreaterThanOrEqual(1);

      const expectedRecoil = Math.floor(charizardMaxHp / 10);
      expect(recoilEvents[0].amount).toBe(expectedRecoil);

      // Charizard should have lost HP from recoil
      const charizardAfter = engine.getActivePokemon(1 as PlayerIndex, 0)!;
      expect(charizardAfter.currentHp).toBeLessThan(charizardMaxHp);
    });
  });

  describe('Choice Band', () => {
    it('should lock the user into the first move used', () => {
      const engine = new BattleEngine(createItemTestConfig({
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'snorlax',
                level: 50,
                abilityId: 'sturdy',
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover'],
                itemId: 'choice-band',
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'charizard',
                level: 50,
                abilityId: 'blaze',
                moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day'],
              },
            ],
          },
        ],
      }));
      engine.startBattle();

      const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      expect(snorlax.item).toBe('choice-band');
      expect(snorlax.choiceLocked).toBeNull();

      // Turn 1: Snorlax uses Tackle (moveIndex 0). Should get choice-locked.
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
      ]);
      engine.resolveTurn();

      // After using Tackle, Snorlax should be choice-locked to 'tackle'
      const snorlaxAfter = engine.getActivePokemon(0 as PlayerIndex, 0)!;
      expect(snorlaxAfter.choiceLocked).toBe('tackle');
    });
  });
});
