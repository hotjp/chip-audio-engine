export const AggregationStrategies = ['restart', 'arpeggio', 'stack', 'debounce'] as const;
export type AggregationStrategy = (typeof AggregationStrategies)[number];

/**
 * 聚合策略配置。
 * @example
 * ```ts
 * const config: AggregationConfig = { strategy: 'debounce', windowMs: 150 };
 * ```
 */
export interface AggregationConfig {
  strategy: AggregationStrategy;
  windowMs?: number;
  maxQueueDepth?: number;
}

interface SoundState {
  lastSubmitTime: number;
  count: number;
  timerId?: ReturnType<typeof setTimeout>;
  priority?: number;
}

/**
 * 聚合器用于控制同一音效的重复提交行为，避免声音爆炸。
 *
 * @example
 * ```ts
 * const aggregator = new Aggregator();
 * aggregator.setDefaultConfig({ strategy: 'debounce', windowMs: 200 });
 * if (aggregator.submit('ui.click', 0)) {
 *   engine.play('ui.click');
 * }
 * ```
 */
export class Aggregator {
  private configs: Map<string, AggregationConfig> = new Map();
  private defaultConfig: AggregationConfig = { strategy: 'restart' };
  private states: Map<string, SoundState> = new Map();

  /**
   * 为指定音效配置聚合策略。
   * @param soundId - 音效标识符
   * @param config - 聚合配置
   * @example
   * ```ts
   * aggregator.setConfig('game.jump', { strategy: 'stack', windowMs: 100, maxQueueDepth: 3 });
   * ```
   */
  setConfig(soundId: string, config: AggregationConfig): void {
    this.configs.set(soundId, config);
  }

  /**
   * 设置默认聚合策略（用于未单独配置的声音）。
   * @param config - 聚合配置
   * @example
   * ```ts
   * aggregator.setDefaultConfig({ strategy: 'restart' });
   * ```
   */
  setDefaultConfig(config: AggregationConfig): void {
    this.defaultConfig = config;
  }

  /**
   * 移除所有音效的单独聚合配置（保留默认配置）。
   * @example
   * ```ts
   * aggregator.removeAllConfigs();
   * ```
   */
  removeAllConfigs(): void {
    this.configs.clear();
  }

  /**
   * 提交一次播放请求，由聚合器决定是否允许播放。
   * @param soundId - 音效标识符
   * @param priority - 优先级
   * @returns 如果请求应继续播放则返回 true
   * @example
   * ```ts
   * if (aggregator.submit('ui.click', 0)) {
   *   engine.play('ui.click');
   * }
   * ```
   */
  submit(soundId: string, priority: number): boolean {
    const config = this.configs.get(soundId) ?? this.defaultConfig;
    const now = Date.now();
    const state = this.states.get(soundId);

    switch (config.strategy) {
      case 'restart': {
        this.states.set(soundId, { lastSubmitTime: now, count: 1, priority });
        return true;
      }

      case 'arpeggio': {
        const windowMs = config.windowMs ?? 200;
        if (state && now - state.lastSubmitTime < windowMs) {
          state.lastSubmitTime = now;
          state.count++;
          return false;
        }
        this.states.set(soundId, { lastSubmitTime: now, count: 1, priority });
        return true;
      }

      case 'stack': {
        const windowMs = config.windowMs ?? 100;
        const maxDepth = config.maxQueueDepth ?? 3;
        if (state && now - state.lastSubmitTime < windowMs) {
          if (state.count >= maxDepth) {
            return false;
          }
          state.lastSubmitTime = now;
          state.count++;
          return true;
        }
        this.states.set(soundId, { lastSubmitTime: now, count: 1, priority });
        return true;
      }

      case 'debounce': {
        const windowMs = config.windowMs ?? 150;
        if (state) {
          if (state.timerId) {
            clearTimeout(state.timerId);
          }
          state.timerId = setTimeout(() => this.expireState(soundId), windowMs);
          return false;
        }
        const newState: SoundState = {
          lastSubmitTime: now,
          count: 1,
          timerId: setTimeout(() => this.expireState(soundId), windowMs),
        };
        this.states.set(soundId, newState);
        return true;
      }

      default: {
        const _exhaustive: never = config.strategy;
        return _exhaustive;
      }
    }
  }

  private expireState(soundId: string): void {
    this.states.delete(soundId);
  }

  /**
   * 清除所有活跃的聚合状态和待处理定时器。
   * @example
   * ```ts
   * aggregator.reset();
   * ```
   */
  reset(): void {
    for (const state of this.states.values()) {
      if (state.timerId) {
        clearTimeout(state.timerId);
      }
    }
    this.states.clear();
  }
}
