import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createMultiHitTestConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 12345,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'tyranitar',
            level: 50,
            abilityId: 'sand-stream',
            moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'stealth-rock', 'protect', 'pursuit', 'substitute', 'rock-blast'],
            // rock-blast is moveIndex 7
          },
          {
            speciesId: 'scizor',
            level: 50,
            abilityId: 'technician',
            moveIds: ['x-scissor', 'iron-head', 'quick-attack', 'swords-dance', 'protect', 'bullet-seed', 'dual-wingbeat', 'pursuit', 'substitute'],
            // bullet-seed is moveIndex 5, dual-wingbeat is moveIndex 6
          },
        ],
      },
      {
        name: 'Player 2',
        team: [
          {
            speciesId: 'snorlax',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect'],
          },
          {
            speciesId: 'lapras',
            level: 50,
            abilityId: 'water-absorb',
            moveIds: ['surf', 'ice-beam', 'thunderbolt', 'rain-dance', 'protect', 'icicle-spear', 'substitute', 'confuse-ray'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Multi-Hit Moves', () => {
  it('should deal damage multiple times with Rock Blast', () => {
    const engine = new BattleEngine(createMultiHitTestConfig());
    engine.startBattle();

    // Player 1 (Tyranitar): Rock Blast (moveIndex 7)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    // Player 2 (Snorlax): Protect (moveIndex 4) - use protect so we can test on next turn
    // Actually, let's just have Snorlax use Tackle so we see Rock Blast hit
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
    ]);

    const events = engine.resolveTurn();

    // Rock Blast should produce multiple damage events from 'move' source against player 1's target
    const damageEvents = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    );

    // Multi-hit moves deal 2-5 hits, so we expect at least 2 damage events
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
    expect(damageEvents.length).toBeLessThanOrEqual(5);
  });

  it('should always hit exactly 2 times with Dual Wingbeat (fixed-multi-hit)', () => {
    // Use scizor with dual-wingbeat against snorlax
    const engine = new BattleEngine(createMultiHitTestConfig({
      seed: 99999,
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'scizor',
              level: 50,
              abilityId: 'technician',
              moveIds: ['x-scissor', 'iron-head', 'quick-attack', 'swords-dance', 'protect', 'bullet-seed', 'dual-wingbeat', 'pursuit', 'substitute'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [
            {
              speciesId: 'snorlax',
              level: 100,
              abilityId: 'inner-focus',
              moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect'],
            },
          ],
        },
      ],
    }));
    engine.startBattle();

    // Scizor: Dual Wingbeat (moveIndex 6)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
    ]);

    const events = engine.resolveTurn();

    // Dual Wingbeat always hits exactly 2 times
    const damageEvents = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    );
    expect(damageEvents.length).toBe(2);

    // Verify the multi-hit-complete event also reports 2 hits
    const multiHitComplete = events.find(e => e.kind === 'multi-hit-complete') as any;
    expect(multiHitComplete).toBeDefined();
    expect(multiHitComplete.hitCount).toBe(2);
  });

  it('should stop hitting if target faints mid-multi-hit', () => {
    // Use a very high level attacker against a very low level defender to ensure a KO
    const engine = new BattleEngine(createMultiHitTestConfig({
      seed: 42,
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'tyranitar',
              level: 100,
              abilityId: 'sand-stream',
              moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'stealth-rock', 'protect', 'pursuit', 'substitute', 'rock-blast'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [
            {
              speciesId: 'scizor',
              level: 1,
              abilityId: 'technician',
              moveIds: ['x-scissor', 'iron-head', 'quick-attack', 'swords-dance', 'protect', 'bullet-seed', 'dual-wingbeat', 'pursuit', 'substitute'],
            },
          ],
        },
      ],
    }));
    engine.startBattle();

    // Tyranitar (lv100): Rock Blast (moveIndex 7) vs Scizor (lv1)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // x-scissor
    ]);

    const events = engine.resolveTurn();

    // The target should faint
    const faintEvent = events.find(e => e.kind === 'faint' && (e as any).target.player === 1);
    expect(faintEvent).toBeDefined();

    // Count damage events against the target - should be fewer than max possible
    // because the target fainted (likely on the first hit at lv1 vs lv100)
    const damageToTarget = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    );

    // A lv1 scizor should faint on the first hit from a lv100 Tyranitar's Rock Blast,
    // so we expect only 1 damage event
    expect(damageToTarget.length).toBe(1);
  });

  it('should emit multi-hit-complete event with hit count', () => {
    const engine = new BattleEngine(createMultiHitTestConfig());
    engine.startBattle();

    // Tyranitar: Rock Blast (moveIndex 7) vs Snorlax
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // tackle
    ]);

    const events = engine.resolveTurn();

    const multiHitComplete = events.find(e => e.kind === 'multi-hit-complete') as any;
    expect(multiHitComplete).toBeDefined();
    expect(multiHitComplete.target).toBeDefined();
    expect(multiHitComplete.target.player).toBe(1);
    expect(multiHitComplete.hitCount).toBeGreaterThanOrEqual(2);
    expect(multiHitComplete.hitCount).toBeLessThanOrEqual(5);
  });
});
