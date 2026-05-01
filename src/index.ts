export type {
  SoundProvider,
  SoundInstance,
} from './providers/SoundProvider.js';

export type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
  WaveformConfig,
  ADSRConfig,
  FilterConfig,
  PitchCurve,
} from './providers/types.js';

export { OscillatorProvider, OscillatorSound } from './providers/OscillatorProvider.js';

export { AudioBus, IAudioBus } from './core/AudioBus.js';
export { ChannelPool } from './core/ChannelPool.js';
export { Aggregator, AggregationConfig } from './core/Aggregator.js';
export { DuckManager, DuckRule } from './core/DuckManager.js';

export { SoundPackLoader, SoundPack, SoundPackEntry } from './config/SoundPackLoader.js';

export { ChipAudioEngine, EngineConfig } from './engine/ChipAudioEngine.js';
