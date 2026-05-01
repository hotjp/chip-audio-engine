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
