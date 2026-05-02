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

export { ReverbEngine } from './effects/ReverbEngine.js';
export type { ReverbPreset, ReverbParams } from './effects/ReverbEngine.js';

export { DistanceFilter } from './effects/DistanceFilter.js';
export type { DistanceFilterConfig } from './effects/DistanceFilter.js';

export { SpatialAudio } from './effects/SpatialAudio.js';
export type { Viewport as SpatialViewport } from './effects/SpatialAudio.js';

export { OscillatorProvider, OscillatorSound } from './providers/OscillatorProvider.js';
export { SampleProvider, SampleSound } from './providers/SampleProvider.js';

export { AudioBus, IAudioBus } from './core/AudioBus.js';
export { ChannelPool } from './core/ChannelPool.js';
export { Aggregator, AggregationConfig } from './core/Aggregator.js';
export { DuckManager, DuckRule } from './core/DuckManager.js';
export { EventEmitter } from './core/EventEmitter.js';
export type { EventMap } from './core/EventEmitter.js';
export { FocusManager } from './core/FocusManager.js';
export type { FocusMode, FocusConfig } from './core/FocusManager.js';

export { SoundPackLoader, SoundPack, SoundPackEntry } from './config/SoundPackLoader.js';

export { ChipAudioEngine, EngineConfig } from './engine/ChipAudioEngine.js';
export { BGMEngine } from './engine/BGMEngine.js';
export type { EngineEvents, BGMScore, BGMTrack, BGMNote } from './engine/types.js';

export { TimbrePackLoader } from './config/TimbrePackLoader.js';
export type { TimbreDefinition, TimbrePack } from './config/TimbrePackLoader.js';
export type {
  DurationSymbol,
  DurationValue,
  PerformanceExpr,
  ScoreNote,
  ScoreTrack,
  ScoreConfig,
  Score,
} from './engine/types.js';

export {
  MusicUtils,
  validateScore,
  type ValidationResult,
  type ValidationError,
} from './music/index.js';
