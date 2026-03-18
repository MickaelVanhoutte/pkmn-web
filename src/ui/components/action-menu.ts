import { el } from '../util/dom';
import { audioManager } from '../util/audio';

export interface ActionMenuComponent {
  el: HTMLElement;
  show(canGoBack?: boolean): void;
  hide(): void;
  /** Switch between wild/trainer mode (shows Ball vs Bag) */
  setWildBattle(isWild: boolean): void;
  onFight: (() => void) | null;
  onPokemon: (() => void) | null;
  onBag: (() => void) | null;
  onCatch: (() => void) | null;
  onRun: (() => void) | null;
  onBack: (() => void) | null;
}

export function createActionMenu(): ActionMenuComponent {
  const fightBtn = el('button', { class: 'action-btn fight' }, ['FIGHT']);

  // PkMn with subscript k and n to match GBA style
  const pkmnP = el('span', { class: 'pkmn-big' }, ['P']);
  const pkmnK = el('span', { class: 'pkmn-sub' }, ['k']);
  const pkmnM = el('span', { class: 'pkmn-big' }, ['M']);
  const pkmnN = el('span', { class: 'pkmn-sub' }, ['n']);
  const pokemonBtn = el('button', { class: 'action-btn pokemon' }, [pkmnP, pkmnK, pkmnM, pkmnN]);

  const bagBtn = el('button', { class: 'action-btn bag' }, ['BAG']);
  const catchBtn = el('button', { class: 'action-btn catch' }, ['BALL']);
  catchBtn.style.display = 'none'; // Hidden by default (trainer battles)
  const runBtn = el('button', { class: 'action-btn run' }, ['RUN']);

  const backBtn = document.createElement('button');
  backBtn.className = 'back-arrow-btn';
  backBtn.style.display = 'none';
  backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  const grid = el('div', { class: 'action-grid' }, [fightBtn, pokemonBtn, bagBtn, catchBtn, runBtn]);
  const container = el('div', { class: 'action-panel' }, [grid, backBtn]);

  let isWild = false;

  const component: ActionMenuComponent = {
    el: container,
    onFight: null,
    onPokemon: null,
    onBag: null,
    onCatch: null,
    onRun: null,
    onBack: null,
    setWildBattle(wild: boolean) {
      isWild = wild;
      bagBtn.style.display = wild ? 'none' : '';
      catchBtn.style.display = wild ? '' : 'none';
    },
    show(canGoBack?: boolean) {
      container.style.display = '';
      backBtn.style.display = canGoBack ? '' : 'none';
    },
    hide() {
      container.style.display = 'none';
    },
  };

  fightBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onFight?.();
  });

  pokemonBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onPokemon?.();
  });

  bagBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onBag?.();
  });

  catchBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onCatch?.();
  });

  runBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onRun?.();
  });

  backBtn.addEventListener('click', () => {
    audioManager.playUiSfx('menu');
    component.onBack?.();
  });

  return component;
}
