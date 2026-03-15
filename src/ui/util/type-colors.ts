import type { TypeName } from '@/types/common';

export const TYPE_COLORS: Record<TypeName, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

const DARK_TYPES: Set<TypeName> = new Set([
  'fighting',
  'poison',
  'ghost',
  'dragon',
  'dark',
]);

export function getTypeColor(type: TypeName): string {
  return TYPE_COLORS[type];
}

export function getTypeTextColor(type: TypeName): string {
  return DARK_TYPES.has(type) ? '#FFFFFF' : '#222222';
}
