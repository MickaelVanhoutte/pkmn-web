import type { CanvasPoint, BattlePosition, AnimTarget } from './types';

export class PositionResolver {
  private arena: HTMLElement;
  private spriteSlots: Map<string, HTMLElement> = new Map();

  constructor(arena: HTMLElement) {
    this.arena = arena;
  }

  registerSlot(player: number, slot: number, el: HTMLElement): void {
    this.spriteSlots.set(`${player}-${slot}`, el);
  }

  /** Get the center point of a sprite slot in arena-relative coordinates */
  getSlotCenter(player: number, slot: number): CanvasPoint {
    const el = this.spriteSlots.get(`${player}-${slot}`);
    if (!el) {
      // Fallback positions
      if (player === 0) return { x: this.arena.clientWidth * 0.25, y: this.arena.clientHeight * 0.75 };
      return { x: this.arena.clientWidth * 0.75, y: this.arena.clientHeight * 0.35 };
    }

    const arenaRect = this.arena.getBoundingClientRect();
    const slotRect = el.getBoundingClientRect();

    return {
      x: slotRect.left + slotRect.width / 2 - arenaRect.left,
      y: slotRect.top + slotRect.height / 2 - arenaRect.top,
    };
  }

  /** Resolve a named target into actual canvas coordinates */
  resolve(
    target: AnimTarget,
    attacker: BattlePosition,
    defender: BattlePosition,
  ): CanvasPoint {
    switch (target) {
      case 'attacker':
        return this.getSlotCenter(attacker.player, attacker.slot);
      case 'defender':
        return this.getSlotCenter(defender.player, defender.slot);
      case 'center':
        return {
          x: this.arena.clientWidth / 2,
          y: this.arena.clientHeight / 2,
        };
      case 'screen':
        return {
          x: this.arena.clientWidth / 2,
          y: this.arena.clientHeight / 2,
        };
    }
  }

  getArenaSize(): { width: number; height: number } {
    return {
      width: this.arena.clientWidth,
      height: this.arena.clientHeight,
    };
  }
}
