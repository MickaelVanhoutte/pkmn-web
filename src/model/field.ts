import type { Weather, Terrain, PlayerIndex } from '../types';
import type { FieldState, SideState } from '../types/battle';
import { defaultSideState } from '../types/battle';

export function createFieldState(): FieldState {
  return {
    weather: null,
    weatherTurnsRemaining: 0,
    terrain: null,
    terrainTurnsRemaining: 0,
    trickRoom: 0,
    sides: [defaultSideState(), defaultSideState()],
  };
}

export function setWeather(field: FieldState, weather: Weather, turns: number = 5): void {
  field.weather = weather;
  field.weatherTurnsRemaining = turns;
}

export function clearWeather(field: FieldState): Weather | null {
  const prev = field.weather;
  field.weather = null;
  field.weatherTurnsRemaining = 0;
  return prev;
}

export function tickWeather(field: FieldState): boolean {
  if (!field.weather) return false;
  field.weatherTurnsRemaining--;
  if (field.weatherTurnsRemaining <= 0) {
    field.weather = null;
    field.weatherTurnsRemaining = 0;
    return true; // weather ended
  }
  return false;
}

export function getSide(field: FieldState, player: PlayerIndex): SideState {
  return field.sides[player];
}

export function getOpposingSide(field: FieldState, player: PlayerIndex): SideState {
  return field.sides[player === 0 ? 1 : 0];
}
