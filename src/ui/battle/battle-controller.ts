import { BattleEngine } from '@/engine/battle-engine';
import type { BattleConfig, TurnAction, PlayerState } from '@/types/battle';
import type { BattleEvent } from '@/types/events';
import type { PlayerIndex, BattlePosition, MajorStatus } from '@/types/common';
import type { MoveTarget } from '@/types/move';
import type { PokemonBattleState } from '@/types/pokemon';
import { needsTargetSelection, getValidMoveTargets } from '@/engine/action-validator';
import { renderEvent, type EventUIUpdate } from './event-renderer';
import { chooseAIActions } from '../ai/simple-ai';
import { audioManager } from '../util/audio';
import type { MoveAnimationPlayer } from '../animation/move-animation-player';
import type { SpriteAnimator } from '../animation/sprite-animator';
import { getMoveAnimation, getChargeAnimation } from '../animation/defs';
import type { TargetOption } from '../components/target-panel';
import type { FieldStatusChipComponent } from '../components/field-status-chip';

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
  actionMenu: { show(canGoBack?: boolean): void; hide(): void; onFight: (() => void) | null; onPokemon: (() => void) | null; onBag: (() => void) | null; onRun: (() => void) | null; onBack: (() => void) | null };
  movePanel: { show(moves: { moveIndex: number; moveId: string; moveName: string; moveType: string; pp: number; maxPp: number }[]): void; hide(): void; onMoveSelect: ((idx: number) => void) | null; onBack: (() => void) | null };
  switchPanel: { show(pokemon: { teamIndex: number; pokemonName: string; speciesId: string; currentHp: number; maxHp: number; isActive?: boolean; isFainted?: boolean }[]): void; hide(): void; onSwitch: ((idx: number) => void) | null; onBack: (() => void) | null };
  targetPanel: { show(targets: TargetOption[]): void; hide(): void; onTargetSelect: ((position: BattlePosition) => void) | null; onBack: (() => void) | null };
  turnCounter: HTMLElement;
  fieldStatusChip?: FieldStatusChipComponent;
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
  private animPlayer: MoveAnimationPlayer | null = null;
  private spriteAnimator: SpriteAnimator | null = null;

  constructor(config: BattleConfig, ui: BattleUI, eventDelay?: number) {
    this.engine = new BattleEngine(config);
    this.ui = ui;
    this.eventDelay = eventDelay ?? 1000;
  }

  setAnimationPlayer(player: MoveAnimationPlayer): void {
    this.animPlayer = player;
  }

  setSpriteAnimator(animator: SpriteAnimator): void {
    this.spriteAnimator = animator;
  }

  getAnimationPlayer(): MoveAnimationPlayer | null {
    return this.animPlayer;
  }

  async start(): Promise<void> {
    audioManager.playMusic('./audio/music/battle1.mp3', true);
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

    // Battle over — fade out music before transitioning
    audioManager.stopMusic(2000);
    const winner = this.engine.getWinner();
    this.ui.onBattleEnd?.(winner);
  }

  // ---- Player action collection ----

  private async collectPlayerActions(): Promise<TurnAction[]> {
    const availableActions = this.engine.getAvailableActions(0);
    const actions: TurnAction[] = [];
    let i = 0;

    while (i < availableActions.length) {
      const slotInfo = availableActions[i];
      const canGoBack = i > 0;
      const action = await this.waitForPlayerAction(slotInfo.slot, canGoBack);

      if (action === null) {
        // User pressed back — undo previous action
        actions.pop();
        i--;
      } else {
        actions.push(action);
        i++;
      }
    }

    return actions;
  }

  private waitForPlayerAction(slot: number, canGoBack: boolean = false): Promise<TurnAction | null> {
    return new Promise<TurnAction | null>(resolve => {
      const available = this.engine.getAvailableActions(0);
      const slotInfo = available.find(a => a.slot === slot);
      if (!slotInfo) {
        // Fallback: use first move
        resolve({ type: 'move', player: 0, slot, moveIndex: 0 });
        return;
      }

      this.hideAllPanels();
      this.ui.actionMenu.show(canGoBack);

      // Back -> undo previous slot's action
      this.ui.actionMenu.onBack = canGoBack ? () => {
        this.hideAllPanels();
        this.cleanupCallbacks();
        resolve(null);
      } : null;

      // Fight -> show move panel
      this.ui.actionMenu.onFight = () => {
        this.ui.actionMenu.hide();
        this.ui.movePanel.show(slotInfo.canMove);

        this.ui.movePanel.onMoveSelect = (moveIndex: number) => {
          this.ui.movePanel.hide();

          const format = this.engine.getState().config.format;
          const selectedMove = slotInfo.canMove.find(m => m.moveIndex === moveIndex);
          const moveTarget = selectedMove?.moveTarget as MoveTarget | undefined;

          // Check if this move needs manual target selection
          if (moveTarget && needsTargetSelection(moveTarget, format)) {
            this.showTargetSelection(slot, moveIndex, moveTarget, resolve);
          } else {
            this.cleanupCallbacks();
            resolve({ type: 'move', player: 0, slot, moveIndex });
          }
        };

        this.ui.movePanel.onBack = () => {
          this.ui.movePanel.hide();
          // Re-show action menu
          this.waitForPlayerAction(slot, canGoBack).then(resolve);
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
          this.waitForPlayerAction(slot, canGoBack).then(resolve);
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

    // Play move animation (before HP changes for visual sequencing)
    if (update.animation && this.animPlayer) {
      const { moveId, attacker, targets, isCharge } = update.animation;
      const def = isCharge
        ? getChargeAnimation(moveId)
        : getMoveAnimation(moveId);
      if (def) {
        await this.animPlayer.play(def, attacker, targets);
      }
    }

    // Hit flash on damage from moves
    if (update.hitFlash && this.spriteAnimator) {
      const { player, slot } = update.hitFlash;
      this.spriteAnimator.flash({ player, slot });
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

    // Substitute choreography (slide out → swap sprite → slide in)
    if (update.substituteAnim && this.animPlayer && this.spriteAnimator) {
      const { action, target } = update.substituteAnim;
      const side = target.player === 0 ? 'player' : 'opponent';
      const sprite = this.ui.sprites[side][target.slot];

      if (action === 'create' && sprite) {
        // Pokemon is already off-screen (from the move animation's slide-out).
        // Swap to substitute sprite, then slide substitute in.
        sprite.showSubstitute();
        await this.spriteAnimator.slideIn(target, 350);
      } else if (action === 'break' && sprite) {
        // Slide substitute off-screen, swap back to real pokemon, slide in.
        await this.spriteAnimator.slideOut(target, 300);
        sprite.hideSubstitute();
        await this.spriteAnimator.slideIn(target, 300);
      }
    }

    // Switch / Faint animations
    if (update.switchAnim) {
      const { action, player, slot, speciesId } = update.switchAnim;
      const side = player === 0 ? 'player' : 'opponent';
      const sprite = this.ui.sprites[side][slot];

      if (action === 'switch-in' && sprite) {
        // 1. Hide sprite, then set image (so it doesn't flash before pokeball throw)
        sprite.setVisible(false);
        if (speciesId) sprite.updateSprite(speciesId, player === 0 ? 'back' : 'front');
        // 2. Pokeball throw on canvas (~500ms)
        if (this.animPlayer) await this.animPlayer.playPokeballThrow(player, slot, 500);
        // 3. Sprite appears: scale up + color fade (~700ms)
        if (this.spriteAnimator) {
          await this.spriteAnimator.switchInAppear({ player, slot }, 700);
        } else {
          sprite.setVisible(true);
        }
      }

      if (action === 'switch-out' && sprite) {
        // Skip animation if sprite is already hidden (e.g. after faint)
        const alreadyHidden = sprite.el.style.visibility === 'hidden';
        if (!alreadyHidden) {
          // 1. Sprite shrinks + whiteout (~300ms)
          if (this.spriteAnimator) {
            await this.spriteAnimator.switchOutShrink({ player, slot }, 300);
          }
          // 2. Pokeball recall on canvas (~400ms)
          if (this.animPlayer) await this.animPlayer.playPokeballRecall(player, slot, 400);
        }
        // 3. Ensure hidden
        sprite.setVisible(false);
      }

      if (action === 'faint') {
        // 1. Darken + fall (~1000ms)
        if (this.spriteAnimator && sprite) {
          await this.spriteAnimator.faintFall({ player, slot }, 1000);
        }
        if (sprite) sprite.setVisible(false);
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

    // Weather/Terrain persistent effects
    if (update.weatherEffect && this.animPlayer) {
      if (update.weatherEffect.action === 'start') {
        await this.animPlayer.startWeather(update.weatherEffect.weather);
        this.ui.fieldStatusChip?.setWeather(update.weatherEffect.weather);
      } else {
        this.animPlayer.stopWeather();
        this.ui.fieldStatusChip?.setWeather(null);
      }
    }
    if (update.terrainEffect && this.animPlayer) {
      if (update.terrainEffect.action === 'start') {
        await this.animPlayer.startTerrain(update.terrainEffect.terrain);
        this.ui.fieldStatusChip?.setTerrain(update.terrainEffect.terrain);
      } else {
        this.animPlayer.stopTerrain();
        this.ui.fieldStatusChip?.setTerrain(null);
      }
    }

    // Audio
    if (update.playCry) {
      await audioManager.playCry(update.playCry);
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
    this.ui.targetPanel.hide();
  }

  private cleanupCallbacks(): void {
    this.ui.actionMenu.onFight = null;
    this.ui.actionMenu.onPokemon = null;
    this.ui.actionMenu.onBag = null;
    this.ui.actionMenu.onRun = null;
    this.ui.actionMenu.onBack = null;
    this.ui.movePanel.onMoveSelect = null;
    this.ui.movePanel.onBack = null;
    this.ui.switchPanel.onSwitch = null;
    this.ui.switchPanel.onBack = null;
    this.ui.targetPanel.onTargetSelect = null;
    this.ui.targetPanel.onBack = null;
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

  private showTargetSelection(
    slot: number,
    moveIndex: number,
    moveTarget: MoveTarget,
    resolve: (action: TurnAction | null) => void,
  ): void {
    const state = this.engine.getState();
    const playerState = state.players[0];
    const opponentState = state.players[1];
    const validTargets = getValidMoveTargets(slot, moveIndex, playerState, opponentState, state.config.format);

    const targetOptions: TargetOption[] = validTargets.map(t => {
      const side = state.players[t.player];
      const idx = side.activePokemon[t.slot];
      const mon = side.team[idx];
      return {
        position: { player: t.player, slot: t.slot },
        pokemonName: mon.config.nickname ?? mon.species.name,
        speciesId: mon.species.id,
        currentHp: mon.currentHp,
        maxHp: mon.maxHp,
        isAlly: t.player === 0,
      };
    });

    // If only one valid target, auto-select it
    if (targetOptions.length <= 1) {
      this.cleanupCallbacks();
      const action: TurnAction = { type: 'move', player: 0, slot, moveIndex };
      if (targetOptions.length === 1) {
        action.targetPosition = targetOptions[0].position;
      }
      resolve(action);
      return;
    }

    this.ui.targetPanel.show(targetOptions);

    this.ui.targetPanel.onTargetSelect = (position: BattlePosition) => {
      this.ui.targetPanel.hide();
      this.cleanupCallbacks();
      resolve({ type: 'move', player: 0, slot, moveIndex, targetPosition: position });
    };

    this.ui.targetPanel.onBack = () => {
      this.ui.targetPanel.hide();
      // Go back to move selection
      this.waitForPlayerAction(slot).then(resolve);
    };
  }

  // ---- Public accessors for the engine (useful for external code) ----

  getEngine(): BattleEngine {
    return this.engine;
  }
}
