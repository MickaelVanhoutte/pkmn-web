import type { BattlePosition } from '@/types/common';
import { el, clearChildren } from '../util/dom';
import { getSpriteUrl } from '../util/sprite-url';
import { createHpBar } from './hp-bar';

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
  const header = el('div', { class: 'target-panel-header' }, ['Choose a target']);
  const list = el('div', { class: 'target-list' });
  const backBtn = el('button', { class: 'action-btn back' }, ['BACK']);

  const container = el('div', { class: 'target-panel' }, [header, list, backBtn]);
  container.style.display = 'none';

  const component: TargetPanelComponent = {
    el: container,
    onTargetSelect: null,
    onBack: null,

    show(targets) {
      clearChildren(list);

      // Separate foes and allies
      const foes = targets.filter(t => !t.isAlly);
      const allies = targets.filter(t => t.isAlly);

      if (foes.length > 0) {
        const foeLabel = el('div', { class: 'target-side-label' }, ['Opponent']);
        list.appendChild(foeLabel);
        for (const target of foes) {
          list.appendChild(createTargetEntry(target, component));
        }
      }

      if (allies.length > 0) {
        const allyLabel = el('div', { class: 'target-side-label' }, ['Ally']);
        list.appendChild(allyLabel);
        for (const target of allies) {
          list.appendChild(createTargetEntry(target, component));
        }
      }

      container.style.display = '';
    },

    hide() {
      container.style.display = 'none';
    },
  };

  backBtn.addEventListener('click', () => {
    component.onBack?.();
  });

  return component;
}

function createTargetEntry(target: TargetOption, component: TargetPanelComponent): HTMLElement {
  const spriteImg = document.createElement('img');
  spriteImg.className = 'switch-sprite';
  spriteImg.src = getSpriteUrl(target.speciesId, 'front');
  spriteImg.alt = target.pokemonName;

  const hpBar = createHpBar(target.currentHp, target.maxHp);
  const nameSpan = el('span', { class: 'switch-pokemon-name' }, [target.pokemonName]);

  const entry = el('div', { class: 'switch-entry' }, [spriteImg, nameSpan, hpBar.el]);

  entry.addEventListener('click', () => {
    component.onTargetSelect?.(target.position);
  });

  return entry;
}
