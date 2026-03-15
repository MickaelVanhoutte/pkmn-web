import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createSubConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
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
            abilityId: 'inner-focus',
            moveIds: ['substitute', 'tackle', 'protect', 'recover'],
          },
          {
            speciesId: 'blastoise',
            level: 50,
            abilityId: 'torrent',
            moveIds: ['surf', 'ice-beam', 'rapid-spin', 'protect'],
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
            moveIds: ['flamethrower', 'will-o-wisp', 'air-slash', 'protect'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Substitute', () => {
  it('should create a substitute costing 25% max HP', () => {
    const engine = new BattleEngine(createSubConfig());
    engine.startBattle();
    const maxHp = engine.getActivePokemon(0 as PlayerIndex, 0)!.maxHp;

    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    const events = engine.resolveTurn();

    const subCreated = events.find(e => e.kind === 'substitute-created') as any;
    expect(subCreated).toBeDefined();

    const pokemon = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(pokemon.currentHp).toBe(maxHp - Math.floor(maxHp / 4));
    expect(pokemon.substituteHp).toBe(Math.floor(maxHp / 4));
  });

  it('should absorb damage from attacks', () => {
    const engine = new BattleEngine(createSubConfig());
    engine.startBattle();

    // Create substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    const hpAfterSub = engine.getActivePokemon(0 as PlayerIndex, 0)!.currentHp;

    // Attack into substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }, // tackle
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
    ]);
    engine.resolveTurn();

    // HP should not have changed (sub absorbs)
    const pokemon = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(pokemon.currentHp).toBe(hpAfterSub);
  });

  it('should block status moves', () => {
    const engine = new BattleEngine(createSubConfig());
    engine.startBattle();

    // Create substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    // Will-O-Wisp into substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }, // will-o-wisp
    ]);
    const events = engine.resolveTurn();

    const blocked = events.find(e => e.kind === 'substitute-blocked');
    expect(blocked).toBeDefined();

    // Should not be burned
    const pokemon = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(pokemon.status).toBeNull();
  });

  it('should fail when already has substitute', () => {
    const engine = new BattleEngine(createSubConfig());
    engine.startBattle();

    // Create first substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    // Try to create another
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    const events = engine.resolveTurn();

    const fail = events.find(e => e.kind === 'fail' && (e as any).reason.includes('already has'));
    expect(fail).toBeDefined();
  });

  it('should clear on switch', () => {
    const engine = new BattleEngine(createSubConfig());
    engine.startBattle();

    // Create substitute
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    // Switch out
    engine.submitAction(0 as PlayerIndex, [
      { type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    // Switch back
    engine.submitAction(0 as PlayerIndex, [
      { type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    engine.resolveTurn();

    const pokemon = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(pokemon.substituteHp).toBe(0);
  });
});
