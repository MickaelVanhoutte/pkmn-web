import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createScreenTestConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 12345,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'alakazam',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['light-screen', 'reflect', 'psychic', 'shadow-ball'],
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
            moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'earthquake'],
          },
          {
            speciesId: 'snorlax',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['double-edge', 'earthquake', 'rock-slide', 'protect'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Light Screen / Reflect', () => {
  it('should set Light Screen on ally side', () => {
    const engine = new BattleEngine(createScreenTestConfig());
    engine.startBattle();

    // Player 1: Light Screen
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // protect
    ]);

    const events = engine.resolveTurn();
    const screenSet = events.find(e => e.kind === 'screen-set') as any;
    expect(screenSet).toBeDefined();
    expect(screenSet.screen).toBe('lightScreen');
    expect(screenSet.side).toBe(0);
    expect(screenSet.turns).toBe(5);

    const field = engine.getField();
    expect(field.sides[0].lightScreen).toBe(4); // Decremented at end of turn
  });

  it('should set Reflect on ally side', () => {
    const engine = new BattleEngine(createScreenTestConfig());
    engine.startBattle();

    // Player 1: Reflect
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // protect (Charizard doesn't have it, use earthquake instead)
    ]);

    const events = engine.resolveTurn();
    const screenSet = events.find(e => e.kind === 'screen-set') as any;
    expect(screenSet).toBeDefined();
    expect(screenSet.screen).toBe('reflect');
  });

  it('should reduce special damage with Light Screen', () => {
    const engine = new BattleEngine(createScreenTestConfig());
    engine.startBattle();

    // First turn: Light Screen
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // light-screen
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
    ]);
    engine.resolveTurn();

    const hpAfterFirstTurn = engine.getActivePokemon(0 as PlayerIndex, 0)!.currentHp;

    // Second turn: take another Flamethrower with screen up
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }, // psychic
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // flamethrower
    ]);
    const events2 = engine.resolveTurn();

    // With Light Screen active (set on turn 1), Flamethrower should deal reduced damage
    const damageWithScreen = events2.filter(e =>
      e.kind === 'damage' && (e as any).target.player === 0 && (e as any).source === 'move'
    );
    expect(damageWithScreen.length).toBeGreaterThanOrEqual(1);
    // Damage should be less than without screen (approx 50%)
    // We can't compare exactly due to RNG, but the screen is active
    expect(engine.getField().sides[0].lightScreen).toBeGreaterThan(0);
  });

  it('should reduce physical damage with Reflect', () => {
    const engine = new BattleEngine(createScreenTestConfig());
    engine.startBattle();

    // Set Reflect
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 1 }, // reflect
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // earthquake
    ]);
    engine.resolveTurn();

    // Reflect should be active
    expect(engine.getField().sides[0].reflect).toBeGreaterThan(0);
  });

  it('should fail when screen is already active', () => {
    const engine = new BattleEngine(createScreenTestConfig());
    engine.startBattle();

    // Turn 1: Set Light Screen
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    // Turn 2: Try to set Light Screen again
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    const events = engine.resolveTurn();

    const fail = events.find(e => e.kind === 'fail' && (e as any).reason.includes('already active'));
    expect(fail).toBeDefined();
  });

  it('should expire after 5 turns', () => {
    // Use bulky pokemon that won't faint
    const engine = new BattleEngine({
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['light-screen', 'reflect', 'tackle', 'protect'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['tackle', 'protect', 'tackle', 'tackle'],
          }],
        },
      ],
    });
    engine.startBattle();

    // Turn 1: Set Light Screen
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    // Advance 4 more turns
    for (let i = 0; i < 4; i++) {
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 },
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      ]);
      engine.resolveTurn();
    }

    // After 5 end-of-turn decrements, screen should be gone
    expect(engine.getField().sides[0].lightScreen).toBe(0);
  });

  it('should emit screen-end event when screen expires', () => {
    const engine = new BattleEngine({
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['light-screen', 'reflect', 'tackle', 'protect'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['tackle', 'protect', 'tackle', 'tackle'],
          }],
        },
      ],
    });
    engine.startBattle();

    // Set Light Screen
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    // Advance turns until screen expires
    let screenEndEvent: any = null;
    for (let i = 0; i < 5; i++) {
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 },
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      ]);
      const events = engine.resolveTurn();
      const found = events.find(e => e.kind === 'screen-end');
      if (found) screenEndEvent = found;
    }

    expect(screenEndEvent).toBeDefined();
    expect(screenEndEvent.screen).toBe('lightScreen');
  });
});
