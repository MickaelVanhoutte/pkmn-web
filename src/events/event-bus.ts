import type { BattleEvent } from '../types';

type EventHandler = (event: BattleEvent) => void;
type SpecificHandler<K extends BattleEvent['kind']> = (
  event: Extract<BattleEvent, { kind: K }>,
) => void;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private globalHandlers: EventHandler[] = [];
  private log: BattleEvent[] = [];

  on<K extends BattleEvent['kind']>(kind: K, handler: SpecificHandler<K>): () => void {
    const existing = this.handlers.get(kind) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(kind, existing);

    return () => {
      const arr = this.handlers.get(kind);
      if (arr) {
        const idx = arr.indexOf(handler as EventHandler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  onAny(handler: EventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx >= 0) this.globalHandlers.splice(idx, 1);
    };
  }

  emit(event: BattleEvent): void {
    this.log.push(event);

    const specific = this.handlers.get(event.kind);
    if (specific) {
      for (const handler of specific) {
        handler(event);
      }
    }

    for (const handler of this.globalHandlers) {
      handler(event);
    }
  }

  getLog(): BattleEvent[] {
    return [...this.log];
  }

  clearLog(): void {
    this.log = [];
  }
}
