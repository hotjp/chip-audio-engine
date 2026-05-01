export type EventMap = Record<string, any>;

export class EventEmitter<Events extends EventMap = EventMap> {
  private handlers: Map<keyof Events, Set<(payload: any) => void>> = new Map();

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

  off<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): void {
    this.handlers.get(event)?.delete(handler);
  }

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
