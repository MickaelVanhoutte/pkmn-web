import { el } from '../util/dom';

export interface ActionMenuComponent {
  el: HTMLElement;
  show(): void;
  hide(): void;
  onFight: (() => void) | null;
  onPokemon: (() => void) | null;
  onBag: (() => void) | null;
  onRun: (() => void) | null;
}

export function createActionMenu(): ActionMenuComponent {
  const fightBtn = el('button', { class: 'action-btn fight' }, ['FIGHT']);
  const pokemonBtn = el('button', { class: 'action-btn pokemon' }, ['PKMn']);
  const bagBtn = el('button', { class: 'action-btn bag' }, ['BAG']);
  const runBtn = el('button', { class: 'action-btn run' }, ['RUN']);

  const grid = el('div', { class: 'action-grid' }, [fightBtn, pokemonBtn, bagBtn, runBtn]);
  const container = el('div', { class: 'action-panel' }, [grid]);

  const component: ActionMenuComponent = {
    el: container,
    onFight: null,
    onPokemon: null,
    onBag: null,
    onRun: null,
    show() {
      container.style.display = '';
    },
    hide() {
      container.style.display = 'none';
    },
  };

  fightBtn.addEventListener('click', () => {
    component.onFight?.();
  });

  pokemonBtn.addEventListener('click', () => {
    component.onPokemon?.();
  });

  bagBtn.addEventListener('click', () => {
    component.onBag?.();
  });

  runBtn.addEventListener('click', () => {
    component.onRun?.();
  });

  return component;
}
