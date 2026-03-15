import { el } from '../util/dom';

export interface HpBarComponent {
  el: HTMLElement;
  update(currentHp: number, maxHp: number): void;
}

function getHpLevel(percentage: number): string {
  if (percentage > 50) return 'high';
  if (percentage >= 25) return 'medium';
  return 'low';
}

export function createHpBar(currentHp: number, maxHp: number): HpBarComponent {
  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

  const fill = el('div', { class: 'hp-bar-fill', 'data-level': getHpLevel(percentage) });
  fill.style.width = `${percentage}%`;

  const hpText = el('span', { class: 'hp-text' }, [`HP: ${currentHp}/${maxHp}`]);

  const container = el('div', { class: 'hp-bar-container' }, [fill, hpText]);

  function update(newCurrentHp: number, newMaxHp: number): void {
    const pct = newMaxHp > 0 ? Math.max(0, Math.min(100, (newCurrentHp / newMaxHp) * 100)) : 0;
    fill.style.width = `${pct}%`;
    fill.dataset.level = getHpLevel(pct);
    hpText.textContent = `HP: ${newCurrentHp}/${newMaxHp}`;
  }

  return { el: container, update };
}
