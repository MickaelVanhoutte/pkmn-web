import { getAllMoves } from '@/data/move-registry';
import { getMoveAnimation, getAllMoveAnimationIds } from '../animation/defs';
import type { MoveAnimationPlayer } from '../animation/move-animation-player';
import type { SpriteAnimator } from '../animation/sprite-animator';
import type { BattlePosition } from '../animation/types';

export interface DebugMoveSelectorComponent {
  el: HTMLElement;
}

export function createDebugMoveSelector(
  animPlayer: MoveAnimationPlayer,
  spriteAnimator: SpriteAnimator,
  arena: HTMLElement,
): DebugMoveSelectorComponent {
  const allMoves = getAllMoves();
  const animIds = new Set(getAllMoveAnimationIds());

  // Sort: moves with animations first, then alphabetical
  const sortedMoves = [...allMoves].sort((a, b) => {
    const aHas = animIds.has(a.id) ? 0 : 1;
    const bHas = animIds.has(b.id) ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return a.name.localeCompare(b.name);
  });

  // Container
  const container = document.createElement('div');
  container.className = 'debug-move-selector';

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'debug-toggle';
  toggleBtn.textContent = 'FX';
  toggleBtn.title = 'Debug Move Animations';

  // Panel
  const panel = document.createElement('div');
  panel.className = 'debug-panel';
  panel.style.display = 'none';

  // Title
  const title = document.createElement('div');
  title.className = 'debug-title';
  title.textContent = 'Move Animations';
  panel.appendChild(title);

  // Filter input
  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.placeholder = 'Filter moves...';
  filterInput.className = 'debug-filter';
  panel.appendChild(filterInput);

  // Select list
  const select = document.createElement('select');
  select.size = 10;
  select.className = 'debug-select';

  function populateOptions(filter: string): void {
    select.innerHTML = '';
    const lower = filter.toLowerCase();
    for (const move of sortedMoves) {
      if (lower && !move.name.toLowerCase().includes(lower) &&
          !move.type.toLowerCase().includes(lower) &&
          !move.category.toLowerCase().includes(lower)) {
        continue;
      }
      const opt = document.createElement('option');
      opt.value = move.id;
      const hasAnim = animIds.has(move.id);
      opt.textContent = `${hasAnim ? '\u25CF' : '\u25CB'} ${move.name} (${move.type}) [${move.category}]`;
      if (!hasAnim) {
        opt.style.opacity = '0.5';
      }
      select.appendChild(opt);
    }
  }

  populateOptions('');
  panel.appendChild(select);

  // Play button
  const playBtn = document.createElement('button');
  playBtn.className = 'debug-play';
  playBtn.textContent = 'Play Animation';
  panel.appendChild(playBtn);

  // Status text
  const status = document.createElement('div');
  status.className = 'debug-status';
  panel.appendChild(status);

  // ── Events ──

  toggleBtn.addEventListener('click', () => {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
  });

  filterInput.addEventListener('input', () => {
    populateOptions(filterInput.value);
  });

  playBtn.addEventListener('click', async () => {
    const moveId = select.value;
    if (!moveId) {
      status.textContent = 'Select a move first';
      return;
    }

    const def = getMoveAnimation(moveId);
    if (!def) {
      status.textContent = `No animation for: ${moveId}`;
      return;
    }

    if (animPlayer.isPlaying) {
      status.textContent = 'Animation already playing...';
      return;
    }

    const attacker: BattlePosition = { player: 0 as 0, slot: 0 };
    const defender: BattlePosition = { player: 1 as 1, slot: 0 };

    status.textContent = `Playing: ${moveId}...`;
    playBtn.disabled = true;

    try {
      await animPlayer.play(def, attacker, [defender]);
      status.textContent = `Done: ${moveId}`;
    } catch (err) {
      status.textContent = `Error: ${(err as Error).message}`;
    } finally {
      playBtn.disabled = false;
    }
  });

  // ── Styling ──
  const style = document.createElement('style');
  style.textContent = `
    .debug-move-selector {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 9999;
      font-family: monospace;
      font-size: 11px;
    }
    .debug-toggle {
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      border: 1px solid #0f0;
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      float: right;
    }
    .debug-toggle:hover {
      background: rgba(0, 60, 0, 0.9);
    }
    .debug-panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid #0f0;
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 4px;
      width: 260px;
      max-height: 350px;
    }
    .debug-title {
      color: #0f0;
      font-weight: bold;
      text-align: center;
      font-size: 12px;
    }
    .debug-filter {
      background: #111;
      color: #0f0;
      border: 1px solid #333;
      padding: 4px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 11px;
      outline: none;
    }
    .debug-filter:focus {
      border-color: #0f0;
    }
    .debug-select {
      background: #111;
      color: #ccc;
      border: 1px solid #333;
      border-radius: 3px;
      font-family: monospace;
      font-size: 10px;
      outline: none;
      flex: 1;
      min-height: 140px;
    }
    .debug-select option {
      padding: 2px 4px;
    }
    .debug-select option:checked {
      background: #0a3a0a;
      color: #0f0;
    }
    .debug-play {
      background: #0a3a0a;
      color: #0f0;
      border: 1px solid #0f0;
      padding: 6px;
      cursor: pointer;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
    }
    .debug-play:hover:not(:disabled) {
      background: #0a5a0a;
    }
    .debug-play:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .debug-status {
      color: #888;
      font-size: 10px;
      text-align: center;
      min-height: 14px;
    }
  `;

  container.appendChild(style);
  container.appendChild(panel);
  container.appendChild(toggleBtn);

  return { el: container };
}
