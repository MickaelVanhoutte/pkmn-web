import { el } from '../util/dom';
import type { BattleConfig } from '@/types/battle';
import type { BattleEvent } from '@/types/events';
import type { PlayerIndex } from '@/types/common';
import { BattleEngine } from '@/engine/battle-engine';
import { getPokemonName } from '@/model/pokemon';
import { createSprite, type SpriteComponent } from '../components/sprite';
import { createInfoPanel, type InfoPanelComponent } from '../components/info-panel';
import { createBattleLog, type BattleLogComponent } from '../components/battle-log';
import { createActionMenu, type ActionMenuComponent } from '../components/action-menu';
import { createMovePanel, type MovePanelComponent } from '../components/move-panel';
import { createSwitchPanel, type SwitchPanelComponent } from '../components/switch-panel';
import type { NavigateFn } from '../main';

const BACKGROUNDS = ['bg-grassland', 'bg-cave', 'bg-ocean', 'bg-mountain', 'bg-forest'];

export function showBattleScreen(
  container: HTMLElement,
  navigate: NavigateFn,
  params: { config: BattleConfig },
): () => void {
  const { config } = params;
  const isDoubles = config.format === 'doubles';
  const slotsPerSide = isDoubles ? 2 : 1;

  const engine = new BattleEngine(config);

  // Pick random background
  const bgClass = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

  // ── Create components ──
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

  // Add slot-1 class for doubles second info panels
  if (isDoubles) {
    playerInfos[1].el.classList.add('slot-1');
    opponentInfos[1].el.classList.add('slot-1');
  }

  const battleLog: BattleLogComponent = createBattleLog();
  const actionMenu: ActionMenuComponent = createActionMenu();
  const movePanel: MovePanelComponent = createMovePanel();
  const switchPanel: SwitchPanelComponent = createSwitchPanel();

  // Turn counter
  const turnCounter = el('span', { class: 'turn-counter' }, ['Turn 1']);
  const topBar = el('div', { class: 'battle-top-bar' }, [turnCounter]);

  // ── Build DOM ──
  const arenaClasses = `battle-arena ${bgClass}${isDoubles ? ' doubles' : ''}`;
  const arena = el('div', { class: arenaClasses });
  arena.appendChild(topBar);

  for (let s = 0; s < slotsPerSide; s++) {
    arena.appendChild(playerInfos[s].el);
    arena.appendChild(opponentInfos[s].el);
    arena.appendChild(playerSprites[s].el);
    arena.appendChild(opponentSprites[s].el);
  }

  const bottomPanel = el('div', { class: 'battle-bottom' }, [
    battleLog.el,
    actionMenu.el,
    movePanel.el,
    switchPanel.el,
  ]);

  const battleContainer = el('div', { class: 'battle-container' }, [arena, bottomPanel]);
  container.appendChild(battleContainer);

  // ── State ──
  let disposed = false;
  let currentSlot = 0; // Which slot we're picking actions for (0 or 1 in doubles)
  let pendingActions: import('@/types/battle').TurnAction[] = []; // Accumulated actions for this turn
  let isForcedSwitch = false;

  // ── UI helpers ──
  function refreshSpritesAndInfo(): void {
    for (let s = 0; s < slotsPerSide; s++) {
      const playerMon = engine.getActivePokemon(0 as PlayerIndex, s);
      if (playerMon && !playerMon.isFainted) {
        playerSprites[s].updateSprite(playerMon.species.id, 'back');
        playerSprites[s].setVisible(true);
        if (playerMon.substituteHp > 0) {
          playerSprites[s].showSubstitute();
        } else {
          playerSprites[s].hideSubstitute();
        }
        playerInfos[s].update({
          name: getPokemonName(playerMon),
          level: playerMon.config.level,
          currentHp: playerMon.currentHp,
          maxHp: playerMon.maxHp,
          status: playerMon.status,
        });
        playerInfos[s].show();
      } else if (playerMon && playerMon.isFainted) {
        playerSprites[s].setVisible(false);
        playerInfos[s].hide();
      } else {
        playerSprites[s].setVisible(false);
        playerInfos[s].hide();
      }

      const oppMon = engine.getActivePokemon(1 as PlayerIndex, s);
      if (oppMon && !oppMon.isFainted) {
        opponentSprites[s].updateSprite(oppMon.species.id, 'front');
        opponentSprites[s].setVisible(true);
        if (oppMon.substituteHp > 0) {
          opponentSprites[s].showSubstitute();
        } else {
          opponentSprites[s].hideSubstitute();
        }
        opponentInfos[s].update({
          name: getPokemonName(oppMon),
          level: oppMon.config.level,
          currentHp: oppMon.currentHp,
          maxHp: oppMon.maxHp,
          status: oppMon.status,
        });
        opponentInfos[s].show();
      } else if (oppMon && oppMon.isFainted) {
        opponentSprites[s].setVisible(false);
        opponentInfos[s].hide();
      } else {
        opponentSprites[s].setVisible(false);
        opponentInfos[s].hide();
      }
    }

    turnCounter.textContent = `Turn ${engine.getTurn()}`;
  }

  function beginTurnInput(): void {
    currentSlot = 0;
    pendingActions = [];
    isForcedSwitch = false;
    showActionForSlot(0);
  }

  function showActionForSlot(slot: number): void {
    currentSlot = slot;
    const available = engine.getAvailableActions(0 as PlayerIndex);
    const slotInfo = available.find(a => a.slot === slot);

    if (!slotInfo) {
      // This slot has no actions (pokemon fainted), skip to next or submit
      if (isDoubles && slot === 0) {
        showActionForSlot(1);
      } else {
        submitTurn();
      }
      return;
    }

    // In doubles, show which pokemon is choosing
    if (isDoubles) {
      const mon = engine.getActivePokemon(0 as PlayerIndex, slot);
      if (mon) {
        battleLog.addEntry(`What will ${getPokemonName(mon)} do?`);
      }
    }

    actionMenu.show();
    movePanel.hide();
    switchPanel.hide();
  }

  function showMoveSelection(): void {
    actionMenu.hide();
    switchPanel.hide();

    const available = engine.getAvailableActions(0 as PlayerIndex);
    const slotInfo = available.find(a => a.slot === currentSlot);
    if (slotInfo && slotInfo.canMove.length > 0) {
      movePanel.show(slotInfo.canMove);
    }
  }

  function showSwitchSelection(forced: boolean): void {
    isForcedSwitch = forced;
    actionMenu.hide();
    movePanel.hide();

    const player = engine.getPlayer(0 as PlayerIndex);
    // Filter out pokemon already chosen for switch in pendingActions
    const alreadySwitchingTo = pendingActions
      .filter(a => a.type === 'switch')
      .map(a => (a as import('@/types/battle').SwitchAction).switchToIndex);

    const pokemonList = player.team.map((mon, i) => ({
      teamIndex: i,
      pokemonName: getPokemonName(mon),
      speciesId: mon.species.id,
      currentHp: mon.currentHp,
      maxHp: mon.maxHp,
      isActive: mon.isActive,
      isFainted: mon.isFainted || alreadySwitchingTo.includes(i),
    }));

    switchPanel.show(pokemonList);
  }

  function addActionAndAdvance(action: import('@/types/battle').TurnAction): void {
    pendingActions.push(action);

    if (isDoubles && currentSlot === 0) {
      // Need action for second slot too
      showActionForSlot(1);
    } else {
      submitTurn();
    }
  }

  function submitTurn(): void {
    const aiActions = generateAiActions();

    try {
      engine.submitAction(0 as PlayerIndex, pendingActions);
      engine.submitAction(1 as PlayerIndex, aiActions);
      const events = engine.resolveTurn();
      logEvents(events);
      refreshSpritesAndInfo();

      if (engine.isOver()) {
        handleBattleEnd();
      } else if (engine.getPhase() === 'forced-switch') {
        handleForcedSwitch();
      } else {
        beginTurnInput();
      }
    } catch (err) {
      battleLog.addEntry(`Error: ${(err as Error).message}`);
      beginTurnInput();
    }
  }

  function logEvents(events: BattleEvent[]): void {
    for (const event of events) {
      const text = eventToText(event);
      if (text) {
        battleLog.addEntry(text);
      }
    }
  }

  function eventToText(event: BattleEvent): string | null {
    switch (event.kind) {
      case 'battle-start':
        return `Battle between ${event.players[0]} and ${event.players[1]}!`;
      case 'turn-start':
        return `--- Turn ${event.turn} ---`;
      case 'move-use': {
        const userName = getPokemonNameAtPosition(event.user.player, event.user.slot);
        return `${userName} used ${event.moveName}!`;
      }
      case 'damage': {
        const targetName = getPokemonNameAtPosition(event.target.player, event.target.slot);
        if (event.source === 'move') {
          return `${targetName} took ${event.amount} damage!`;
        }
        return `${targetName} took ${event.amount} damage from ${event.source}!`;
      }
      case 'heal': {
        const targetName = getPokemonNameAtPosition(event.target.player, event.target.slot);
        return `${targetName} recovered ${event.amount} HP!`;
      }
      case 'faint':
        return `${event.pokemonName} fainted!`;
      case 'switch-in':
        return `Go! ${event.pokemonName}!`;
      case 'switch-out':
        return `${event.pokemonName}, come back!`;
      case 'status-applied':
        return `${event.pokemonName} was ${statusVerb(event.status)}!`;
      case 'status-cured':
        return `${event.pokemonName}'s ${event.status} was cured!`;
      case 'critical-hit':
        return 'A critical hit!';
      case 'type-effectiveness':
        if (event.effectiveness === 'super-effective') return "It's super effective!";
        if (event.effectiveness === 'not-very-effective') return "It's not very effective...";
        if (event.effectiveness === 'immune') return 'It had no effect!';
        return null;
      case 'miss':
        return 'The attack missed!';
      case 'fail':
        return `It failed! (${event.reason})`;
      case 'weather-set':
        return weatherSetText(event.weather);
      case 'weather-end':
        return 'The weather returned to normal.';
      case 'weather-damage': {
        const targetName = getPokemonNameAtPosition(event.target.player, event.target.slot);
        return `${targetName} is buffeted by ${event.weather}!`;
      }
      case 'stat-change': {
        const dir = event.stages > 0 ? 'rose' : 'fell';
        const amount = Math.abs(event.stages) > 1 ? ' sharply' : '';
        return `${event.pokemonName}'s ${event.stat}${amount} ${dir}!`;
      }
      case 'ability-activate':
        return event.message;
      case 'hazard-set':
        return `${event.hazard} was set on the field!`;
      case 'hazard-cleared':
        return `${event.hazard} was cleared!`;
      case 'hazard-damage': {
        const targetName = getPokemonNameAtPosition(event.target.player, event.target.slot);
        return `${targetName} was hurt by ${event.hazard}!`;
      }
      case 'screen-set':
        return `${screenName(event.screen)} was set up!`;
      case 'screen-end':
        return `${screenName(event.screen)} wore off!`;
      case 'substitute-created':
        return 'A substitute was created!';
      case 'substitute-broken':
        return "The substitute broke!";
      case 'confusion-start':
        return `${event.pokemonName} became confused!`;
      case 'confusion-end':
        return `${event.pokemonName} snapped out of confusion!`;
      case 'confusion-hit-self':
        return 'It hurt itself in confusion!';
      case 'charging': {
        const userName = getPokemonNameAtPosition(event.user.player, event.user.slot);
        return `${userName} is charging ${event.moveName}!`;
      }
      case 'terrain-set':
        return `${event.terrain} Terrain was set!`;
      case 'terrain-end':
        return 'The terrain returned to normal.';
      case 'multi-hit-complete':
        return `Hit ${event.hitCount} time(s)!`;
      case 'battle-end':
        return event.winner !== null
          ? `${config.players[event.winner].name} wins!`
          : 'The battle ended in a draw!';
      case 'message':
        return event.text;
      default:
        return null;
    }
  }

  function getPokemonNameAtPosition(player: PlayerIndex, slot: number): string {
    const mon = engine.getActivePokemon(player, slot);
    return mon ? getPokemonName(mon) : '???';
  }

  function statusVerb(status: string): string {
    switch (status) {
      case 'burn': return 'burned';
      case 'paralysis': return 'paralyzed';
      case 'freeze': return 'frozen';
      case 'poison': return 'poisoned';
      case 'sleep': return 'put to sleep';
      default: return status;
    }
  }

  function weatherSetText(weather: string): string {
    switch (weather) {
      case 'sun': return 'The sunlight turned harsh!';
      case 'rain': return 'It started to rain!';
      case 'sandstorm': return 'A sandstorm kicked up!';
      case 'hail': return 'It started to hail!';
      default: return `${weather} started!`;
    }
  }

  function screenName(screen: string): string {
    switch (screen) {
      case 'lightScreen': return 'Light Screen';
      case 'reflect': return 'Reflect';
      case 'tailwind': return 'Tailwind';
      default: return screen;
    }
  }

  // ── AI logic ──
  function generateAiActions(): import('@/types/battle').TurnAction[] {
    const actions: import('@/types/battle').TurnAction[] = [];
    const available = engine.getAvailableActions(1 as PlayerIndex);

    for (const slotInfo of available) {
      if (slotInfo.canMove.length > 0) {
        // Pick a random move
        const move = slotInfo.canMove[Math.floor(Math.random() * slotInfo.canMove.length)];
        actions.push({
          type: 'move',
          player: 1 as PlayerIndex,
          slot: slotInfo.slot,
          moveIndex: move.moveIndex,
        });
      } else if (slotInfo.canSwitch.length > 0) {
        // Must switch
        const target = slotInfo.canSwitch[Math.floor(Math.random() * slotInfo.canSwitch.length)];
        actions.push({
          type: 'switch',
          player: 1 as PlayerIndex,
          slot: slotInfo.slot,
          switchToIndex: target.teamIndex,
        });
      }
    }

    return actions;
  }

  // ── Wire up action handlers ──
  actionMenu.onFight = () => {
    showMoveSelection();
  };

  actionMenu.onPokemon = () => {
    showSwitchSelection(false);
  };

  actionMenu.onRun = () => {
    const events = engine.forfeit(0 as PlayerIndex);
    logEvents(events);
    refreshSpritesAndInfo();
    handleBattleEnd();
  };

  actionMenu.onBag = () => {
    battleLog.addEntry('Bag is not available in this version.');
  };

  movePanel.onMoveSelect = (moveIndex: number) => {
    movePanel.hide();

    const action: import('@/types/battle').TurnAction = {
      type: 'move',
      player: 0 as PlayerIndex,
      slot: currentSlot,
      moveIndex,
    };

    // In doubles, default target to first active opponent slot
    if (isDoubles) {
      const oppMon0 = engine.getActivePokemon(1 as PlayerIndex, 0);
      const oppMon1 = engine.getActivePokemon(1 as PlayerIndex, 1);
      const targetSlot = (oppMon0 && !oppMon0.isFainted) ? 0 : 1;
      (action as import('@/types/battle').MoveAction).targetPosition = { player: 1 as PlayerIndex, slot: targetSlot };
    }

    addActionAndAdvance(action);
  };

  movePanel.onBack = () => {
    if (isDoubles && currentSlot === 1) {
      // Go back to slot 0 action selection
      pendingActions.pop();
      showActionForSlot(0);
    } else {
      showActionForSlot(currentSlot);
    }
  };

  switchPanel.onSwitch = (teamIndex: number) => {
    switchPanel.hide();

    if (isForcedSwitch) {
      try {
        const pending = engine.getPendingForcedSwitches();
        const playerPending = pending.find(fs => fs.player === 0);
        const slot = playerPending ? playerPending.slot : 0;
        const events = engine.submitSwitch(0 as PlayerIndex, slot, teamIndex);
        logEvents(events);
        refreshSpritesAndInfo();

        if (engine.isOver()) {
          handleBattleEnd();
        } else if (engine.getPhase() === 'forced-switch') {
          handleForcedSwitch();
        } else {
          beginTurnInput();
        }
      } catch (err) {
        battleLog.addEntry(`Error: ${(err as Error).message}`);
        showSwitchSelection(true);
      }
    } else {
      const action: import('@/types/battle').TurnAction = {
        type: 'switch',
        player: 0 as PlayerIndex,
        slot: currentSlot,
        switchToIndex: teamIndex,
      };
      addActionAndAdvance(action);
    }
  };

  switchPanel.onBack = () => {
    if (isForcedSwitch) return; // Can't go back on forced switch
    if (isDoubles && currentSlot === 1) {
      pendingActions.pop();
      showActionForSlot(0);
    } else {
      showActionForSlot(currentSlot);
    }
  };

  function handleForcedSwitch(): void {
    const pending = engine.getPendingForcedSwitches();

    // Handle AI forced switches first
    for (const fs of pending) {
      if (fs.player === 1) {
        const aiPlayer = engine.getPlayer(1 as PlayerIndex);
        const available = aiPlayer.team
          .map((mon, i) => ({ mon, i }))
          .filter(({ mon, i }) => !mon.isFainted && !mon.isActive && !aiPlayer.activePokemon.includes(i));

        if (available.length > 0) {
          const choice = available[Math.floor(Math.random() * available.length)];
          const events = engine.submitSwitch(1 as PlayerIndex, fs.slot, choice.i);
          logEvents(events);
          refreshSpritesAndInfo();
        }
      }
    }

    // Check if player also needs to switch
    const remainingPending = engine.getPendingForcedSwitches();
    const playerPending = remainingPending.filter((fs) => fs.player === 0);

    if (playerPending.length > 0) {
      showSwitchSelection(true);
    } else if (engine.isOver()) {
      handleBattleEnd();
    } else {
      beginTurnInput();
    }
  }

  function handleBattleEnd(): void {
    actionMenu.hide();
    movePanel.hide();
    switchPanel.hide();

    // Delay navigation to let the player see the final log
    setTimeout(() => {
      if (disposed) return;
      navigate('result', {
        winner: engine.getWinner(),
        config,
      });
    }, 2000);
  }

  // ── Start the battle ──
  const startEvents = engine.startBattle();
  logEvents(startEvents);
  refreshSpritesAndInfo();
  beginTurnInput();

  return () => {
    disposed = true;
  };
}
