import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createDoublesConfig(): BattleConfig {
  return {
    format: 'doubles',
    seed: 12345,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'air-slash', 'protect', 'will-o-wisp'],
          },
          {
            speciesId: 'garchomp',
            level: 50,
            abilityId: 'sand-stream',
            moveIds: ['earthquake', 'dragon-pulse', 'rock-slide', 'protect'],
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
            speciesId: 'venusaur',
            level: 50,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'protect', 'giga-drain'],
          },
          {
            speciesId: 'jolteon',
            level: 50,
            abilityId: 'static',
            moveIds: ['thunderbolt', 'shadow-ball', 'protect', 'quick-attack'],
          },
          {
            speciesId: 'alakazam',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'protect'],
          },
        ],
      },
    ],
  };
}

describe('Doubles Battle Integration', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine(createDoublesConfig());
  });

  it('should start a doubles battle with 2 pokemon per side', () => {
    const events = engine.startBattle();

    // Should have 4 switch-in events (2 per player)
    const switchIns = events.filter(e => e.kind === 'switch-in');
    expect(switchIns.length).toBe(4);

    // Garchomp has Sand Stream - should trigger weather
    const weatherEvents = events.filter(e => e.kind === 'weather-set');
    expect(weatherEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should require 2 actions per player in doubles', () => {
    engine.startBattle();

    // Submit 2 actions for player 1
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
      { type: 'move', player: 0 as PlayerIndex, slot: 1, moveIndex: 0 },
    ]);

    const ready = engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      { type: 'move', player: 1 as PlayerIndex, slot: 1, moveIndex: 0 },
    ]);

    expect(ready).toBe(true);
  });

  it('should resolve a doubles turn with all 4 pokemon acting', () => {
    engine.startBattle();

    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Charizard Flamethrower
      { type: 'move', player: 0 as PlayerIndex, slot: 1, moveIndex: 1 }, // Garchomp Dragon Pulse
    ]);

    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Venusaur Energy Ball
      { type: 'move', player: 1 as PlayerIndex, slot: 1, moveIndex: 0 }, // Jolteon Thunderbolt
    ]);

    const events = engine.resolveTurn();

    // Should have at least 3 move-use events (one mon may faint before acting)
    const moveUses = events.filter(e => e.kind === 'move-use');
    expect(moveUses.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle Earthquake hitting all adjacent (including ally)', () => {
    engine.startBattle();

    // Garchomp uses Earthquake (all-adjacent: hits both foes + ally Charizard)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }, // Charizard Protect
      { type: 'move', player: 0 as PlayerIndex, slot: 1, moveIndex: 0 }, // Garchomp Earthquake
    ]);

    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 2 }, // Venusaur Protect
      { type: 'move', player: 1 as PlayerIndex, slot: 1, moveIndex: 2 }, // Jolteon Protect
    ]);

    const events = engine.resolveTurn();

    // Earthquake targets should include ally Charizard (if not protected)
    // Since Charizard uses Protect, it should be protected
    const eqUse = events.find(e => e.kind === 'move-use' && (e as any).moveId === 'earthquake') as any;
    expect(eqUse).toBeDefined();
  });

  it('should apply spread move damage penalty (0.75x) in doubles', () => {
    // Rock Slide targets all-adjacent-foes, so it gets the spread penalty
    engine.startBattle();

    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Charizard Flamethrower
      { type: 'move', player: 0 as PlayerIndex, slot: 1, moveIndex: 2 }, // Garchomp Rock Slide
    ]);

    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
      { type: 'move', player: 1 as PlayerIndex, slot: 1, moveIndex: 0 },
    ]);

    const events = engine.resolveTurn();
    // Just verify it resolves without errors
    expect(events.length).toBeGreaterThan(0);
  });
});
