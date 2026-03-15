import { el } from '../util/dom';

export interface BattleLogComponent {
  el: HTMLElement;
  addEntry(text: string): void;
  clear(): void;
}

export function createBattleLog(): BattleLogComponent {
  const container = el('div', { class: 'battle-log' });

  function addEntry(text: string): void {
    const entry = el('p', { class: 'log-entry' }, [text]);
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  function clear(): void {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  return { el: container, addEntry, clear };
}
