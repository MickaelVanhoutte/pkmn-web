import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

function createChargeTestConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    format: 'singles',
    seed: 12345,
    players: [
      {
        name: 'Player 1',
        team: [
          {
            speciesId: 'charizard',
            level: 50,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day', 'will-o-wisp', 'protect', 'fly', 'solar-beam', 'substitute'],
          },
          {
            speciesId: 'blastoise',
            level: 50,
            abilityId: 'torrent',
            moveIds: ['surf', 'ice-beam', 'rapid-spin', 'rain-dance'],
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
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Charge Moves', () => {
  it('should take two turns to execute (charge then attack)', () => {
    const engine = new BattleEngine(createChargeTestConfig());
    engine.startBattle();

    const charizard = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0)!;
    const snorlaxHpBefore = snorlax.currentHp;

    // Turn 1: Charizard uses Solar Beam (charge turn), Snorlax uses Tackle
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);

    const turn1Events = engine.resolveTurn();

    // Turn 1 should emit a 'charging' event for Solar Beam
    const chargingEvent = turn1Events.find(e => e.kind === 'charging') as any;
    expect(chargingEvent).toBeDefined();
    expect(chargingEvent.moveId).toBe('solar-beam');

    // Turn 1 should NOT deal Solar Beam damage to Snorlax
    const snorlaxHpAfterTurn1 = snorlax.currentHp;
    const turn1DamageToSnorlax = turn1Events.filter(
      e => e.kind === 'damage' && (e as any).target.player === 1 && (e as any).source === 'move',
    );
    expect(turn1DamageToSnorlax.length).toBe(0);

    // Charizard should have the chargeMove volatile status after turn 1
    expect(charizard.volatileStatuses).toContain('chargeMove');
    expect(charizard.chargeMoveId).toBe('solar-beam');

    // Turn 2: Charizard executes Solar Beam (must submit the charged move), Snorlax uses Tackle
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);

    const turn2Events = engine.resolveTurn();

    // Turn 2 should NOT emit a 'charging' event
    const chargingTurn2 = turn2Events.find(e => e.kind === 'charging');
    expect(chargingTurn2).toBeUndefined();

    // Turn 2 should deal damage to Snorlax from Solar Beam
    const turn2MoveUse = turn2Events.find(
      e => e.kind === 'move-use' && (e as any).moveId === 'solar-beam',
    );
    expect(turn2MoveUse).toBeDefined();

    const turn2DamageToSnorlax = turn2Events.filter(
      e => e.kind === 'damage' && (e as any).target.player === 1 && (e as any).source === 'move',
    );
    expect(turn2DamageToSnorlax.length).toBeGreaterThanOrEqual(1);

    // Snorlax HP should have decreased from Solar Beam damage
    expect(snorlax.currentHp).toBeLessThan(snorlaxHpAfterTurn1);

    // Charge state should be cleared after execution
    expect(charizard.volatileStatuses).not.toContain('chargeMove');
    expect(charizard.chargeMoveId).toBeNull();
  });

  it('should only deduct PP once (on the charge turn)', () => {
    const engine = new BattleEngine(createChargeTestConfig());
    engine.startBattle();

    const charizard = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    const solarBeamMove = charizard.moves[7]; // solar-beam is moveIndex 7
    const ppBefore = solarBeamMove.currentPp;

    // Turn 1: Charge turn - PP should be deducted
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    const ppAfterCharge = solarBeamMove.currentPp;
    expect(ppAfterCharge).toBe(ppBefore - 1);

    // Turn 2: Execution turn - PP should NOT be deducted again
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    const ppAfterExecution = solarBeamMove.currentPp;
    expect(ppAfterExecution).toBe(ppBefore - 1);
  });

  it('should clear charge state when the pokemon switches out', () => {
    const engine = new BattleEngine(createChargeTestConfig());
    engine.startBattle();

    const charizard = engine.getActivePokemon(0 as PlayerIndex, 0)!;

    // Turn 1: Charizard charges Solar Beam
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    // Verify charge state is set
    expect(charizard.volatileStatuses).toContain('chargeMove');
    expect(charizard.chargeMoveId).toBe('solar-beam');

    // Turn 2: Switch Charizard out to Blastoise instead of executing the charged move
    engine.submitAction(0 as PlayerIndex, [
      { type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    // Blastoise should now be active
    const active = engine.getActivePokemon(0 as PlayerIndex, 0);
    expect(active?.species.id).toBe('blastoise');

    // Charizard's charge state should be cleared by the switch
    expect(charizard.volatileStatuses).not.toContain('chargeMove');
    expect(charizard.chargeMoveId).toBeNull();
  });

  it('should be blocked by Protect on the attack turn', () => {
    const engine = new BattleEngine(createChargeTestConfig());
    engine.startBattle();

    const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0)!;
    const snorlaxHpBefore = snorlax.currentHp;

    // Turn 1: Charizard charges Solar Beam, Snorlax uses Tackle
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.resolveTurn();

    const snorlaxHpAfterTurn1 = snorlax.currentHp;

    // Turn 2: Charizard fires Solar Beam, Snorlax uses Protect (moveIndex 4)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);

    const turn2Events = engine.resolveTurn();

    // Solar Beam should be used but blocked by Protect
    const moveUse = turn2Events.find(
      e => e.kind === 'move-use' && (e as any).moveId === 'solar-beam',
    );
    expect(moveUse).toBeDefined();

    const protectBlock = turn2Events.find(
      e => e.kind === 'fail' && (e as any).reason.includes('protected'),
    );
    expect(protectBlock).toBeDefined();

    // Snorlax should not take Solar Beam damage on turn 2
    expect(snorlax.currentHp).toBe(snorlaxHpAfterTurn1);
  });
});
