import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

describe('Cross-feature interactions', () => {
  it('Screens + multi-hit: screen reduction applies to each hit', () => {
    // Alakazam sets Reflect, then opponent Tyranitar uses Rock Blast (physical multi-hit).
    // Each hit should be reduced by Reflect. Compare total damage with a non-Reflect run.

    const makeConfig = (): BattleConfig => ({
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'alakazam',
            level: 100,
            abilityId: 'inner-focus',
            // reflect=7
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'tyranitar',
            level: 100,
            abilityId: 'sand-stream',
            // rock-blast=7
            moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'stealth-rock', 'protect', 'pursuit', 'substitute', 'rock-blast'],
          }],
        },
      ],
    });

    // --- Run WITH Reflect ---
    const engineReflect = new BattleEngine(makeConfig());
    engineReflect.startBattle();

    // Turn 1: Alakazam uses Reflect (moveIndex 7), Tyranitar uses Protect (moveIndex 4)
    engineReflect.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    engineReflect.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engineReflect.resolveTurn();

    // Verify Reflect is up
    const reflectSide = engineReflect.getField().sides[0];
    expect(reflectSide.reflect).toBeGreaterThan(0);

    const alakazamBeforeReflect = engineReflect.getActivePokemon(0 as PlayerIndex, 0)!;
    const hpBeforeReflect = alakazamBeforeReflect.currentHp;

    // Turn 2: Alakazam uses Protect (moveIndex 5), Tyranitar uses Rock Blast (moveIndex 7)
    // Actually, we want Tyranitar to hit Alakazam, so Alakazam should NOT protect
    // Alakazam uses Recover (moveIndex 4) to stay alive, Tyranitar uses Rock Blast
    engineReflect.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engineReflect.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    const reflectEvents = engineReflect.resolveTurn();

    const reflectDamageEvents = reflectEvents.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 0,
    );
    const totalReflectDamage = reflectDamageEvents.reduce((sum, e) => sum + (e as any).amount, 0);

    // --- Run WITHOUT Reflect ---
    const engineNoReflect = new BattleEngine(makeConfig());
    engineNoReflect.startBattle();

    // Turn 1: Both protect (to burn the same RNG state as above for consistency)
    engineNoReflect.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engineNoReflect.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engineNoReflect.resolveTurn();

    // Confirm Reflect is NOT up
    const noReflectSide = engineNoReflect.getField().sides[0];
    expect(noReflectSide.reflect).toBe(0);

    // Turn 2: Alakazam uses Recover, Tyranitar uses Rock Blast
    engineNoReflect.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engineNoReflect.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    const noReflectEvents = engineNoReflect.resolveTurn();

    const noReflectDamageEvents = noReflectEvents.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 0,
    );
    const totalNoReflectDamage = noReflectDamageEvents.reduce((sum, e) => sum + (e as any).amount, 0);

    // Each hit should have been reduced by Reflect, so total damage with Reflect < without
    expect(reflectDamageEvents.length).toBeGreaterThanOrEqual(2); // multi-hit landed at least 2 times
    expect(totalReflectDamage).toBeLessThan(totalNoReflectDamage);
  });

  it('Substitute + multi-hit: sub breaks mid-sequence, remaining hits go through', () => {
    // Alakazam (55 base HP, fragile sub) creates Substitute,
    // Tyranitar (134 base atk) uses Rock Blast (physical multi-hit, 25 power).
    // The sub is small (~53 HP) and each hit deals enough to break it quickly,
    // so remaining hits should deal direct HP damage after the sub breaks.

    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'alakazam',
            level: 100,
            abilityId: 'inner-focus',
            // substitute=8
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'tyranitar',
            level: 100,
            abilityId: 'sand-stream',
            // rock-blast=7
            moveIds: ['rock-slide', 'dark-pulse', 'earthquake', 'stealth-rock', 'protect', 'pursuit', 'substitute', 'rock-blast'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    const alakazam = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    const maxHp = alakazam.maxHp;
    const subCost = Math.floor(maxHp / 4);

    // Turn 1: Alakazam uses Substitute (moveIndex 8), Tyranitar uses Protect (moveIndex 4)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 8 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    const turn1Events = engine.resolveTurn();

    // Verify substitute was created
    const subCreated = turn1Events.find(e => e.kind === 'substitute-created');
    expect(subCreated).toBeDefined();

    const alakazamAfterSub = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(alakazamAfterSub.substituteHp).toBe(subCost);
    const hpAfterSub = alakazamAfterSub.currentHp; // maxHp - subCost

    // Turn 2: Alakazam uses Recover (moveIndex 4), Tyranitar uses Rock Blast (moveIndex 7)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 7 },
    ]);
    const turn2Events = engine.resolveTurn();

    // We should see a substitute-broken event
    const subBroken = turn2Events.find(e => e.kind === 'substitute-broken');
    expect(subBroken).toBeDefined();

    // After sub breaks, remaining hits should deal direct HP damage
    const alakazamAfter = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(alakazamAfter.substituteHp).toBe(0);

    // The multi-hit should have completed
    const multiHitComplete = turn2Events.find(e => e.kind === 'multi-hit-complete');
    expect(multiHitComplete).toBeDefined();

    // There should be damage events: some to substitute, then some directly to Alakazam
    const damageEvents = turn2Events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 0,
    );
    expect(damageEvents.length).toBeGreaterThanOrEqual(2); // at least 2 hits from multi-hit

    // Alakazam's HP should be less than maxHp (sub cost + direct hits after sub broke).
    // Even accounting for Recover, the direct hits after sub breaks should deal real damage.
    // Verify the sub is gone AND direct damage was taken by checking Alakazam lost HP
    // beyond just the sub cost. Since Recover heals 50%, we check if final HP < maxHp.
    // The key assertion: sub broke AND Alakazam took direct HP damage from remaining hits.
    expect(alakazamAfter.currentHp).toBeLessThan(maxHp);
  });

  it('Substitute + status moves: blocked', () => {
    // Snorlax has Substitute up, Gengar tries Will-O-Wisp.
    // Should see substitute-blocked and no status applied.

    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            // substitute=5
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'gengar',
            level: 100,
            abilityId: 'levitate',
            // will-o-wisp=3
            moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Snorlax uses Substitute (moveIndex 5), Gengar uses Protect (moveIndex 4)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engine.resolveTurn();

    // Verify substitute is up
    const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(snorlax.substituteHp).toBeGreaterThan(0);

    // Turn 2: Snorlax uses Tackle (moveIndex 0), Gengar uses Will-O-Wisp (moveIndex 3)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    const turn2Events = engine.resolveTurn();

    // Should see substitute-blocked event
    const subBlocked = turn2Events.find(e => e.kind === 'substitute-blocked');
    expect(subBlocked).toBeDefined();

    // No status should be applied to Snorlax
    const statusApplied = turn2Events.find(
      e => e.kind === 'status-applied' && (e as any).target.player === 0,
    );
    expect(statusApplied).toBeUndefined();

    // Snorlax should have no status
    const snorlaxAfter = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(snorlaxAfter.status).toBeNull();
  });

  it('Substitute + confusion: confusion infliction blocked', () => {
    // Snorlax has Substitute, Gengar uses Confuse Ray.
    // Should be blocked by sub - no confusion applied.

    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            // substitute=5
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'gengar',
            level: 100,
            abilityId: 'levitate',
            // confuse-ray=5
            moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp', 'protect', 'confuse-ray', 'substitute'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Snorlax uses Substitute (moveIndex 5), Gengar uses Protect (moveIndex 4)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 },
    ]);
    engine.resolveTurn();

    // Verify substitute is up
    const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(snorlax.substituteHp).toBeGreaterThan(0);

    // Turn 2: Snorlax uses Tackle (moveIndex 0), Gengar uses Confuse Ray (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    const turn2Events = engine.resolveTurn();

    // Confuse Ray is a status move, so substitute blocks it at the status move check
    const subBlocked = turn2Events.find(e => e.kind === 'substitute-blocked');
    expect(subBlocked).toBeDefined();

    // No confusion should be applied
    const confusionStart = turn2Events.find(
      e => e.kind === 'confusion-start' && (e as any).target.player === 0,
    );
    expect(confusionStart).toBeUndefined();

    // Snorlax should not be confused
    const snorlaxAfter = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(snorlaxAfter.confusionTurns).toBe(0);
  });

  it('Misty Terrain + status: blocks status on grounded pokemon', () => {
    // Togekiss sets Misty Terrain, then opponent tries Thunder Wave on a grounded pokemon.
    // Togekiss is flying so it's not grounded - we need a grounded target.
    // Use Snorlax (normal, no levitate) as the grounded pokemon being targeted.

    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [
            {
              speciesId: 'togekiss',
              level: 100,
              abilityId: 'serene-grace',
              // misty-terrain=6
              moveIds: ['moonblast', 'air-slash', 'thunder-wave', 'recover', 'protect', 'substitute', 'misty-terrain'],
            },
            {
              speciesId: 'snorlax',
              level: 100,
              abilityId: 'inner-focus',
              moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'alakazam',
            level: 100,
            abilityId: 'inner-focus',
            // thunder-wave=3
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Togekiss uses Misty Terrain (moveIndex 6), Alakazam uses Protect (moveIndex 5)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    const turn1Events = engine.resolveTurn();

    // Verify Misty Terrain is active
    const terrainSet = turn1Events.find(e => e.kind === 'terrain-set');
    expect(terrainSet).toBeDefined();
    expect(engine.getField().terrain).toBe('misty');

    // Turn 2: Switch Togekiss to Snorlax, Alakazam uses Protect
    engine.submitAction(0 as PlayerIndex, [
      { type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engine.resolveTurn();

    // Verify Snorlax is now active
    const active = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(active.species.id).toBe('snorlax');

    // Turn 3: Snorlax uses Tackle (moveIndex 0), Alakazam uses Thunder Wave (moveIndex 3) on Snorlax
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 },
    ]);
    const turn3Events = engine.resolveTurn();

    // Misty Terrain should block the status on grounded Snorlax
    const failEvent = turn3Events.find(
      e => e.kind === 'fail' && (e as any).reason.includes('Misty Terrain'),
    );
    expect(failEvent).toBeDefined();

    // No status should be applied to Snorlax
    const statusApplied = turn3Events.find(
      e => e.kind === 'status-applied' && (e as any).target.player === 0,
    );
    expect(statusApplied).toBeUndefined();

    const snorlax = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    expect(snorlax.status).toBeNull();
  });

  it('Life Orb + multi-hit: recoil once per move use', () => {
    // Scizor with Life Orb uses Bullet Seed (multi-hit).
    // Life Orb recoil applies once per move use, not per hit (matching Showdown behavior).

    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'scizor',
            level: 100,
            abilityId: 'technician',
            itemId: 'life-orb',
            // bullet-seed=5
            moveIds: ['x-scissor', 'iron-head', 'quick-attack', 'swords-dance', 'protect', 'bullet-seed', 'dual-wingbeat', 'pursuit', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    const scizorBefore = engine.getActivePokemon(0 as PlayerIndex, 0)!;
    const scizorMaxHp = scizorBefore.maxHp;
    const scizorHpBefore = scizorBefore.currentHp;

    // Turn 1: Scizor uses Bullet Seed (moveIndex 5), Snorlax uses Protect (moveIndex 4)
    // Protect would block all hits so let's have Snorlax use Tackle instead
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 },
    ]);
    const events = engine.resolveTurn();

    // Count recoil damage events on Scizor (player 0)
    const recoilEvents = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'recoil' && (e as any).target.player === 0,
    );

    // Count move damage events on Snorlax (player 1) from Bullet Seed
    const hitDamageEvents = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1,
    );

    // Multi-hit should have landed at least 2 hits
    expect(hitDamageEvents.length).toBeGreaterThanOrEqual(2);

    // Life Orb recoil applies once per move use, not per hit (Showdown behavior)
    expect(recoilEvents.length).toBe(1);

    // Scizor should have lost HP from life orb recoil (10% of max HP, once)
    const expectedRecoil = Math.max(1, Math.floor(scizorMaxHp / 10));
    expect((recoilEvents[0] as any).amount).toBe(expectedRecoil);
  });
});
