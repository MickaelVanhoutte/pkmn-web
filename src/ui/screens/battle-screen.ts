import { el } from '../util/dom';
import type { BattleConfig } from '@/types/battle';
import type { PlayerIndex } from '@/types/common';
import { createSprite, type SpriteComponent } from '../components/sprite';
import { createInfoPanel, type InfoPanelComponent } from '../components/info-panel';
import { createBattleLog, type BattleLogComponent } from '../components/battle-log';
import { createActionMenu, type ActionMenuComponent } from '../components/action-menu';
import { createMovePanel, type MovePanelComponent } from '../components/move-panel';
import { createSwitchPanel, type SwitchPanelComponent } from '../components/switch-panel';
import { createTargetPanel, type TargetPanelComponent } from '../components/target-panel';
import { BattleController, type BattleUI } from '../battle/battle-controller';
import { CanvasOverlay } from '../animation/canvas-overlay';
import { PositionResolver } from '../animation/position-resolver';
import { SpriteAnimator } from '../animation/sprite-animator';
import { MoveAnimationPlayer } from '../animation/move-animation-player';
import { IS_DEBUG } from '../util/debug';
import type { NavigateFn } from '../main';

const BACKGROUNDS = [
  'beach', 'bridge-town', 'building-trainer-tower', 'cave', 'desert',
  'dive', 'forest', 'grass', 'graveyard', 'indoors', 'lab', 'lake',
  'neutral', 'rocky', 'route', 'snow-cave', 'snow-mountain', 'snow',
  'space', 'volcano-cave',
];

export function showBattleScreen(
  container: HTMLElement,
  navigate: NavigateFn,
  params: { config: BattleConfig },
): () => void {
  const { config } = params;
  const isDoubles = config.format === 'doubles';
  const slotsPerSide = isDoubles ? 2 : 1;

  // Pick random background
  const bgName = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

  // ── Create UI components ──
  const playerSprites: SpriteComponent[] = [];
  const opponentSprites: SpriteComponent[] = [];
  const playerInfos: InfoPanelComponent[] = [];
  const opponentInfos: InfoPanelComponent[] = [];

  for (let s = 0; s < slotsPerSide; s++) {
    playerSprites.push(createSprite(`player-${s}` as 'player-0' | 'player-1'));
    opponentSprites.push(createSprite(`opponent-${s}` as 'opponent-0' | 'opponent-1'));
    playerInfos.push(createInfoPanel('player'));
    opponentInfos.push(createInfoPanel('opponent'));
  }

  if (isDoubles) {
    playerInfos[1].el.classList.add('slot-1');
    opponentInfos[1].el.classList.add('slot-1');
  }

  const battleLog: BattleLogComponent = createBattleLog();
  const actionMenu: ActionMenuComponent = createActionMenu();
  const movePanel: MovePanelComponent = createMovePanel();
  const switchPanel: SwitchPanelComponent = createSwitchPanel();
  const targetPanel: TargetPanelComponent = createTargetPanel();

  // Hidden turn counter (updated by controller, not displayed)
  const turnCounter = el('span', { class: 'turn-counter' });
  turnCounter.style.display = 'none';

  // ── Build DOM ──
  const arenaClasses = `battle-arena${isDoubles ? ' doubles' : ''}`;
  const arena = el('div', { class: arenaClasses });

  for (let s = 0; s < slotsPerSide; s++) {
    arena.appendChild(playerInfos[s].el);
    arena.appendChild(opponentInfos[s].el);
    arena.appendChild(playerSprites[s].el);
    arena.appendChild(opponentSprites[s].el);
  }

  const actionBox = el('div', { class: 'action-box' }, [
    actionMenu.el,
    movePanel.el,
    targetPanel.el,
  ]);

  const battleContainer = el('div', { class: 'battle-container' }, [arena, battleLog.el, actionBox, switchPanel.el]);
  // Background on container so it extends behind buttons
  battleContainer.style.backgroundImage = `url('./backgrounds/${bgName}.png')`;
  container.appendChild(battleContainer);

  // ── Setup animation system ──
  const canvasOverlay = new CanvasOverlay(arena);
  const posResolver = new PositionResolver(arena);
  const spriteAnimator = new SpriteAnimator(arena, posResolver);

  // Register sprite slots with animation system
  for (let s = 0; s < slotsPerSide; s++) {
    posResolver.registerSlot(0, s, playerSprites[s].el);
    posResolver.registerSlot(1, s, opponentSprites[s].el);
    spriteAnimator.registerSlot(0, s, playerSprites[s].el);
    spriteAnimator.registerSlot(1, s, opponentSprites[s].el);
  }

  const animPlayer = new MoveAnimationPlayer(canvasOverlay, posResolver, spriteAnimator, arena);

  // ── Build BattleUI interface ──
  const ui: BattleUI = {
    sprites: {
      player: playerSprites,
      opponent: opponentSprites,
    },
    infoPanels: {
      player: playerInfos,
      opponent: opponentInfos,
    },
    battleLog,
    actionMenu,
    movePanel,
    switchPanel,
    targetPanel,
    turnCounter,
    onBattleEnd: (winner: PlayerIndex | null) => {
      setTimeout(() => {
        if (disposed) return;
        navigate('result', { winner, config });
      }, 2000);
    },
  };

  // ── Create controller ──
  const controller = new BattleController(config, ui);
  controller.setAnimationPlayer(animPlayer);
  controller.setSpriteAnimator(spriteAnimator);

  // ── Debug move selector (dev mode only) ──
  if (IS_DEBUG) {
    import('../components/debug-move-selector').then(({ createDebugMoveSelector }) => {
      const debugSelector = createDebugMoveSelector(animPlayer, spriteAnimator, arena);
      battleContainer.appendChild(debugSelector.el);
    });
  }

  // ── Start the battle ──
  let disposed = false;
  controller.start();

  return () => {
    disposed = true;
    canvasOverlay.destroy();
  };
}
