import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

describe('Status-Weather Interaction', () => {
  it('should cure burn when rain is active at end of turn', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 100,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'blastoise',
            level: 50,
            abilityId: 'torrent',
            moveIds: ['rain-dance', 'surf', 'ice-beam', 'protect'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'will-o-wisp', 'protect', 'air-slash'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Charizard uses Will-O-Wisp, Blastoise uses Rain Dance
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Rain Dance
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }, // Will-O-Wisp
    ]);

    const events = engine.resolveTurn();

    // Rain should be active
    expect(engine.getField().weather).toBe('rain');

    // If Blastoise got burned, rain should cure it at end of turn
    const blastoise = engine.getActivePokemon(0 as PlayerIndex, 0);
    // Burn should have been cured by rain
    expect(blastoise?.status).toBeNull();
  });

  it('should cure paralysis when sandstorm is active', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 200,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'tyranitar',
            level: 50,
            abilityId: 'sand-stream', // auto-sets sandstorm
            moveIds: ['rock-slide', 'earthquake', 'dark-pulse', 'protect'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'jolteon',
            level: 50,
            abilityId: 'static',
            moveIds: ['thunderbolt', 'thunder-wave', 'shadow-ball', 'protect'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    const startEvents = engine.startBattle();

    // Tyranitar's Sand Stream should set sandstorm on switch-in
    expect(engine.getField().weather).toBe('sandstorm');

    // Turn 1: Jolteon uses Thunder Wave on Tyranitar
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 3 }, // Protect
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }, // Thunder Wave
    ]);

    engine.resolveTurn();

    // Tyranitar used protect, so thunder wave failed
    // Let's do another turn without protect
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Rock Slide
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 1 }, // Thunder Wave
    ]);

    engine.resolveTurn();

    // If Tyranitar got paralyzed, sandstorm should cure it at end of turn
    const tyranitar = engine.getActivePokemon(0 as PlayerIndex, 0);
    // Due to sandstorm, paralysis should be cured
    expect(tyranitar?.status).toBeNull();
  });
});
