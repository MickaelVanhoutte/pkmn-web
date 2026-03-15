import type { MajorStatus } from '@/types/common';
import { el } from '../util/dom';
import { createHpBar, type HpBarComponent } from './hp-bar';

export interface InfoPanelComponent {
  el: HTMLElement;
  update(data: {
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    status: MajorStatus | null;
  }): void;
  show(): void;
  hide(): void;
}

const STATUS_ABBREVIATIONS: Record<MajorStatus, string> = {
  burn: 'BRN',
  paralysis: 'PAR',
  freeze: 'FRZ',
  poison: 'PSN',
  sleep: 'SLP',
};

export function createInfoPanel(side: 'player' | 'opponent'): InfoPanelComponent {
  const nameSpan = el('span', { class: 'pokemon-name' });
  const levelSpan = el('span', { class: 'pokemon-level' });

  const statusBadge = el('span', { class: 'status-badge' });
  statusBadge.style.display = 'none';

  const headerRow = el('div', { class: 'info-header' }, [nameSpan, statusBadge, levelSpan]);

  const isPlayer = side === 'player';
  const hpBar: HpBarComponent = createHpBar(0, 1, { showText: isPlayer });

  const children: HTMLElement[] = [headerRow, hpBar.el];

  // EXP bar — player only
  let expFill: HTMLElement | null = null;
  if (isPlayer) {
    expFill = el('div', { class: 'exp-bar-fill' });
    const expTrack = el('div', { class: 'exp-bar-track' }, [expFill]);
    children.push(expTrack);
  }

  const root = el('div', { class: `info-panel ${side}` }, children);

  function update(data: {
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    status: MajorStatus | null;
  }): void {
    nameSpan.textContent = `[${data.name.toUpperCase()}]`;
    levelSpan.textContent = `[Lv. ${data.level}]`;
    hpBar.update(data.currentHp, data.maxHp);

    if (data.status) {
      statusBadge.textContent = STATUS_ABBREVIATIONS[data.status];
      statusBadge.className = `status-badge ${data.status}`;
      statusBadge.style.display = '';
    } else {
      statusBadge.textContent = '';
      statusBadge.className = 'status-badge';
      statusBadge.style.display = 'none';
    }
  }

  function show(): void {
    root.style.display = '';
  }

  function hide(): void {
    root.style.display = 'none';
  }

  return { el: root, update, show, hide };
}
