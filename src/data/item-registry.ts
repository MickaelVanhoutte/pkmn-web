import type { ItemData } from '../types/item';
import itemsData from '../../data/items.json';

const items = new Map<string, ItemData>();

for (const item of itemsData as ItemData[]) {
  items.set(item.id, item);
}

export function getItem(id: string): ItemData {
  const item = items.get(id);
  if (!item) throw new Error(`Item not found: ${id}`);
  return item;
}

export function getAllItems(): ItemData[] {
  return [...items.values()];
}

export function hasItem(id: string): boolean {
  return items.has(id);
}
