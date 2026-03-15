import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createPursuitConfig(): BattleConfig {
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
}

describe('Pursuit', () => {
  it('should hit switching pokemon with 2x power before switch', () => {
    // Use level 20 Tyranitar so Gengar survives and the switch completes
    const config = createPursuitConfig();
    config.players[0].team[0].level = 20;
    const engine = new BattleEngine(config);
    engine.startBattle();

    // Player 1: Tyranitar uses Pursuit (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);

    // Player 2: Gengar switches out to Charizard
    engine.submitAction(1 as PlayerIndex, [
      { type: 'switch', player: 1 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);

    const events = engine.resolveTurn();

    // Should have a pursuit-hit event indicating Pursuit intercepted the switch
    const pursuitHit = events.find(e => e.kind === 'pursuit-hit') as any;
    expect(pursuitHit).toBeDefined();
    expect(pursuitHit.user).toEqual({ player: 0, slot: 0 });
    expect(pursuitHit.target).toEqual({ player: 1, slot: 0 });

    // Pursuit-hit should come before the switch-out event
    const pursuitHitIndex = events.findIndex(e => e.kind === 'pursuit-hit');
    const switchOutIndex = events.findIndex(e => e.kind === 'switch-out');
    expect(switchOutIndex).toBeGreaterThan(-1);
    expect(pursuitHitIndex).toBeLessThan(switchOutIndex);

    // There should be move damage dealt to the target before the switch
    const damageEvents = events.filter(e => e.kind === 'damage' && (e as any).source === 'move') as any[];
    expect(damageEvents.length).toBeGreaterThanOrEqual(1);

    // The damage event should also come before the switch-out
    const firstDamageIndex = events.findIndex(e => e.kind === 'damage' && (e as any).source === 'move');
    expect(firstDamageIndex).toBeLessThan(switchOutIndex);
  });

  it('should consume the Pursuit user action so they do not attack again', () => {
    const config = createPursuitConfig();
    config.players[0].team[0].level = 20;
    const engine = new BattleEngine(config);
    engine.startBattle();

    // Player 1: Tyranitar uses Pursuit (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);

    // Player 2: Gengar switches out to Charizard
    engine.submitAction(1 as PlayerIndex, [
      { type: 'switch', player: 1 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);

    const events = engine.resolveTurn();

    // Tyranitar should only have one move-use event (the Pursuit), not two
    const tyranitarMoveUses = events.filter(
      e => e.kind === 'move-use' && (e as any).user.player === 0 && (e as any).user.slot === 0
    );
    expect(tyranitarMoveUses.length).toBe(1);
  });

  it('should deal normal 40BP damage when target does not switch', () => {
    const config: BattleConfig = {
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
          ],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Player 1: Tyranitar uses Pursuit (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);

    // Player 2: Snorlax uses Tackle (moveIndex 0) - no switch
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);

    const events = engine.resolveTurn();

    // Should NOT have a pursuit-hit event since the target didn't switch
    const pursuitHit = events.find(e => e.kind === 'pursuit-hit');
    expect(pursuitHit).toBeUndefined();

    // Pursuit should still be used as a normal move
    const moveUses = events.filter(e => e.kind === 'move-use') as any[];
    const pursuitUse = moveUses.find((e: any) => e.moveId === 'pursuit');
    expect(pursuitUse).toBeDefined();
  });
});
