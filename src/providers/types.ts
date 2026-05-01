/** 波形配置 */
export interface WaveformConfig {
  type: OscillatorType;
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
  volume?: number;
  pitch?: number;
  delay?: number;
}

/** 音源提供者能力声明 */
export interface SoundProviderCapabilities {
  supportedTypes: ('synth' | 'sample' | 'stream')[];
  maxPolyphony: number;
  realtimeParams: boolean;
}
