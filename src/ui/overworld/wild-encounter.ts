import { getAllSpecies } from '@/data/pokemon-registry';
import type { PokemonConfig } from '@/types/pokemon';
import type { BattleConfig } from '@/types/battle';

/** Fixed player team: Gengar with competitive moveset */
export function getPlayerTeam(): PokemonConfig[] {
  return [
    {
      speciesId: 'gengar',
      level: 50,
      abilityId: 'levitate',
      moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'will-o-wisp'],
    },
  ];
}

/** Generate a random wild Pokemon (level 15-30, random species + moves) */
export function generateWildPokemon(): PokemonConfig {
  const allSpecies = getAllSpecies();
  const species = allSpecies[Math.floor(Math.random() * allSpecies.length)];
  const level = 15 + Math.floor(Math.random() * 16); // 15-30

  // Pick up to 4 random learnable moves
  const shuffled = [...species.learnableMoves].sort(() => Math.random() - 0.5);
  const moveIds = shuffled.slice(0, Math.min(4, shuffled.length));

  return {
    speciesId: species.id,
    level,
    abilityId: species.possibleAbilities[0],
    moveIds,
  };
}

/** Build a full BattleConfig for a wild encounter */
export function buildWildBattleConfig(wildPokemon: PokemonConfig): BattleConfig {
  return {
    format: 'singles',
    battleType: 'wild',
    seed: Math.floor(Math.random() * 100000),
    players: [
      { name: 'Player', team: getPlayerTeam() },
      { name: 'Wild', team: [wildPokemon] },
    ],
  };
}
