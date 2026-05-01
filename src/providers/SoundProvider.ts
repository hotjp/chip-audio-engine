import type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
} from './types.js';

/** 音源提供者接口 — 引擎通过此接口获取声音，不关心实现 */
export interface SoundProvider {
  readonly id: string;
  readonly capabilities: SoundProviderCapabilities;
  createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance;
  preload?(soundIds: string[]): Promise<void>;
}

/** 声音实例接口 */
export interface SoundInstance {
  connect(node: AudioNode): void;
  start(when: number, params: PlayParams): void;
  stop(when: number): void;
  dispose(): void;
}

export type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
} from './types.js';
