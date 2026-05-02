import type { FilterConfig } from '../providers/types.js';
import type { FocusConfig, FocusMode } from '../core/FocusManager.js';

/**
 * 引擎事件映射表。所有事件均通过 {@link ChipAudioEngine} 的 `on` 方法监听。
 *
 * @example
 * ```ts
 * const engine = new ChipAudioEngine();
 * engine.on('engine:init', ({ audioContext }) => {
 *   console.log('AudioContext state:', audioContext.state);
 * });
 * ```
 */
export interface EngineEvents {
  /** 单个音效开始播放 */
  play: { soundId: string; channelId: number };
  /** 单个音效停止播放 */
  stop: { soundId: string; reason: "completed" | "manual" | "stolen" };
  /** Bus 音量变化 */
  "bus:volume": { busId: string; volume: number };
  /** Bus 静音状态变化 */
  "bus:mute": { busId: string; muted: boolean };
  /** 播放过程中发生错误 */
  error: { soundId?: string; error: Error };
  /** 引擎初始化完成 */
  "engine:init": { audioContext: AudioContext };
  /** 引擎销毁 */
  "engine:destroy": Record<string, never>;
  /** 引擎暂停 */
  "engine:suspend": Record<string, never>;
  /** 引擎恢复 */
  "engine:resume": Record<string, never>;
  /** 子 Bus 被添加 */
  "bus:add": { parentId: string; busId: string };
  /** Provider 注册 */
  "provider:register": { providerId: string };
  /** SoundPack 加载 */
  "pack:load": { packName: string; soundCount: number };
  /** BGM 开始播放 */
  "bgm:start": { scoreId: string };
  /** BGM 停止播放 */
  "bgm:stop": { scoreId: string };
  /** 焦点模式切换（预留） */
  "focus:change": { mode: FocusMode; config: FocusConfig };
}

export interface BGMNote {
  freq: number | null;
  duration: number;
  gain?: number;
}

export interface BGMTrack {
  waveform: OscillatorType | "noise";
  notes: BGMNote[];
  detune?: number;
  filter?: FilterConfig;
  volume?: number;
  loopStart?: number;
}

export interface BGMScore {
  id: string;
  name: string;
  bpm: number;
  tracks: BGMTrack[];
}

// === 新增 Score 类型 ===

/** 时值记号 */
export type DurationSymbol =
  | 'w' | 'h' | 'q' | 'e' | 's' | 't'
  | 'w.' | 'h.' | 'q.' | 'e.' | 's.';

/** 时值：符号或毫秒数 */
export type DurationValue = DurationSymbol | number;

/** 演奏表情配置 */
export interface PerformanceExpr {
  /** Swing 比例 (0-1) */
  swing?: number;
  /** Humanize 强度 (0-1) */
  humanize?: number;
  /** 全局 layback (ms) */
  layback?: number;
  /** 力度曲线：[位置, 力度倍率] 控制点 */
  velocityCurve?: [number, number][];
}

/** Score 音符 */
export interface ScoreNote {
  note: string | null;  // 音名或休止符
  duration: DurationValue;
  velocity?: number;
  offset?: number;  // 时间偏移 ms（layback 等）
}

/** Score 轨道 */
export interface ScoreTrack {
  timbre: string;  // 引用 Timbre Pack 中的音色名
  volume?: number;
  mute?: boolean;
  loopStart?: number;
  transpose?: number;
  performance?: PerformanceExpr;
  notes: ScoreNote[];
}

/** Score 全局配置 */
export interface ScoreConfig {
  loop?: boolean;
  volume?: number;
  reverb?: string;
}

/** 完整乐谱 */
export interface Score {
  id: string;
  name: string;
  bpm: number;
  timbrePack: string;
  config?: ScoreConfig;
  tracks: ScoreTrack[];
}
