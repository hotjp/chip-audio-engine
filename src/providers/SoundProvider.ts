import type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
} from './types.js';

/**
 * 音源提供者接口 — 引擎通过此接口获取声音，不关心实现。
 *
 * @example
 * ```ts
 * const provider: SoundProvider = {
 *   id: 'custom',
 *   capabilities: { supportedTypes: ['synth'], maxPolyphony: 4, realtimeParams: true },
 *   createSound: (ctx, soundId, params) => new MySound(ctx, params),
 * };
 * ```
 */
export interface SoundProvider {
  /** 提供者唯一标识 */
  readonly id: string;
  /** 提供者能力描述 */
  readonly capabilities: SoundProviderCapabilities;
  /**
   * 创建声音实例。
   * @param ctx - 音频上下文
   * @param soundId - 音效标识符
   * @param params - 声音参数
   * @returns 声音实例
   * @example
   * ```ts
   * const instance = provider.createSound(ctx, 'ui.click', params);
   * ```
   */
  createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance;
  /**
   * 预加载指定音效（可选）。
   * @param soundIds - 要预加载的音效 ID 数组
   * @returns 预加载完成的 Promise
   * @example
   * ```ts
   * await provider.preload(['ui.click', 'game.jump']);
   * ```
   */
  preload?(soundIds: string[]): Promise<void>;
}

/**
 * 声音实例接口，控制单个声音的连接、播放和释放。
 *
 * @example
 * ```ts
 * const sound = provider.createSound(ctx, 'ui.click', params);
 * sound.connect(bus.input);
 * sound.start(ctx.currentTime, {});
 * sound.stop(ctx.currentTime + 1);
 * sound.dispose();
 * ```
 */
export interface SoundInstance {
  /**
   * 连接到目标音频节点。
   * @param node - 目标音频节点
   * @example
   * ```ts
   * sound.connect(bus.input);
   * ```
   */
  connect(node: AudioNode): void;
  /**
   * 在指定时间开始播放。
   * @param when - 开始时间（音频上下文时间）
   * @param params - 实时播放参数
   * @example
   * ```ts
   * sound.start(ctx.currentTime + 0.1, { volume: 0.8 });
   * ```
   */
  start(when: number, params: PlayParams): void;
  /**
   * 在指定时间停止播放。
   * @param when - 停止时间（音频上下文时间）
   * @example
   * ```ts
   * sound.stop(ctx.currentTime + 0.5);
   * ```
   */
  stop(when: number): void;
  /**
   * 释放内部资源。
   * @example
   * ```ts
   * sound.dispose();
   * ```
   */
  dispose(): void;
}

export type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
} from './types.js';
