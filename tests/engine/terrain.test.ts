import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/battle-engine';
import type { BattleConfig, PlayerIndex } from '../../src/types';

describe('Terrain System', () => {
  it('should set terrain when a terrain move is used', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Venusaur uses Grassy Terrain (moveIndex 6)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 },
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);

    const events = engine.resolveTurn();

    // Check for terrain-set event
    const terrainSetEvent = events.find(e => e.kind === 'terrain-set') as any;
    expect(terrainSetEvent).toBeDefined();
    expect(terrainSetEvent.terrain).toBe('grassy');
    expect(terrainSetEvent.turns).toBe(5);

    // Check field state
    expect(engine.getField().terrain).toBe('grassy');
    expect(engine.getField().terrainTurnsRemaining).toBeGreaterThan(0);
  });

  it('should boost grass damage with Grassy Terrain for grounded pokemon', () => {
    // Battle WITHOUT terrain
    const configNoTerrain: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engineNoTerrain = new BattleEngine(configNoTerrain);
    engineNoTerrain.startBattle();

    // Energy Ball without terrain
    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Energy Ball
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineNoTerrain.resolveTurn();

    // Turn 2: attack without terrain
    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Energy Ball
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsNoTerrain = engineNoTerrain.resolveTurn();
    const damageNoTerrain = eventsNoTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // Battle WITH terrain (same seed)
    const configWithTerrain: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engineWithTerrain = new BattleEngine(configWithTerrain);
    engineWithTerrain.startBattle();

    // Turn 1: Set Grassy Terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Grassy Terrain
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineWithTerrain.resolveTurn();

    expect(engineWithTerrain.getField().terrain).toBe('grassy');

    // Turn 2: Energy Ball with terrain active
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Energy Ball
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsWithTerrain = engineWithTerrain.resolveTurn();
    const damageWithTerrain = eventsWithTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // Grassy Terrain should boost grass damage (1.3x)
    expect(damageNoTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain[0].amount).toBeGreaterThan(damageNoTerrain[0].amount);
  });

  it('should heal grounded pokemon at end of turn with Grassy Terrain', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Set Grassy Terrain, Snorlax uses Tackle to damage Venusaur
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Grassy Terrain
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    engine.resolveTurn();

    expect(engine.getField().terrain).toBe('grassy');

    // Turn 2: Venusaur attacks Snorlax so it takes damage, terrain heals at end of turn
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Energy Ball
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);

    const events = engine.resolveTurn();

    // Snorlax should have taken damage from Energy Ball during the turn
    const snorlaxDamage = events.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    );
    expect(snorlaxDamage.length).toBeGreaterThan(0);

    // Both grounded pokemon should receive terrain healing at end of turn
    const healEvents = events.filter(
      e => e.kind === 'heal' && (e as any).source === 'terrain'
    ) as any[];
    expect(healEvents.length).toBeGreaterThan(0);

    // Snorlax is normal type (grounded) - should be healed by Grassy Terrain
    const snorlaxHeal = healEvents.find((e: any) => e.target.player === 1);
    expect(snorlaxHeal).toBeDefined();
  });

  it('should block priority moves against grounded targets with Psychic Terrain', () => {
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
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'jolteon',
            level: 100,
            abilityId: 'static',
            moveIds: ['thunderbolt', 'shadow-ball', 'thunder-wave', 'protect', 'quick-attack', 'substitute'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Alakazam sets Psychic Terrain
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 9 }, // Psychic Terrain
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Protect
    ]);
    engine.resolveTurn();

    expect(engine.getField().terrain).toBe('psychic');

    // Turn 2: Jolteon uses Quick Attack (priority +1) against grounded Alakazam
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 }, // Protect
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Quick Attack
    ]);

    const events = engine.resolveTurn();

    // Quick Attack should be blocked by Psychic Terrain (Alakazam is grounded)
    const failEvent = events.find(
      e => e.kind === 'fail' && (e as any).reason.includes('Psychic Terrain')
    ) as any;
    expect(failEvent).toBeDefined();
  });

  it('should block status conditions on grounded pokemon with Misty Terrain', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'togekiss',
            level: 100,
            abilityId: 'serene-grace',
            moveIds: ['moonblast', 'air-slash', 'thunder-wave', 'recover', 'protect', 'substitute', 'misty-terrain'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Togekiss sets Misty Terrain
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Misty Terrain
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engine.resolveTurn();

    expect(engine.getField().terrain).toBe('misty');

    // Turn 2: Togekiss uses Thunder Wave on Snorlax (grounded)
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 2 }, // Thunder Wave
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);

    const events = engine.resolveTurn();

    // Thunder Wave should fail due to Misty Terrain protecting grounded Snorlax
    const failEvent = events.find(
      e => e.kind === 'fail' && (e as any).reason.includes('Misty Terrain')
    ) as any;
    expect(failEvent).toBeDefined();

    // Snorlax should not have a status
    const snorlax = engine.getActivePokemon(1 as PlayerIndex, 0);
    expect(snorlax?.status).toBeNull();
  });

  it('should reduce dragon damage against grounded pokemon with Misty Terrain', () => {
    // Battle WITHOUT terrain
    const configNoTerrain: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'dragonite',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['dragon-pulse', 'air-slash', 'earthquake', 'ice-beam', 'protect', 'fly', 'roar', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engineNoTerrain = new BattleEngine(configNoTerrain);
    engineNoTerrain.startBattle();

    // Dragon Pulse without terrain
    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Dragon Pulse
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineNoTerrain.resolveTurn();

    // Turn 2: Dragon Pulse without terrain
    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Dragon Pulse
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsNoTerrain = engineNoTerrain.resolveTurn();
    const damageNoTerrain = eventsNoTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // Battle WITH Misty Terrain (need Togekiss to set it, then use Dragonite)
    // Use a config where player 1 has two pokemon: Togekiss first to set terrain, then switch to Dragonite
    const configWithTerrain: BattleConfig = {
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
              moveIds: ['moonblast', 'air-slash', 'thunder-wave', 'recover', 'protect', 'substitute', 'misty-terrain'],
            },
            {
              speciesId: 'dragonite',
              level: 100,
              abilityId: 'inner-focus',
              moveIds: ['dragon-pulse', 'air-slash', 'earthquake', 'ice-beam', 'protect', 'fly', 'roar', 'substitute'],
            },
          ],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engineWithTerrain = new BattleEngine(configWithTerrain);
    engineWithTerrain.startBattle();

    // Turn 1: Set Misty Terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Misty Terrain
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineWithTerrain.resolveTurn();

    expect(engineWithTerrain.getField().terrain).toBe('misty');

    // Turn 2: Switch to Dragonite
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'switch', player: 0 as PlayerIndex, slot: 0, switchToIndex: 1 },
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineWithTerrain.resolveTurn();

    // Turn 3: Dragon Pulse with Misty Terrain active
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Dragon Pulse
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsWithTerrain = engineWithTerrain.resolveTurn();
    const damageWithTerrain = eventsWithTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // Misty Terrain should halve dragon damage against grounded Snorlax
    expect(damageNoTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain[0].amount).toBeLessThan(damageNoTerrain[0].amount);
  });

  it('should not affect flying-type pokemon with terrain effects (Grassy Terrain healing)', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'charizard',
            level: 100,
            abilityId: 'blaze',
            moveIds: ['flamethrower', 'air-slash', 'dragon-pulse', 'sunny-day', 'will-o-wisp', 'protect', 'fly', 'solar-beam', 'substitute'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Set Grassy Terrain, Charizard attacks to take some damage later
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Grassy Terrain
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Flamethrower
    ]);

    const events = engine.resolveTurn();

    // Charizard is fire/flying - NOT grounded, should NOT receive terrain heal
    const terrainHeals = events.filter(
      e => e.kind === 'heal' && (e as any).source === 'terrain' && (e as any).target.player === 1
    );
    expect(terrainHeals.length).toBe(0);

    // Venusaur IS grounded (grass/poison), so it should get terrain heal if it took damage
    const venusaurHeals = events.filter(
      e => e.kind === 'heal' && (e as any).source === 'terrain' && (e as any).target.player === 0
    );
    // Venusaur may or may not get healed depending on whether it took damage
    // But Charizard's Flamethrower should have damaged it, so it should heal
    const venusaurDamage = events.filter(
      e => e.kind === 'damage' && (e as any).target.player === 0 && (e as any).source === 'move'
    );
    if (venusaurDamage.length > 0) {
      expect(venusaurHeals.length).toBe(1);
    }
  });

  it('should expire terrain after 5 turns', () => {
    const config: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'venusaur',
            level: 100,
            abilityId: 'overgrow',
            moveIds: ['energy-ball', 'sludge-bomb', 'giga-drain', 'sunny-day', 'protect', 'solar-beam', 'grassy-terrain', 'substitute'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    const engine = new BattleEngine(config);
    engine.startBattle();

    // Turn 1: Set Grassy Terrain
    engine.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 6 }, // Grassy Terrain
    ]);
    engine.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Recover
    ]);
    engine.resolveTurn();

    expect(engine.getField().terrain).toBe('grassy');

    // Turns 2-5: Both use non-damaging moves to pass turns
    let terrainEndEvent: any = null;
    for (let turn = 2; turn <= 5; turn++) {
      engine.submitAction(0 as PlayerIndex, [
        { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
      ]);
      engine.submitAction(1 as PlayerIndex, [
        { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Recover
      ]);
      const events = engine.resolveTurn();

      const endEvent = events.find(e => e.kind === 'terrain-end') as any;
      if (endEvent) {
        terrainEndEvent = endEvent;
      }
    }

    // Terrain should have ended after 5 turns
    expect(terrainEndEvent).toBeDefined();
    expect(terrainEndEvent.terrain).toBe('grassy');
    expect(engine.getField().terrain).toBeNull();
  });

  it('should boost electric damage with Electric Terrain for grounded pokemon', () => {
    // Battle WITHOUT terrain
    const configNoTerrain: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'metagross',
            level: 100,
            abilityId: 'clear-body',
            moveIds: ['iron-head', 'psychic', 'earthquake', 'rock-slide', 'protect', 'rock-blast', 'substitute', 'electric-terrain'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'jolteon',
            level: 100,
            abilityId: 'static',
            moveIds: ['thunderbolt', 'shadow-ball', 'thunder-wave', 'protect', 'quick-attack', 'substitute'],
          }],
        },
      ],
    };

    // Without terrain: Jolteon uses Thunderbolt on Metagross
    const engineNoTerrain = new BattleEngine(configNoTerrain);
    engineNoTerrain.startBattle();

    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Thunderbolt
    ]);
    engineNoTerrain.resolveTurn();

    // Turn 2: actual attack
    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Iron Head
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Thunderbolt
    ]);
    const eventsNoTerrain = engineNoTerrain.resolveTurn();
    const damageNoTerrain = eventsNoTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 0
    ) as any[];

    // With terrain: set Electric Terrain first, then Thunderbolt
    const engineWithTerrain = new BattleEngine({
      ...configNoTerrain,
      seed: 12345,
    });
    engineWithTerrain.startBattle();

    // Turn 1: Set Electric Terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 7 }, // Electric Terrain
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 3 }, // Protect
    ]);
    engineWithTerrain.resolveTurn();

    expect(engineWithTerrain.getField().terrain).toBe('electric');

    // Turn 2: Thunderbolt with Electric Terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Iron Head
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Thunderbolt
    ]);
    const eventsWithTerrain = engineWithTerrain.resolveTurn();
    const damageWithTerrain = eventsWithTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 0
    ) as any[];

    // Electric Terrain should boost electric damage (1.3x) since Jolteon is grounded
    expect(damageNoTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain[0].amount).toBeGreaterThan(damageNoTerrain[0].amount);
  });

  it('should boost psychic damage with Psychic Terrain for grounded pokemon', () => {
    // Battle WITHOUT terrain
    const configBase: BattleConfig = {
      format: 'singles',
      seed: 12345,
      players: [
        {
          name: 'Player 1',
          team: [{
            speciesId: 'alakazam',
            level: 100,
            abilityId: 'inner-focus',
            moveIds: ['psychic', 'shadow-ball', 'energy-ball', 'thunder-wave', 'recover', 'protect', 'light-screen', 'reflect', 'substitute', 'psychic-terrain', 'confuse-ray'],
          }],
        },
        {
          name: 'Player 2',
          team: [{
            speciesId: 'snorlax',
            level: 100,
            abilityId: 'sturdy',
            moveIds: ['tackle', 'double-edge', 'earthquake', 'recover', 'protect', 'substitute', 'whirlwind'],
          }],
        },
      ],
    };

    // Without terrain
    const engineNoTerrain = new BattleEngine(configBase);
    engineNoTerrain.startBattle();

    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 5 }, // Protect
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineNoTerrain.resolveTurn();

    engineNoTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Psychic
    ]);
    engineNoTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsNoTerrain = engineNoTerrain.resolveTurn();
    const damageNoTerrain = eventsNoTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // With terrain
    const engineWithTerrain = new BattleEngine({ ...configBase, seed: 12345 });
    engineWithTerrain.startBattle();

    // Turn 1: Set Psychic Terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 9 }, // Psychic Terrain
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 4 }, // Protect
    ]);
    engineWithTerrain.resolveTurn();

    expect(engineWithTerrain.getField().terrain).toBe('psychic');

    // Turn 2: Psychic with terrain
    engineWithTerrain.submitAction(0 as PlayerIndex, [
      { type: 'move', player: 0 as PlayerIndex, slot: 0, moveIndex: 0 }, // Psychic
    ]);
    engineWithTerrain.submitAction(1 as PlayerIndex, [
      { type: 'move', player: 1 as PlayerIndex, slot: 0, moveIndex: 0 }, // Tackle
    ]);
    const eventsWithTerrain = engineWithTerrain.resolveTurn();
    const damageWithTerrain = eventsWithTerrain.filter(
      e => e.kind === 'damage' && (e as any).source === 'move' && (e as any).target.player === 1
    ) as any[];

    // Psychic Terrain should boost psychic damage (1.3x) since Alakazam is grounded
    expect(damageNoTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain.length).toBeGreaterThan(0);
    expect(damageWithTerrain[0].amount).toBeGreaterThan(damageNoTerrain[0].amount);
  });
});
