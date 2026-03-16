import type { TypeName } from '@/types/common';
import { el, clearChildren } from '../util/dom';
import { getTypeColor, getTypeTextColor } from '../util/type-colors';
import { audioManager } from '../util/audio';

export interface MovePanelComponent {
  el: HTMLElement;
  show(
    moves: {
      moveIndex: number;
      moveId: string;
      moveName: string;
      moveType: string;
      pp: number;
      maxPp: number;
    }[],
  ): void;
  hide(): void;
  onMoveSelect: ((moveIndex: number) => void) | null;
  onBack: (() => void) | null;
}

export function createMovePanel(): MovePanelComponent {
  const grid = el('div', { class: 'move-grid' });

  const backBtn = document.createElement('button');
  backBtn.className = 'back-arrow-btn';
  backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  const container = el('div', { class: 'move-panel' }, [grid, backBtn]);
  container.style.display = 'none';

  const component: MovePanelComponent = {
    el: container,
    onMoveSelect: null,
    onBack: null,

    show(moves) {
      clearChildren(grid);

      for (const move of moves) {
        const type = move.moveType as TypeName;
        const btn = el('button', { class: 'move-btn', 'data-type': move.moveType }, [
          el('span', { class: 'move-name' }, [move.moveName]),
          el('span', { class: 'move-pp' }, [`${move.pp}/${move.maxPp}`]),
        ]);

        btn.style.backgroundColor = getTypeColor(type);
        btn.style.color = getTypeTextColor(type);

        const moveIndex = move.moveIndex;
        btn.addEventListener('click', () => {
          audioManager.playUiSfx('menu');
          component.onMoveSelect?.(moveIndex);
        });

        if (move.pp <= 0) {
          btn.setAttribute('disabled', '');
        }

        grid.appendChild(btn);
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
