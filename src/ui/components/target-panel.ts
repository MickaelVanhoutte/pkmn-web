import type { BattlePosition } from '@/types/common';
import { el, clearChildren } from '../util/dom';
import { audioManager } from '../util/audio';

export interface TargetOption {
  position: BattlePosition;
  pokemonName: string;
  speciesId: string;
  currentHp: number;
  maxHp: number;
  isAlly: boolean;
}

export interface TargetPanelComponent {
  el: HTMLElement;
  show(targets: TargetOption[]): void;
  hide(): void;
  onTargetSelect: ((position: BattlePosition) => void) | null;
  onBack: (() => void) | null;
}

export function createTargetPanel(): TargetPanelComponent {
  const grid = el('div', { class: 'target-grid' });

  const backBtn = document.createElement('button');
  backBtn.className = 'back-arrow-btn';
  backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  const container = el('div', { class: 'target-panel' }, [grid, backBtn]);
  container.style.display = 'none';

  const component: TargetPanelComponent = {
    el: container,
    onTargetSelect: null,
    onBack: null,

    show(targets) {
      clearChildren(grid);

      // Foes first (sorted by descending slot so left-to-right matches battlefield),
      // then allies — fills 2x2 grid
      const foes = targets.filter(t => !t.isAlly).sort((a, b) => b.position.slot - a.position.slot);
      const allies = targets.filter(t => t.isAlly);
      const ordered = [...foes, ...allies];

      for (const target of ordered) {
        grid.appendChild(createTargetBtn(target, component));
      }

      container.style.display = '';
    },

    hide() {
      container.style.display = 'none';
    },
  };

  backBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onBack?.();
  });

  return component;
}

function createTargetBtn(target: TargetOption, component: TargetPanelComponent): HTMLElement {
  const label = target.isAlly ? 'ALLY' : 'FOE';
  const labelSpan = el('span', { class: 'target-label' }, [label]);
  const nameSpan = el('span', { class: 'target-name' }, [target.pokemonName]);

  const btn = document.createElement('button');
  btn.className = `action-btn ${target.isAlly ? 'bag' : 'fight'}`;
  btn.appendChild(nameSpan);
  btn.appendChild(labelSpan);

  btn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onTargetSelect?.(target.position);
  });

  return btn;
}
