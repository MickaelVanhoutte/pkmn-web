import { describe, it, expect, beforeEach } from 'vitest';
import { StatusProcessor } from '../../src/engine/status-processor';
import { EventBus } from '../../src/events/event-bus';
import { SeededRNG } from '../../src/engine/rng';
import type { PokemonBattleState, BattlePosition, BattleEvent } from '../../src/types';
import { defaultStatStages } from '../../src/types/common';

function createMockPokemon(overrides: Partial<PokemonBattleState> = {}): PokemonBattleState {
  return {
    config: { speciesId: 'test', level: 50, abilityId: 'none', moveIds: [] },
    species: { id: 'test', name: 'TestMon', types: ['normal'], baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, possibleAbilities: [], learnableMoves: [] },
    calculatedStats: { hp: 200, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    currentHp: 200,
    maxHp: 200,
    status: null,
    statusTurns: 0,
    volatileStatuses: [],
    statStages: defaultStatStages(),
    moves: [],
    isActive: true,
    isFainted: false,
    item: null,
    ability: 'none',
    lastMoveUsed: null,
    turnsSinceSwitch: 0,
    slotIndex: 0,
    teamIndex: 0,
    ...overrides,
  };
}

describe('StatusProcessor', () => {
  let eventBus: EventBus;
  let rng: SeededRNG;
  let processor: StatusProcessor;
  const pos: BattlePosition = { player: 0, slot: 0 };

  beforeEach(() => {
    eventBus = new EventBus();
    rng = new SeededRNG(42);
    processor = new StatusProcessor(eventBus, rng);
  });

  describe('burn', () => {
    it('should deal 1/16 HP fire-typed damage', () => {
      const pokemon = createMockPokemon({ status: 'burn' });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      const events = eventBus.getLog();
      const dmgEvent = events.find(e => e.kind === 'status-damage') as any;
      expect(dmgEvent).toBeDefined();
      expect(dmgEvent.amount).toBe(12); // floor(200/16) = 12
    });

    it('should deal double damage to ice-type pokemon', () => {
      const pokemon = createMockPokemon({
        status: 'burn',
        species: { id: 'test', name: 'IceMon', types: ['ice'], baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, possibleAbilities: [], learnableMoves: [] },
      });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      const events = eventBus.getLog();
      const dmgEvent = events.find(e => e.kind === 'status-damage') as any;
      // floor(200/16) = 12, then floor(12 * 2) = 24
      expect(dmgEvent.amount).toBe(24);
    });

    it('should deal half damage to water-type pokemon', () => {
      const pokemon = createMockPokemon({
        status: 'burn',
        species: { id: 'test', name: 'WaterMon', types: ['water'], baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, possibleAbilities: [], learnableMoves: [] },
      });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      const events = eventBus.getLog();
      const dmgEvent = events.find(e => e.kind === 'status-damage') as any;
      // fire vs water = 0.5x, so floor(200/16 * 0.5) = floor(6.25) = 6
      expect(dmgEvent.amount).toBe(6);
    });

    it('should be cured by rain', () => {
      const pokemon = createMockPokemon({ status: 'burn' });
      processor.processEndOfTurnStatus(pokemon, pos, 'rain', 1);

      expect(pokemon.status).toBeNull();
      const events = eventBus.getLog();
      expect(events.some(e => e.kind === 'status-cured')).toBe(true);
    });
  });

  describe('paralysis', () => {
    it('should deal electric-typed damage', () => {
      const pokemon = createMockPokemon({ status: 'paralysis' });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      const events = eventBus.getLog();
      const dmgEvent = events.find(e => e.kind === 'status-damage') as any;
      expect(dmgEvent).toBeDefined();
      expect(dmgEvent.status).toBe('paralysis');
    });

    it('should be cured by sandstorm', () => {
      const pokemon = createMockPokemon({ status: 'paralysis' });
      processor.processEndOfTurnStatus(pokemon, pos, 'sandstorm', 1);
      expect(pokemon.status).toBeNull();
    });

    it('should deal double damage to water-type (electric SE)', () => {
      const pokemon = createMockPokemon({
        status: 'paralysis',
        species: { id: 'test', name: 'WaterMon', types: ['water'], baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, possibleAbilities: [], learnableMoves: [] },
      });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      const events = eventBus.getLog();
      const dmgEvent = events.find(e => e.kind === 'status-damage') as any;
      expect(dmgEvent.amount).toBe(24); // floor(200/16)=12, floor(12*2)=24
    });
  });

  describe('freeze', () => {
    it('should deal ice-typed damage and be cured by sun', () => {
      const pokemon = createMockPokemon({ status: 'freeze' });
      processor.processEndOfTurnStatus(pokemon, pos, 'sun', 1);
      expect(pokemon.status).toBeNull();
    });
  });

  describe('poison', () => {
    it('should deal poison-typed damage and be cured by hail', () => {
      const pokemon = createMockPokemon({ status: 'poison' });
      processor.processEndOfTurnStatus(pokemon, pos, 'hail', 1);
      expect(pokemon.status).toBeNull();
    });
  });

  describe('sleep', () => {
    it('should heal 1/16 HP per turn', () => {
      const pokemon = createMockPokemon({ status: 'sleep', currentHp: 100, maxHp: 200 });
      processor.processEndOfTurnStatus(pokemon, pos, null, 1);

      expect(pokemon.currentHp).toBe(112); // 100 + floor(200/16) = 100 + 12 = 112
    });
  });

  describe('move-based curing', () => {
    it('should cure burn when hit by water move', () => {
      const pokemon = createMockPokemon({ status: 'burn' });
      processor.checkMoveCure(pokemon, 'water', pos, 1);
      expect(pokemon.status).toBeNull();
    });

    it('should cure paralysis when hit by ground move', () => {
      const pokemon = createMockPokemon({ status: 'paralysis' });
      processor.checkMoveCure(pokemon, 'ground', pos, 1);
      expect(pokemon.status).toBeNull();
    });

    it('should cure freeze when hit by fire move', () => {
      const pokemon = createMockPokemon({ status: 'freeze' });
      processor.checkMoveCure(pokemon, 'fire', pos, 1);
      expect(pokemon.status).toBeNull();
    });

    it('should cure poison when hit by ice move', () => {
      const pokemon = createMockPokemon({ status: 'poison' });
      processor.checkMoveCure(pokemon, 'ice', pos, 1);
      expect(pokemon.status).toBeNull();
    });

    it('should not cure status with wrong move type', () => {
      const pokemon = createMockPokemon({ status: 'burn' });
      processor.checkMoveCure(pokemon, 'fire', pos, 1);
      expect(pokemon.status).toBe('burn');
    });
  });
});
