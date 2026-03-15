import type { TypeName } from '@/types/common';
import { el } from '../util/dom';
import { getTypeColor, getTypeTextColor } from '../util/type-colors';

export function createTypeBadge(type: TypeName): HTMLElement {
  const badge = el('span', { class: 'type-badge', 'data-type': type }, [
    type.toUpperCase(),
  ]);

  badge.style.backgroundColor = getTypeColor(type);
  badge.style.color = getTypeTextColor(type);

  return badge;
}
