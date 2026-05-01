/** 波形配置 */
export interface WaveformConfig {
  type: OscillatorType | 'noise';
  frequency: number | [number, number];
  detune?: number;
  gain?: number;
}

/** ADSR 包络 */
export interface ADSRConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** 滤波器配置 */
export interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  Q?: number;
  gain?: number;
}

/** 音高变化曲线 */
export interface PitchCurve {
  start: number;
  end: number;
  curve?: 'linear' | 'exponential' | 'vibrato';
  vibrato?: { rate: number; depth: number };
}

/** 声音参数 — 创建声音实例时使用 */
export interface SoundParams {
  waveforms?: WaveformConfig[];
  envelope?: ADSRConfig;
  filter?: FilterConfig;
  volume?: number;
  duration?: number;
  pitch?: PitchCurve;
}

/** 播放参数 — 覆盖默认值 */
export interface PlayParams {
  readonly volume?: number;
  readonly pitch?: number;
  readonly delay?: number;
  /** 声源在 2D 世界中的坐标（配合 viewport 启用空间音频） */
  readonly position?: { x: number; y: number };
  /** 当前视口信息（配合 position 启用空间音频） */
  readonly viewport?: { centerX: number; centerY: number; width: number; height: number };
}

/** 音源提供者能力声明 */
export interface SoundProviderCapabilities {
  supportedTypes: ('synth' | 'sample' | 'stream')[];
  maxPolyphony: number;
  realtimeParams: boolean;
}
