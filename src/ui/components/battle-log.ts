import { el } from '../util/dom';

export interface BattleLogComponent {
  el: HTMLElement;
  addEntry(text: string): void;
  clear(): void;
}

export function createBattleLog(): BattleLogComponent {
  const container = el('div', { class: 'battle-log' });

  function addEntry(text: string): void {
    // Always log to browser console for full history
    console.log(`[Battle] ${text}`);

    // Show only the last message in the UI overlay
    container.textContent = text;
  }

  function clear(): void {
    container.textContent = '';
  }

  return { el: container, addEntry, clear };
}
