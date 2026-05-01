export type EventMap = Record<string, any>;

export class EventEmitter<Events extends EventMap = EventMap> {
  private handlers: Map<keyof Events, Set<(payload: any) => void>> = new Map();

  /**
   * Register an event handler.
   * @returns an unsubscribe function
   */
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /** Remove an event handler. */
  off<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Register a one-time event handler.
   * @returns an unsubscribe function
   */
  once<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void {
    const wrapped = (payload: Events[K]) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  /**
   * Emit an event to all registered handlers.
   * Errors in individual handlers are isolated.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch {
        // Isolate handler errors to prevent interrupting subsequent listeners.
      }
    });
  }
}
