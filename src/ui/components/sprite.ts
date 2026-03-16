import { el } from '../util/dom';
import { getSpriteUrl } from '../util/sprite-url';

export interface SpriteComponent {
  el: HTMLElement;
  updateSprite(speciesId: string, variant: 'front' | 'back'): void;
  showSubstitute(): void;
  hideSubstitute(): void;
  setVisible(visible: boolean): void;
}

export function createSprite(
  slot: 'player-0' | 'player-1' | 'opponent-0' | 'opponent-1',
): SpriteComponent {
  const img = document.createElement('img');
  img.className = 'pokemon-sprite';
  img.alt = '';

  const container = el('div', { class: `sprite-slot ${slot}` }, [img]);
  container.style.visibility = 'hidden';

  let lastSpeciesId: string | null = null;
  let lastVariant: 'front' | 'back' = 'front';
  let isSubstitute = false;

  function updateSprite(speciesId: string, variant: 'front' | 'back'): void {
    lastSpeciesId = speciesId;
    lastVariant = variant;

    if (!isSubstitute) {
      img.src = getSpriteUrl(speciesId, variant);
      img.alt = speciesId;
    }
  }

  function showSubstitute(): void {
    isSubstitute = true;
    img.src = getSpriteUrl('substitute', lastVariant);
    img.alt = 'substitute';
  }

  function hideSubstitute(): void {
    isSubstitute = false;
    if (lastSpeciesId) {
      img.src = getSpriteUrl(lastSpeciesId, lastVariant);
      img.alt = lastSpeciesId;
    }
  }

  function setVisible(visible: boolean): void {
    container.style.visibility = visible ? 'visible' : 'hidden';
  }

  // Random eager shake at random intervals (10-25s)
  function scheduleEagerShake(): void {
    const delayMs = 10000 + Math.random() * 15000;
    setTimeout(() => {
      if (container.style.visibility !== 'hidden') {
        img.classList.add('eager');
        img.addEventListener('animationend', () => {
          img.classList.remove('eager');
        }, { once: true });
      }
      scheduleEagerShake();
    }, delayMs);
  }
  scheduleEagerShake();

  return { el: container, updateSprite, showSubstitute, hideSubstitute, setVisible };
}
