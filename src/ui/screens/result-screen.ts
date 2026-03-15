import { el } from '../util/dom';
import type { BattleConfig } from '@/types/battle';
import type { NavigateFn } from '../main';

export function showResultScreen(
  container: HTMLElement,
  navigate: NavigateFn,
  params: { winner: 0 | 1 | null; config: BattleConfig },
): () => void {
  let resultText: string;
  let resultClass: string;

  if (params.winner === 0) {
    resultText = 'YOU WIN!';
    resultClass = 'result-win';
  } else if (params.winner === 1) {
    resultText = 'YOU LOSE...';
    resultClass = 'result-lose';
  } else {
    resultText = 'DRAW';
    resultClass = 'result-draw';
  }

  const heading = el('div', { class: `result-heading ${resultClass}` }, [resultText]);

  const playAgainBtn = el('button', { class: 'result-btn' }, ['PLAY AGAIN']);
  playAgainBtn.addEventListener('click', () => {
    navigate('team-select', { format: params.config.format });
  });

  const titleBtn = el('button', { class: 'result-btn result-btn-secondary' }, ['BACK TO TITLE']);
  titleBtn.addEventListener('click', () => {
    navigate('title');
  });

  const buttons = el('div', { class: 'result-buttons' }, [playAgainBtn, titleBtn]);

  const wrapper = el('div', { class: 'result-screen' }, [heading, buttons]);

  container.appendChild(wrapper);

  return () => {
    // No timers or listeners to clean up
  };
}
