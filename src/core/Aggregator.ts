export const AggregationStrategies = ['restart', 'arpeggio', 'stack', 'debounce'] as const;
export type AggregationStrategy = (typeof AggregationStrategies)[number];

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

export class Aggregator {
  private configs: Map<string, AggregationConfig> = new Map();
  private defaultConfig: AggregationConfig = { strategy: 'restart' };
  private states: Map<string, SoundState> = new Map();

  /** Configure aggregation strategy for a specific sound. */
  setConfig(soundId: string, config: AggregationConfig): void {
    this.configs.set(soundId, config);
  }

  /** Set the fallback aggregation strategy for unconfigured sounds. */
  setDefaultConfig(config: AggregationConfig): void {
    this.defaultConfig = config;
  }

  /** Remove all per-sound aggregation configs (default is preserved). */
  removeAllConfigs(): void {
    this.configs.clear();
  }

  /**
   * Submit a play request for aggregation.
   * @returns true if the request should proceed to playback
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

  /** Clear all active aggregation states and pending timers. */
  reset(): void {
    for (const state of this.states.values()) {
      if (state.timerId) {
        clearTimeout(state.timerId);
      }
    }
    this.states.clear();
  }
}
