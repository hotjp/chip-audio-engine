export type EventMap = Record<string, any>;

/**
 * 类型安全的事件发射器基类。
 *
 * @example
 * ```ts
 * interface MyEvents {
 *   tick: { time: number };
 *   stop: void;
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('tick', ({ time }) => console.log(time));
 * emitter.emit('tick', { time: Date.now() });
 * ```
 */
export class EventEmitter<Events extends EventMap = EventMap> {
  private handlers: Map<keyof Events, Set<(payload: any) => void>> = new Map();

  /**
   * 注册事件处理器。
   * @param event - 事件名称
   * @param handler - 事件处理器函数
   * @returns 取消订阅函数
   * @example
   * ```ts
   * const off = emitter.on('tick', ({ time }) => console.log(time));
   * off(); // unsubscribe
   * ```
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

  /**
   * 移除事件处理器。
   * @param event - 事件名称
   * @param handler - 要移除的处理器函数
   * @example
   * ```ts
   * const handler = ({ time }: { time: number }) => console.log(time);
   * emitter.on('tick', handler);
   * emitter.off('tick', handler);
   * ```
   */
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
   * 注册一次性事件处理器。
   * @param event - 事件名称
   * @param handler - 事件处理器函数
   * @returns 取消订阅函数
   * @example
   * ```ts
   * emitter.once('tick', ({ time }) => console.log('first tick:', time));
   * ```
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
   * 发射事件到所有已注册的处理器。
   * 单个处理器中的错误会被隔离，不会影响后续监听器。
   * @param event - 事件名称
   * @param payload - 事件载荷
   * @example
   * ```ts
   * emitter.emit('tick', { time: Date.now() });
   * ```
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
