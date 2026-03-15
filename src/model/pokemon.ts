import type {
  PokemonConfig, PokemonBattleState, PokemonSpecies,
  MoveInstanceState, StatBlock, MajorStatus, VolatileStatus,
} from '../types';
import { defaultStatStages } from '../types/common';
import { getSpecies } from '../data/pokemon-registry';
import { getMove } from '../data/move-registry';
import { calculateAllStats } from '../utils/stat-calc';

export function createPokemonBattleState(
  config: PokemonConfig,
  teamIndex: number,
): PokemonBattleState {
  const species = getSpecies(config.speciesId);
  const calculatedStats = calculateAllStats(
    species.baseStats,
    config.ivs ?? {},
    config.evs ?? {},
    config.level,
    config.nature ?? 'hardy',
  );

  const moves: MoveInstanceState[] = config.moveIds.map((moveId) => {
    const moveData = getMove(moveId);
    return {
      moveId,
      currentPp: moveData.pp,
      maxPp: moveData.pp,
      disabled: false,
    };
  });

  return {
    config,
    species,
    calculatedStats,
    currentHp: calculatedStats.hp,
    maxHp: calculatedStats.hp,
    status: null,
    statusTurns: 0,
    volatileStatuses: [],
    statStages: defaultStatStages(),
    moves,
    isActive: false,
    isFainted: false,
    item: config.itemId ?? null,
    ability: config.abilityId,
    lastMoveUsed: null,
    turnsSinceSwitch: 0,
    slotIndex: -1,
    teamIndex,
    substituteHp: 0,
    confusionTurns: 0,
    chargeMoveId: null,
    chargeMoveTargetPos: null,
    choiceLocked: null,
    consecutiveProtectUse: 0,
  };
}

export function applyDamage(pokemon: PokemonBattleState, amount: number): number {
  if (amount <= 0) return 0;
  const actual = Math.min(amount, pokemon.currentHp);
  pokemon.currentHp -= actual;
  if (pokemon.currentHp <= 0) {
    pokemon.currentHp = 0;
    pokemon.isFainted = true;
  }
  return actual;
}

export function applyHeal(pokemon: PokemonBattleState, amount: number): number {
  if (amount <= 0) return 0;
  const actual = Math.min(amount, pokemon.maxHp - pokemon.currentHp);
  pokemon.currentHp += actual;
  return actual;
}

export function setStatus(pokemon: PokemonBattleState, status: MajorStatus): boolean {
  if (pokemon.status !== null) return false;
  if (pokemon.isFainted) return false;
  pokemon.status = status;
  pokemon.statusTurns = 0;
  return true;
}

export function cureStatus(pokemon: PokemonBattleState): MajorStatus | null {
  const prev = pokemon.status;
  pokemon.status = null;
  pokemon.statusTurns = 0;
  return prev;
}

export function addVolatileStatus(pokemon: PokemonBattleState, vs: VolatileStatus): boolean {
  if (pokemon.volatileStatuses.includes(vs)) return false;
  pokemon.volatileStatuses.push(vs);
  return true;
}

export function removeVolatileStatus(pokemon: PokemonBattleState, vs: VolatileStatus): boolean {
  const idx = pokemon.volatileStatuses.indexOf(vs);
  if (idx < 0) return false;
  pokemon.volatileStatuses.splice(idx, 1);
  return true;
}

export function hasVolatileStatus(pokemon: PokemonBattleState, vs: VolatileStatus): boolean {
  return pokemon.volatileStatuses.includes(vs);
}

export function clearVolatileStatuses(pokemon: PokemonBattleState): void {
  pokemon.volatileStatuses = [];
}

export function resetStatStages(pokemon: PokemonBattleState): void {
  pokemon.statStages = defaultStatStages();
}

export function getPokemonName(pokemon: PokemonBattleState): string {
  return pokemon.config.nickname ?? pokemon.species.name;
}
