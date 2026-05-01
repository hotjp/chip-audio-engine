export type AggregationStrategy = 'restart' | 'arpeggio' | 'stack' | 'debounce';

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

  setConfig(soundId: string, config: AggregationConfig): void {
    this.configs.set(soundId, config);
  }

  setDefaultConfig(config: AggregationConfig): void {
    this.defaultConfig = config;
  }

  removeAllConfigs(): void {
    this.configs.clear();
  }

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

      default:
        return true;
    }
  }

  private expireState(soundId: string): void {
    this.states.delete(soundId);
  }

  reset(): void {
    for (const state of this.states.values()) {
      if (state.timerId) {
        clearTimeout(state.timerId);
      }
    }
    this.states.clear();
  }
}
