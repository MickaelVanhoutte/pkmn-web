import { el, clearChildren } from '../util/dom';
import { getSpriteUrl } from '../util/sprite-url';
import { createHpBar } from './hp-bar';

export interface SwitchPanelComponent {
  el: HTMLElement;
  show(
    pokemon: {
      teamIndex: number;
      pokemonName: string;
      speciesId: string;
      currentHp: number;
      maxHp: number;
      isActive?: boolean;
      isFainted?: boolean;
    }[],
  ): void;
  hide(): void;
  onSwitch: ((teamIndex: number) => void) | null;
  onBack: (() => void) | null;
}

export function createSwitchPanel(): SwitchPanelComponent {
  const list = el('div', { class: 'switch-list' });
  const backBtn = el('button', { class: 'action-btn back' }, ['BACK']);

  const container = el('div', { class: 'switch-panel' }, [list, backBtn]);
  container.style.display = 'none';

  const component: SwitchPanelComponent = {
    el: container,
    onSwitch: null,
    onBack: null,

    show(pokemon) {
      clearChildren(list);

      let isForcedSwitch = true;
      for (const mon of pokemon) {
        if (!mon.isActive && !mon.isFainted) {
          isForcedSwitch = false;
          break;
        }
      }
      // If every non-active pokemon is fainted, it's not forced either
      // Forced switch is detected by whether any valid switch target exists
      // and whether we should hide the back button
      const hasValidTarget = pokemon.some((p) => !p.isActive && !p.isFainted);
      const allActiveOrFainted = pokemon.every((p) => p.isActive || p.isFainted);

      // During a forced switch, hide the back button
      if (allActiveOrFainted || !hasValidTarget) {
        backBtn.style.display = 'none';
      } else {
        backBtn.style.display = '';
      }

      for (const mon of pokemon) {
        const isDisabled = mon.isActive || mon.isFainted;

        const spriteImg = document.createElement('img');
        spriteImg.className = 'switch-sprite';
        spriteImg.src = getSpriteUrl(mon.speciesId, 'front');
        spriteImg.alt = mon.pokemonName;

        const hpBar = createHpBar(mon.currentHp, mon.maxHp);

        const nameSpan = el('span', { class: 'switch-pokemon-name' }, [mon.pokemonName]);

        const entry = el('div', { class: 'switch-entry' }, [spriteImg, nameSpan, hpBar.el]);

        if (isDisabled) {
          entry.classList.add('disabled');
          if (mon.isFainted) {
            entry.classList.add('fainted');
          }
          if (mon.isActive) {
            entry.classList.add('active');
          }
        } else {
          const teamIndex = mon.teamIndex;
          entry.addEventListener('click', () => {
            component.onSwitch?.(teamIndex);
          });
        }

        list.appendChild(entry);
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
