import type { PokemonSpecies } from '../types';
import pokemonData from '../../data/pokemon.json';

const species = new Map<string, PokemonSpecies>();

for (const poke of pokemonData as PokemonSpecies[]) {
  species.set(poke.id, poke);
}

export function getSpecies(id: string): PokemonSpecies {
  const s = species.get(id);
  if (!s) throw new Error(`Pokemon species not found: ${id}`);
  return s;
}

export function getAllSpecies(): PokemonSpecies[] {
  return [...species.values()];
}

export function hasSpecies(id: string): boolean {
  return species.has(id);
}
