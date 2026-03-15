import { BattleEngine } from '@/engine/battle-engine';
import type { BattleConfig, TurnAction, PlayerState } from '@/types/battle';
import type { BattleEvent } from '@/types/events';
import type { PlayerIndex, MajorStatus } from '@/types/common';
import type { PokemonBattleState } from '@/types/pokemon';
import { renderEvent, type EventUIUpdate } from './event-renderer';
import { chooseAIActions } from '../ai/simple-ai';
import { audioManager } from '../util/audio';

// The UI components this controller needs to interact with
export interface BattleUI {
  sprites: {
    player: { el: HTMLElement; updateSprite(id: string, v: 'front' | 'back'): void; showSubstitute(): void; hideSubstitute(): void; setVisible(v: boolean): void }[];
    opponent: { el: HTMLElement; updateSprite(id: string, v: 'front' | 'back'): void; showSubstitute(): void; hideSubstitute(): void; setVisible(v: boolean): void }[];
  };
  infoPanels: {
    player: { update(d: { name: string; level: number; currentHp: number; maxHp: number; status: MajorStatus | null }): void; show(): void; hide(): void }[];
    opponent: { update(d: { name: string; level: number; currentHp: number; maxHp: number; status: MajorStatus | null }): void; show(): void; hide(): void }[];
  };
  battleLog: { addEntry(text: string): void; clear(): void };
  actionMenu: { show(): void; hide(): void; onFight: (() => void) | null; onPokemon: (() => void) | null; onBag: (() => void) | null; onRun: (() => void) | null };
  movePanel: { show(moves: { moveIndex: number; moveId: string; moveName: string; moveType: string; pp: number; maxPp: number }[]): void; hide(): void; onMoveSelect: ((idx: number) => void) | null; onBack: (() => void) | null };
  switchPanel: { show(pokemon: { teamIndex: number; pokemonName: string; speciesId: string; currentHp: number; maxHp: number; isActive?: boolean; isFainted?: boolean }[]): void; hide(): void; onSwitch: ((idx: number) => void) | null; onBack: (() => void) | null };
  turnCounter: HTMLElement;
  onBattleEnd: ((winner: PlayerIndex | null) => void) | null;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Cached info for each active pokemon so we can do partial updates
interface CachedPokemonInfo {
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  status: MajorStatus | null;
}

export class BattleController {
  private engine: BattleEngine;
  private ui: BattleUI;
  private eventDelay: number;
  private cachedInfo: Map<string, CachedPokemonInfo> = new Map();

  constructor(config: BattleConfig, ui: BattleUI, eventDelay?: number) {
    this.engine = new BattleEngine(config);
    this.ui = ui;
    this.eventDelay = eventDelay ?? 400;
  }

  async start(): Promise<void> {
    const events = this.engine.startBattle();
    await this.processEvents(events);
    await this.mainLoop();
  }

  // ---- Main loop ----

  private async mainLoop(): Promise<void> {
    while (!this.engine.isOver()) {
      this.ui.turnCounter.textContent = `Turn ${this.engine.getTurn()}`;

      // Wait for player action(s)
      const playerActions = await this.collectPlayerActions();

      // Generate AI actions
      const aiActions = chooseAIActions(this.engine, 1);

      // Submit both
      this.engine.submitAction(0, playerActions);
      this.engine.submitAction(1, aiActions);

      // Resolve turn
      const events = this.engine.resolveTurn();
      await this.processEvents(events);

      // Handle forced switches
      await this.handleForcedSwitches();
    }

    // Battle over
    const winner = this.engine.getWinner();
    this.ui.onBattleEnd?.(winner);
  }

  // ---- Player action collection ----

  private async collectPlayerActions(): Promise<TurnAction[]> {
    const availableActions = this.engine.getAvailableActions(0);
    const actions: TurnAction[] = [];

    for (const slotInfo of availableActions) {
      const action = await this.waitForPlayerAction(slotInfo.slot);
      actions.push(action);
    }

    return actions;
  }

  private waitForPlayerAction(slot: number): Promise<TurnAction> {
    return new Promise<TurnAction>(resolve => {
      const available = this.engine.getAvailableActions(0);
      const slotInfo = available.find(a => a.slot === slot);
      if (!slotInfo) {
        // Fallback: use first move
        resolve({ type: 'move', player: 0, slot, moveIndex: 0 });
        return;
      }

      this.hideAllPanels();
      this.ui.actionMenu.show();

      // Fight -> show move panel
      this.ui.actionMenu.onFight = () => {
        this.ui.actionMenu.hide();
        this.ui.movePanel.show(slotInfo.canMove);

        this.ui.movePanel.onMoveSelect = (moveIndex: number) => {
          this.ui.movePanel.hide();
          this.cleanupCallbacks();

          const action: TurnAction = {
            type: 'move',
            player: 0,
            slot,
            moveIndex,
          };

          // In doubles, handle target selection
          const format = this.engine.getState().config.format;
          if (format === 'doubles') {
            // For simplicity, default to targeting the first active opponent
            for (let s = 0; s < 2; s++) {
              const oppMon = this.engine.getActivePokemon(1, s);
              if (oppMon && !oppMon.isFainted) {
                action.targetPosition = { player: 1, slot: s };
                break;
              }
            }
          }

          resolve(action);
        };

        this.ui.movePanel.onBack = () => {
          this.ui.movePanel.hide();
          // Re-show action menu
          this.waitForPlayerAction(slot).then(resolve);
        };
      };

      // Pokemon -> show switch panel
      this.ui.actionMenu.onPokemon = () => {
        this.ui.actionMenu.hide();
        this.showSwitchPanel(false);

        this.ui.switchPanel.onSwitch = (teamIndex: number) => {
          this.ui.switchPanel.hide();
          this.cleanupCallbacks();
          resolve({
            type: 'switch',
            player: 0,
            slot,
            switchToIndex: teamIndex,
          });
        };

        this.ui.switchPanel.onBack = () => {
          this.ui.switchPanel.hide();
          this.waitForPlayerAction(slot).then(resolve);
        };
      };

      // Bag -> not implemented, just log
      this.ui.actionMenu.onBag = () => {
        this.ui.battleLog.addEntry('The bag is not available in this battle.');
      };

      // Run
      this.ui.actionMenu.onRun = () => {
        this.hideAllPanels();
        this.cleanupCallbacks();
        resolve({ type: 'run', player: 0 });
      };
    });
  }

  // ---- Forced switch handling ----

  private async handleForcedSwitches(): Promise<void> {
    while (this.engine.getPhase() === 'forced-switch') {
      const pending = this.engine.getPendingForcedSwitches();
      if (pending.length === 0) break;

      for (const fs of pending) {
        if (fs.player === 0) {
          // Player picks
          const teamIndex = await this.waitForForcedSwitch(fs.slot);
          const events = this.engine.submitSwitch(0, fs.slot, teamIndex);
          await this.processEvents(events);
        } else {
          // AI picks first available
          const aiTeamIndex = this.pickAISwitch(fs.player);
          if (aiTeamIndex !== null) {
            const events = this.engine.submitSwitch(1, fs.slot, aiTeamIndex);
            await this.processEvents(events);
          }
        }
      }
    }
  }

  private waitForForcedSwitch(slot: number): Promise<number> {
    return new Promise<number>(resolve => {
      this.hideAllPanels();
      this.ui.battleLog.addEntry('Choose a Pokemon to send out!');
      this.showSwitchPanel(true);

      this.ui.switchPanel.onSwitch = (teamIndex: number) => {
        this.ui.switchPanel.hide();
        this.cleanupCallbacks();
        resolve(teamIndex);
      };

      // No back button during forced switch (handled by the switch panel itself)
      this.ui.switchPanel.onBack = null;
    });
  }

  private pickAISwitch(player: PlayerIndex): number | null {
    const playerState = this.engine.getPlayer(player);
    for (let i = 0; i < playerState.team.length; i++) {
      const mon = playerState.team[i];
      if (!mon.isFainted && !mon.isActive) {
        return i;
      }
    }
    return null;
  }

  // ---- Event processing ----

  private async processEvents(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      const update = renderEvent(event);
      await this.applyUpdate(update);

      const waitMs = update.delay ?? this.eventDelay;
      if (waitMs > 0) {
        await delay(waitMs);
      }
    }
  }

  private async applyUpdate(update: EventUIUpdate): Promise<void> {
    // Log text
    if (update.logText) {
      this.ui.battleLog.addEntry(update.logText);
    }

    // HP update
    if (update.hpUpdate) {
      const { player, slot, currentHp, maxHp } = update.hpUpdate;
      const key = `${player}-${slot}`;
      const cached = this.cachedInfo.get(key);
      if (cached) {
        cached.currentHp = currentHp;
        cached.maxHp = maxHp;
        const side = player === 0 ? 'player' : 'opponent';
        const panel = this.ui.infoPanels[side][slot];
        if (panel) {
          panel.update({
            name: cached.name,
            level: cached.level,
            currentHp,
            maxHp,
            status: cached.status,
          });
        }
      }
    }

    // Sprite update
    if (update.spriteUpdate) {
      const { player, slot, action, speciesId } = update.spriteUpdate;
      const side = player === 0 ? 'player' : 'opponent';
      const sprite = this.ui.sprites[side][slot];
      if (sprite) {
        switch (action) {
          case 'show':
            if (speciesId) {
              sprite.updateSprite(speciesId, player === 0 ? 'back' : 'front');
            }
            sprite.setVisible(true);
            break;
          case 'hide':
            sprite.setVisible(false);
            break;
          case 'substitute':
            sprite.showSubstitute();
            break;
          case 'unsubstitute':
            sprite.hideSubstitute();
            break;
        }
      }
    }

    // Status update
    if (update.statusUpdate) {
      const { player, slot, status } = update.statusUpdate;
      const key = `${player}-${slot}`;
      const cached = this.cachedInfo.get(key);
      if (cached) {
        cached.status = (status as MajorStatus | null);
        const side = player === 0 ? 'player' : 'opponent';
        const panel = this.ui.infoPanels[side][slot];
        if (panel) {
          panel.update({
            name: cached.name,
            level: cached.level,
            currentHp: cached.currentHp,
            maxHp: cached.maxHp,
            status: cached.status,
          });
        }
      }
    }

    // Info update (full refresh, typically on switch-in)
    if (update.infoUpdate) {
      const { player, slot, name, level, currentHp, maxHp, status } = update.infoUpdate;
      const key = `${player}-${slot}`;
      const cached: CachedPokemonInfo = {
        name,
        level,
        currentHp,
        maxHp,
        status: (status as MajorStatus | null),
      };

      // Try to get the actual level from the engine state
      const mon = this.engine.getActivePokemon(player, slot);
      if (mon) {
        cached.level = mon.config.level;
        cached.status = mon.status;
      }

      this.cachedInfo.set(key, cached);
      const side = player === 0 ? 'player' : 'opponent';
      const panel = this.ui.infoPanels[side][slot];
      if (panel) {
        panel.update({
          name: cached.name,
          level: cached.level,
          currentHp: cached.currentHp,
          maxHp: cached.maxHp,
          status: cached.status,
        });
        panel.show();
      }
    }

    // Audio
    if (update.playCry) {
      audioManager.playCry(update.playCry);
    }
    if (update.playMoveSfx) {
      audioManager.playMoveSfx(update.playMoveSfx);
    }
  }

  // ---- UI helpers ----

  private hideAllPanels(): void {
    this.ui.actionMenu.hide();
    this.ui.movePanel.hide();
    this.ui.switchPanel.hide();
  }

  private cleanupCallbacks(): void {
    this.ui.actionMenu.onFight = null;
    this.ui.actionMenu.onPokemon = null;
    this.ui.actionMenu.onBag = null;
    this.ui.actionMenu.onRun = null;
    this.ui.movePanel.onMoveSelect = null;
    this.ui.movePanel.onBack = null;
    this.ui.switchPanel.onSwitch = null;
    this.ui.switchPanel.onBack = null;
  }

  private showSwitchPanel(forceSwitch: boolean): void {
    const playerState = this.engine.getPlayer(0);
    const switchOptions = playerState.team.map((mon, i) => ({
      teamIndex: i,
      pokemonName: mon.config.nickname ?? mon.species.name,
      speciesId: mon.species.id,
      currentHp: mon.currentHp,
      maxHp: mon.maxHp,
      isActive: mon.isActive,
      isFainted: mon.isFainted,
    }));
    this.ui.switchPanel.show(switchOptions);
  }

  // ---- Public accessors for the engine (useful for external code) ----

  getEngine(): BattleEngine {
    return this.engine;
  }
}
