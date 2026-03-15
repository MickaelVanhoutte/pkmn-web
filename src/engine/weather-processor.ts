import type {
  PokemonBattleState, Weather, BattlePosition, TypeName,
} from '../types';
import type { FieldState } from '../types/battle';
import { setWeather, clearWeather, tickWeather } from '../model/field';
import { applyDamage, getPokemonName } from '../model/pokemon';
import type { EventBus } from '../events/event-bus';

export class WeatherProcessor {
  constructor(private eventBus: EventBus) {}

  setWeather(field: FieldState, weather: Weather, turns: number, turn: number): void {
    setWeather(field, weather, turns);
    this.eventBus.emit({
      kind: 'weather-set',
      turn,
      weather,
      turns,
    });
  }

  processEndOfTurn(
    field: FieldState,
    activePokemon: { pokemon: PokemonBattleState; position: BattlePosition }[],
    turn: number,
  ): void {
    if (!field.weather) return;

    // Apply weather damage
    for (const { pokemon, position } of activePokemon) {
      if (pokemon.isFainted) continue;

      const damage = this.getWeatherDamage(field.weather, pokemon);
      if (damage > 0) {
        const actual = applyDamage(pokemon, damage);
        this.eventBus.emit({
          kind: 'weather-damage',
          turn,
          target: position,
          weather: field.weather,
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
        }
      }
    }

    // Tick weather countdown
    const ended = tickWeather(field);
    if (ended) {
      // The weather that just ended - we need to get it before it was cleared
      // tickWeather already cleared it, so emit with the last known weather
      // Actually tickWeather clears it, so let's adjust
    }
  }

  processWeatherTick(field: FieldState, turn: number): void {
    if (!field.weather) return;

    const currentWeather = field.weather;
    const ended = tickWeather(field);
    if (ended) {
      this.eventBus.emit({
        kind: 'weather-end',
        turn,
        weather: currentWeather,
      });
    }
  }

  getWeatherDamage(weather: Weather, pokemon: PokemonBattleState): number {
    const types = pokemon.species.types as TypeName[];

    if (weather === 'sandstorm') {
      // Rock, Ground, Steel immune
      if (types.some(t => t === 'rock' || t === 'ground' || t === 'steel')) return 0;
      return Math.max(1, Math.floor(pokemon.maxHp / 16));
    }

    if (weather === 'hail') {
      // Ice immune
      if (types.includes('ice')) return 0;
      return Math.max(1, Math.floor(pokemon.maxHp / 16));
    }

    return 0;
  }

  isImmuneToWeatherDamage(weather: Weather, types: TypeName[]): boolean {
    if (weather === 'sandstorm') {
      return types.some(t => t === 'rock' || t === 'ground' || t === 'steel');
    }
    if (weather === 'hail') {
      return types.includes('ice');
    }
    return true; // sun/rain don't deal damage
  }
}
