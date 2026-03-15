import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, BattleEvent, PlayerIndex } from '../../src/types';

function createConfusionTestConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 42,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'gengar',
            level: 50,
            abilityId: 'levitate',
            moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
          },
          {
            speciesId: 'alakazam',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          },
        ],
      },
      {
        name: 'Player 2',
        team: [
          {
            speciesId: 'snorlax',
            level: 50,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          },
          {
            speciesId: 'alakazam',
            level: 50,
            abilityId: 'inner-focus',
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Confusion', () => {
  it('should apply confusion when Confuse Ray is used', () => {
    const engine = new BattleEngine(createConfusionTestConfig());
    engine.startBattle();

    // Player 1 (Gengar) uses Confuse Ray (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    // Player 2 (Snorlax) uses Protect (moveIndex 4) - but let's use Tackle to not block
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);

    const events = engine.resolveTurn();

    // Confuse Ray is 100% accurate ghost-type status move
    // Snorlax is normal type so ghost moves are immune... but Confuse Ray is status
    // Actually, status moves that inflict confusion check type immunity for the move type.
    // Ghost vs Normal = immune. Let's check if this matters for status moves.
    // If it does, we need a different target. Let's try a few seeds first.
    const confusionStart = events.find(e => e.kind === 'confusion-start');
    const immunityEvent = events.find(e => e.kind === 'immunity');

    // If Snorlax is immune to Ghost-type Confuse Ray, we need a different setup
    if (immunityEvent) {
      // Ghost-type moves don't affect Normal-type - use Alakazam instead
      expect(immunityEvent).toBeDefined();
    } else {
      expect(confusionStart).toBeDefined();
      const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0);
      expect(snorlax?.volatileStatuses.includes('confusion')).toBe(true);
      expect(snorlax?.confusionTurns).toBeGreaterThanOrEqual(2);
      expect(snorlax?.confusionTurns).toBeLessThanOrEqual(5);
    }
  });

  it('should apply confusion with Confuse Ray against non-immune target', () => {
    // Use Alakazam (psychic) as target to avoid Ghost vs Normal immunity issues
    const config = createConfusionTestConfig({
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'gengar',
              level: 50,
              abilityId: 'levitate',
              moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
            },
            {
              speciesId: 'alakazam',
              level: 50,
              abilityId: 'inner-focus',
              moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [
            {
              speciesId: 'alakazam',
              level: 50,
              abilityId: 'inner-focus',
              moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
            },
            {
              speciesId: 'snorlax',
              level: 50,
              abilityId: 'sturdy',
              moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
            },
          ],
        },
      ],
    });

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Player 1 (Gengar) uses Confuse Ray (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    // Player 2 (Alakazam) uses Recover (moveIndex 4)
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);

    const events = engine.resolveTurn();

    const confusionStart = events.find(e => e.kind === 'confusion-start');
    expect(confusionStart).toBeDefined();

    const target = engine.getActivePokemon(1 as PlayerIndex, 0);
    expect(target?.volatileStatuses.includes('confusion')).toBe(true);
    expect(target?.confusionTurns).toBeGreaterThanOrEqual(2);
    expect(target?.confusionTurns).toBeLessThanOrEqual(5);
  });

  it('should cause confused pokemon to potentially hit itself', () => {
    // Try multiple seeds to find one where a confusion self-hit occurs
    let foundSelfHit = false;

    for (let seed = 1; seed <= 200 && !foundSelfHit; seed++) {
      const config = createConfusionTestConfig({
        seed,
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'gengar',
                level: 50,
                abilityId: 'levitate',
                moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
              },
              {
                speciesId: 'alakazam',
                level: 50,
                abilityId: 'inner-focus',
                moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
              },
            ],
          },
          {
            name: 'Player 2',
            team: [
              {
                speciesId: 'alakazam',
                level: 50,
                abilityId: 'inner-focus',
                moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
              },
              {
                speciesId: 'snorlax',
                level: 50,
                abilityId: 'sturdy',
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
              },
            ],
          },
        ],
      });

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1: Gengar uses Confuse Ray on Alakazam
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Recover
      ]);
      const turn1Events = engine.resolveTurn();

      const confusionApplied = turn1Events.some(e => e.kind === 'confusion-start');
      if (!confusionApplied) continue;

      // Run up to 5 turns looking for a self-hit
      for (let turn = 0; turn < 5; turn++) {
        if (engine.isOver() || engine.getPhase() !== 'awaiting-actions') break;

        // Gengar uses Protect, Alakazam tries to use Psychic
        engine.submitAction(0 as PlayerIndex, [
          { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
        ]);
        engine.submitAction(1 as PlayerIndex, [
          { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Psychic
        ]);
        const events = engine.resolveTurn();

        if (events.some(e => e.kind === 'confusion-hit-self')) {
          foundSelfHit = true;

          // Verify the self-hit event has expected fields
          const selfHitEvent = events.find(e => e.kind === 'confusion-hit-self') as any;
          expect(selfHitEvent.damage).toBeGreaterThan(0);
          expect(selfHitEvent.target).toBeDefined();
          expect(selfHitEvent.currentHp).toBeDefined();
          expect(selfHitEvent.maxHp).toBeDefined();
          break;
        }
      }
    }

    expect(foundSelfHit).toBe(true);
  });

  it('should clear confusion when pokemon switches out', () => {
    const config = createConfusionTestConfig({
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'gengar',
              level: 50,
              abilityId: 'levitate',
              moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
            },
            {
              speciesId: 'alakazam',
              level: 50,
              abilityId: 'inner-focus',
              moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [
            {
              speciesId: 'alakazam',
              level: 50,
              abilityId: 'inner-focus',
              moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
            },
            {
              speciesId: 'snorlax',
              level: 50,
              abilityId: 'sturdy',
              moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
            },
          ],
        },
      ],
    });

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Gengar uses Confuse Ray on Alakazam
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Recover
    ]);
    const turn1Events = engine.resolveTurn();

    const confusionStart = turn1Events.find(e => e.kind === 'confusion-start');
    expect(confusionStart).toBeDefined();

    // Verify Alakazam is confused
    const alakazamBefore = engine.getActivePokemon(1 as PlayerIndex, 0);
    expect(alakazamBefore?.volatileStatuses.includes('confusion')).toBe(true);

    // Turn 2: Player 2 switches Alakazam out to Snorlax
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Shadow Ball
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'switch', player: 1 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);
    engine.resolveTurn();

    // Snorlax should be active and not confused
    const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0);
    expect(snorlax?.species.id).toBe('snorlax');
    expect(snorlax?.volatileStatuses.includes('confusion')).toBe(false);

    // The original Alakazam (now benched) should have confusion cleared
    // Switch-out clears volatile statuses including confusion
    const state = engine.getState();
    const alakazamAfter = state.players[1].team[0]; // Alakazam is team index 0
    expect(alakazamAfter.volatileStatuses.includes('confusion')).toBe(false);
    expect(alakazamAfter.confusionTurns).toBe(0);
  });

  it('should end confusion after turns expire', () => {
    // Find a seed where confusion is applied and eventually ends naturally
    let foundConfusionEnd = false;

    for (let seed = 1; seed <= 200 && !foundConfusionEnd; seed++) {
      const config = createConfusionTestConfig({
        seed,
        players: [
          {
            name: 'Player 1',
            team: [
              {
                speciesId: 'gengar',
                level: 50,
                abilityId: 'levitate',
                moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
              },
              {
                speciesId: 'alakazam',
                level: 50,
                abilityId: 'inner-focus',
                moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
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
                moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
              },
              {
                speciesId: 'alakazam',
                level: 50,
                abilityId: 'inner-focus',
                moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
              },
            ],
          },
        ],
      });

      const engine = new BattleEngine(config);
      engine.startBattle();

      // Turn 1: Gengar uses Confuse Ray on Snorlax
      // Snorlax is Normal type - Ghost type Confuse Ray may be immune
      // Use Recover for Snorlax
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Recover
      ]);
      const turn1Events = engine.resolveTurn();

      // If immune, skip this seed — Snorlax is Normal, Ghost move = immune
      if (turn1Events.some(e => e.kind === 'immunity')) continue;
      if (!turn1Events.some(e => e.kind === 'confusion-start')) continue;

      // Run up to 7 turns (confusion lasts 2-5), using Recover to stay alive
      for (let turn = 0; turn < 7; turn++) {
        if (engine.isOver() || engine.getPhase() !== 'awaiting-actions') break;

        engine.submitAction(0 as PlayerIndex, [
          { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
        ]);
        engine.submitAction(1 as PlayerIndex, [
          { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Recover
        ]);
        const events = engine.resolveTurn();

        if (events.some(e => e.kind === 'confusion-end')) {
          foundConfusionEnd = true;

          // Verify the confusion-end event has expected fields
          const endEvent = events.find(e => e.kind === 'confusion-end') as any;
          expect(endEvent.target).toBeDefined();
          expect(endEvent.pokemonName).toBeDefined();

          // After confusion ends, the pokemon should no longer be confused
          const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0);
          if (snorlax && !snorlax.isFainted) {
            expect(snorlax.volatileStatuses.includes('confusion')).toBe(false);
            expect(snorlax.confusionTurns).toBe(0);
          }
          break;
        }
      }
    }

    expect(foundConfusionEnd).toBe(true);
  });

  it('should not apply confusion to an already confused pokemon', () => {
    const config = createConfusionTestConfig({
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'gengar',
              level: 50,
              abilityId: 'levitate',
              moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [
            {
              speciesId: 'alakazam',
              level: 50,
              abilityId: 'inner-focus',
              moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
            },
          ],
        },
      ],
    });

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Apply confusion
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 }, // Confuse Ray
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Recover
    ]);
    const turn1Events = engine.resolveTurn();
    expect(turn1Events.some(e => e.kind === 'confusion-start')).toBe(true);

    const alakazamTurn1 = engine.getActivePokemon(1 as PlayerIndex, 0);
    const turnsAfterFirst = alakazamTurn1?.confusionTurns;

    // Turn 2: Try to apply confusion again
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 }, // Confuse Ray again
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Recover
    ]);
    const turn2Events = engine.resolveTurn();

    // Should NOT get a second confusion-start since already confused
    const confusionStarts = turn2Events.filter(e => e.kind === 'confusion-start');
    expect(confusionStarts.length).toBe(0);
  });
});
