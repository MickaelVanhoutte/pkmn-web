import { el } from '../util/dom';
import type { BattleFormat } from '@/types/common';
import type { NavigateFn } from '../main';

export function showTitleScreen(
  container: HTMLElement,
  navigate: NavigateFn,
): () => void {
  let selectedFormat: BattleFormat = 'singles';

  // Title
  const titleText = el('div', { class: 'title-logo' }, ['POKEMON']);
  const subtitleText = el('div', { class: 'title-subtitle' }, ['BATTLE ENGINE']);

  const titleBlock = el('div', { class: 'title-block' }, [titleText, subtitleText]);

  // Format selector
  const singlesBtn = el('button', { class: 'format-btn active', 'data-format': 'singles' }, [
    'SINGLES',
  ]);
  const doublesBtn = el('button', { class: 'format-btn', 'data-format': 'doubles' }, ['DOUBLES']);

  const formatRow = el('div', { class: 'title-format-row' }, [
    el('span', { class: 'title-format-label' }, ['FORMAT']),
    singlesBtn,
    doublesBtn,
  ]);

  function selectFormat(format: BattleFormat): void {
    selectedFormat = format;
    if (format === 'singles') {
      singlesBtn.classList.add('active');
      doublesBtn.classList.remove('active');
    } else {
      doublesBtn.classList.add('active');
      singlesBtn.classList.remove('active');
    }
  }

  singlesBtn.addEventListener('click', () => selectFormat('singles'));
  doublesBtn.addEventListener('click', () => selectFormat('doubles'));

  // Start button
  const startBtn = el('button', { class: 'title-start-btn' }, ['START BATTLE']);
  startBtn.addEventListener('click', () => {
    navigate('team-select', { format: selectedFormat });
  });

  // Credits
  const credits = el('div', { class: 'title-credits' }, ['Built with TypeScript']);

  // Assemble
  const wrapper = el('div', { class: 'title-screen' }, [
    titleBlock,
    formatRow,
    startBtn,
    credits,
  ]);

  container.appendChild(wrapper);

  return () => {
    // No timers or listeners to clean up beyond DOM removal
  };
}
