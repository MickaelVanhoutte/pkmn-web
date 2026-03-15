import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createForceSwitchConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
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
            abilityId: 'pressure',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          },
        ],
      },
      {
        name: 'Player 2',
        team: [
          {
            speciesId: 'gengar',
            level: 50,
            abilityId: 'levitate',
            moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
          },
          {
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day', 'will-o-wisp', 'protect', 'fly', 'solar-beam', 'substitute'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Force-Switch Moves', () => {
  describe('Whirlwind', () => {
    it('should force the opponent to switch to a bench pokemon', () => {
      const engine = new BattleEngine(createForceSwitchConfig());
      engine.startBattle();

      // Player 1: Snorlax uses Whirlwind (moveIndex 6)
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 },
      ]);

      // Player 2: Gengar uses Shadow Ball (moveIndex 0)
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      ]);

      const events = engine.resolveTurn();

      // Whirlwind has -6 priority, so Gengar should move first
      const moveUses = events.filter(e => e.kind === 'move-use') as any[];
      expect(moveUses.length).toBe(2);
      expect(moveUses[0].moveId).toBe('shadow-ball');
      expect(moveUses[1].moveId).toBe('whirlwind');

      // Should have a force-switch event
      const forceSwitchEvent = events.find(e => e.kind === 'force-switch') as any;
      expect(forceSwitchEvent).toBeDefined();
      expect(forceSwitchEvent.target.player).toBe(1);

      // Should have a switch-in event for the replacement pokemon
      const switchInEvents = events.filter(e => e.kind === 'switch-in') as any[];
      const forcedSwitchIn = switchInEvents.find((e: any) => e.turn > 0 || e.pokemonName !== 'Gengar');
      expect(forcedSwitchIn).toBeDefined();
      expect(forcedSwitchIn.player).toBe(1);

      // The active pokemon should now be Charizard (the only bench option)
      const active = engine.getActivePokemon(1 as PlayerIndex, 0);
      expect(active?.species.id).toBe('charizard');
    });

    it('should fail when target has no bench pokemon', () => {
      const config = createForceSwitchConfig({
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'snorlax',
                level: 50,
                abilityId: 'pressure',
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'gengar',
                level: 50,
                abilityId: 'levitate',
                moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
              },
            ],
          },
        ],
      });

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Player 1: Snorlax uses Whirlwind (moveIndex 6)
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 },
      ]);

      // Player 2: Gengar uses Shadow Ball (moveIndex 0)
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      ]);

      const events = engine.resolveTurn();

      // Whirlwind should fail since Gengar has no bench pokemon
      const failEvent = events.find(e => e.kind === 'fail') as any;
      expect(failEvent).toBeDefined();

      // Gengar should still be active
      const active = engine.getActivePokemon(1 as PlayerIndex, 0);
      expect(active?.species.id).toBe('gengar');

      // No force-switch event should have been emitted
      const forceSwitchEvent = events.find(e => e.kind === 'force-switch');
      expect(forceSwitchEvent).toBeUndefined();
    });

    it('should be blocked by Substitute', () => {
      const engine = new BattleEngine(createForceSwitchConfig());
      engine.startBattle();

      // Turn 1: Gengar sets up Substitute, Snorlax uses Protect
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // protect
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 6 }, // substitute
      ]);

      const turn1Events = engine.resolveTurn();

      // Verify Substitute was created
      const subCreated = turn1Events.find(e => e.kind === 'substitute-created');
      expect(subCreated).toBeDefined();

      // Turn 2: Snorlax uses Whirlwind, Gengar uses Shadow Ball
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // whirlwind
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // shadow-ball
      ]);

      const turn2Events = engine.resolveTurn();

      // Whirlwind should be blocked by Substitute
      const subBlocked = turn2Events.find(e => e.kind === 'substitute-blocked');
      expect(subBlocked).toBeDefined();

      // No force-switch event should have been emitted
      const forceSwitchEvent = turn2Events.find(e => e.kind === 'force-switch');
      expect(forceSwitchEvent).toBeUndefined();

      // Gengar should still be active (not switched out)
      const active = engine.getActivePokemon(1 as PlayerIndex, 0);
      expect(active?.species.id).toBe('gengar');
    });
  });

  describe('Roar', () => {
    it('should bypass Substitute (sound-based) and force switch', () => {
      const config: BattleConfig = {
        format: 'singles',
        seed: 12345,
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'dragonite',
                level: 50,
                abilityId: 'multiscale',
                moveIds: ['dragon-pulse', 'air-slash', 'earthquake', 'ice-beam', 'protect', 'fly', 'roar', 'substitute'],
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'gengar',
                level: 50,
                abilityId: 'levitate',
                moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
              },
              {
                speciesId: 'charizard',
                level: 50,
                abilityId: 'blaze',
                moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day', 'will-o-wisp', 'protect', 'fly', 'solar-beam', 'substitute'],
              },
            ],
          },
        ],
      };

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1: Gengar sets up Substitute, Dragonite uses Protect
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // protect
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 6 }, // substitute
      ]);

      const turn1Events = engine.resolveTurn();

      // Verify Substitute was created
      const subCreated = turn1Events.find(e => e.kind === 'substitute-created');
      expect(subCreated).toBeDefined();

      // Turn 2: Dragonite uses Roar (moveIndex 6), Gengar uses Shadow Ball
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // roar
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // shadow-ball
      ]);

      const turn2Events = engine.resolveTurn();

      // Roar is sound-based, so it should NOT be blocked by Substitute
      const subBlocked = turn2Events.find(e => e.kind === 'substitute-blocked');
      expect(subBlocked).toBeUndefined();

      // Should have a force-switch event
      const forceSwitchEvent = turn2Events.find(e => e.kind === 'force-switch') as any;
      expect(forceSwitchEvent).toBeDefined();
      expect(forceSwitchEvent.target.player).toBe(1);

      // The active pokemon should now be Charizard
      const active = engine.getActivePokemon(1 as PlayerIndex, 0);
      expect(active?.species.id).toBe('charizard');
    });
  });
});
