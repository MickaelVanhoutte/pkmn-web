import type {
  PokemonBattleState, MajorStatus, Weather, TypeName, BattlePosition, BattleEvent,
} from '../types';
import { STATUS_TYPE_MAP, STATUS_WEATHER_CURE, STATUS_MOVE_CURE } from '../types/common';
import { getTypeEffectiveness } from '../data/type-chart';
import { applyDamage, applyHeal, cureStatus, getPokemonName } from '../model/pokemon';
import type { EventBus } from '../events/event-bus';
import type { SeededRNG } from './rng';

export class StatusProcessor {
  constructor(
    private eventBus: EventBus,
    private rng: SeededRNG,
  ) {}

  processEndOfTurnStatus(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    weather: Weather | null,
    turn: number,
  ): void {
    if (!pokemon.status || pokemon.isFainted) return;

    pokemon.statusTurns++;

    if (pokemon.status === 'sleep') {
      this.processSleep(pokemon, position, turn);
      return;
    }

    // Apply typed status damage
    const baseDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const damageType = STATUS_TYPE_MAP[pokemon.status];
    const effectiveness = getTypeEffectiveness(damageType, pokemon.species.types as TypeName[]);
    const damage = Math.max(1, Math.floor(baseDamage * effectiveness));

    const actual = applyDamage(pokemon, damage);
    this.eventBus.emit({
      kind: 'status-damage',
      turn,
      target: position,
      status: pokemon.status,
      amount: actual,
      currentHp: pokemon.currentHp,
      maxHp: pokemon.maxHp,
    });

    if (pokemon.isFainted) {
      this.eventBus.emit({
        kind: 'faint',
        turn,
        target: position,
        pokemonName: getPokemonName(pokemon),
      });
      return;
    }

    // Check weather-based curing
    if (weather && this.shouldWeatherCure(pokemon.status, weather)) {
      const cured = cureStatus(pokemon);
      if (cured) {
        this.eventBus.emit({
          kind: 'status-cured',
          turn,
          target: position,
          status: cured,
          pokemonName: getPokemonName(pokemon),
          source: 'weather',
        });
      }
    }
  }

  processSleep(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    turn: number,
  ): void {
    // Heal 1/16 HP
    const healAmount = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const healed = applyHeal(pokemon, healAmount);
    if (healed > 0) {
      this.eventBus.emit({
        kind: 'heal',
        turn,
        target: position,
        amount: healed,
        currentHp: pokemon.currentHp,
        maxHp: pokemon.maxHp,
        source: 'status',
      });
    }
  }

  canAct(pokemon: PokemonBattleState, turn: number): boolean {
    if (!pokemon.status) return true;

    if (pokemon.status === 'sleep') {
      // Sleep lasts 2-5 turns, initialized on first check
      if (pokemon.statusTurns === 0) {
        // Set sleep duration (stored as negative value to count down)
        const duration = this.rng.randomInt(2, 5);
        pokemon.statusTurns = -duration; // will count up toward 0
      }
      pokemon.statusTurns++;
      if (pokemon.statusTurns >= 0) {
        cureStatus(pokemon);
        this.eventBus.emit({
          kind: 'status-cured',
          turn,
          target: { player: 0, slot: 0 }, // caller should set correctly
          status: 'sleep',
          pokemonName: getPokemonName(pokemon),
          source: 'natural',
        });
        return true;
      }
      this.eventBus.emit({
        kind: 'message',
        turn,
        text: `${getPokemonName(pokemon)} is fast asleep!`,
      });
      return false;
    }

    // Paralysis: no longer prevents acting in our custom rules
    // (only reduces speed by 50% + deals electric damage)
    return true;
  }

  shouldWeatherCure(status: MajorStatus, weather: Weather): boolean {
    return STATUS_WEATHER_CURE[status as keyof typeof STATUS_WEATHER_CURE] === weather;
  }

  getMoveCureStatus(moveType: TypeName): MajorStatus | null {
    for (const [status, cureType] of Object.entries(STATUS_MOVE_CURE)) {
      if (cureType === moveType) return status as MajorStatus;
    }
    return null;
  }

  checkMoveCure(
    target: PokemonBattleState,
    moveType: TypeName,
    position: BattlePosition,
    turn: number,
  ): void {
    if (!target.status || target.isFainted) return;

    const curableStatus = this.getMoveCureStatus(moveType);
    if (curableStatus && target.status === curableStatus) {
      const cured = cureStatus(target);
      if (cured) {
        this.eventBus.emit({
          kind: 'status-cured',
          turn,
          target: position,
          status: cured,
          pokemonName: getPokemonName(target),
          source: 'move',
        });
      }
    }
  }
}
