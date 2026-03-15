import type { AbilityData, AbilityHandlerMap } from '../types';
import abilitiesData from '../../data/abilities.json';

const abilities = new Map<string, AbilityData>();
const handlers = new Map<string, AbilityHandlerMap>();

for (const ability of abilitiesData as AbilityData[]) {
  abilities.set(ability.id, ability);
}

export function getAbility(id: string): AbilityData {
  const ability = abilities.get(id);
  if (!ability) throw new Error(`Ability not found: ${id}`);
  return ability;
}

export function getAllAbilities(): AbilityData[] {
  return [...abilities.values()];
}

export function hasAbility(id: string): boolean {
  return abilities.has(id);
}

export function registerAbilityHandler(id: string, handler: AbilityHandlerMap): void {
  handlers.set(id, handler);
}

export function getAbilityHandler(id: string): AbilityHandlerMap | undefined {
  return handlers.get(id);
}
