import { el } from '../util/dom';

export interface HpBarComponent {
  el: HTMLElement;
  update(currentHp: number, maxHp: number): void;
}

interface HpBarOptions {
  showText?: boolean;
}

function getHpLevel(percentage: number): string {
  if (percentage > 50) return 'high';
  if (percentage >= 20) return 'medium';
  return 'low';
}

export function createHpBar(currentHp: number, maxHp: number, options?: HpBarOptions): HpBarComponent {
  const showText = options?.showText ?? true;
  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

  const hpLabel = el('span', { class: 'hp-label' }, ['HP:']);

  const fill = el('div', { class: 'hp-bar-fill', 'data-level': getHpLevel(percentage) });
  fill.style.width = `${percentage}%`;

  const track = el('div', { class: 'hp-bar-track' }, [fill]);

  const children: HTMLElement[] = [hpLabel, track];

  let hpText: HTMLElement | null = null;
  if (showText) {
    hpText = el('span', { class: 'hp-text' }, [`${currentHp}/${maxHp}`]);
    children.push(hpText);
  }

  const container = el('div', { class: 'hp-bar-container' }, children);

  function update(newCurrentHp: number, newMaxHp: number): void {
    const pct = newMaxHp > 0 ? Math.max(0, Math.min(100, (newCurrentHp / newMaxHp) * 100)) : 0;
    fill.style.width = `${pct}%`;
    fill.dataset.level = getHpLevel(pct);
    if (hpText) {
      hpText.textContent = `${newCurrentHp}/${newMaxHp}`;
    }
  }

  return { el: container, update };
}
