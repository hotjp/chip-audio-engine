import type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
  ADSRConfig,
} from './types.js';
import type { SoundProvider, SoundInstance } from './SoundProvider.js';

function toSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * 采样提供者，通过 AudioBuffer 播放预加载的采样音频。
 *
 * @example
 * ```ts
 * const provider = new SampleProvider(audioContext);
 * provider.registerUrl('explosion', '/sfx/explosion.wav');
 * await provider.preload(['explosion']);
 * engine.registerProvider(provider);
 * ```
 */
export class SampleProvider implements SoundProvider {
  /** 提供者标识 */
  readonly id = 'sample';
  /** 提供者能力 */
  readonly capabilities: SoundProviderCapabilities = {
    supportedTypes: ['sample'],
    maxPolyphony: Infinity,
    realtimeParams: false,
  };

  private ctx: BaseAudioContext | null;
  private bufferCache = new Map<string, AudioBuffer>();
  private urlRegistry = new Map<string, string>();

  /**
   * @param ctx - 可选的音频上下文（用于预加载解码）
   * @example
   * ```ts
   * const provider = new SampleProvider(audioContext);
   * ```
   */
  constructor(ctx?: BaseAudioContext) {
    this.ctx = ctx ?? null;
  }

  /**
   * 为指定 soundId 注册 URL。供 preload 使用。
   * @param soundId - 音效标识符
   * @param url - 音频资源 URL
   * @example
   * ```ts
   * provider.registerUrl('explosion', '/sfx/explosion.wav');
   * ```
   */
  registerUrl(soundId: string, url: string): void {
    this.urlRegistry.set(soundId, url);
  }

  /**
   * 为指定 soundId 注册已解码的 AudioBuffer。
   * @param soundId - 音效标识符
   * @param buffer - 已解码的音频缓冲区
   * @example
   * ```ts
   * provider.registerBuffer('explosion', audioBuffer);
   * ```
   */
  registerBuffer(soundId: string, buffer: AudioBuffer): void {
    this.bufferCache.set(soundId, buffer);
  }

  /**
   * 创建采样声音实例。
   * @param ctx - 音频上下文
   * @param soundId - 音效标识符
   * @param params - 声音参数
   * @returns 采样声音实例
   * @example
   * ```ts
   * const sound = provider.createSound(ctx, 'explosion', params);
   * ```
   */
  createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance {
    const buffer = params.buffer ?? this.bufferCache.get(soundId) ?? null;
    const url = params.url ?? this.urlRegistry.get(soundId) ?? null;
    return new SampleSound(ctx, soundId, params, buffer, url, this);
  }

  /**
   * 预加载指定音效。
   * @param soundIds - 要预加载的音效 ID 数组
   * @returns 预加载完成的 Promise
   * @example
   * ```ts
   * await provider.preload(['explosion', 'ui.click']);
   * ```
   */
  async preload(soundIds: string[]): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(
      soundIds.map(async (id) => {
        if (this.bufferCache.has(id)) return;
        const url = this.urlRegistry.get(id);
        if (!url) return;
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
          this.bufferCache.set(id, audioBuffer);
        } catch {
          // Silently ignore failures so one bad URL doesn't block others
        }
      })
    );
  }

  /** @internal */
  _cacheBuffer(soundId: string, buffer: AudioBuffer): void {
    this.bufferCache.set(soundId, buffer);
  }
}

/**
 * 采样声音实例，管理 AudioBufferSourceNode 的播放与释放。
 *
 * @example
 * ```ts
 * const sound = new SampleSound(ctx, 'explosion', params, buffer, null, provider);
 * sound.connect(bus.input);
 * sound.start(ctx.currentTime, {});
 * ```
 */
export class SampleSound implements SoundInstance {
  private ctx: BaseAudioContext;
  private soundId: string;
  private params: SoundParams;
  private masterGain: GainNode;
  private filterNode?: BiquadFilterNode;
  private activeSource?: AudioBufferSourceNode;
  private connected = false;
  private started = false;
  private currentGain = 0;
  private disposed = false;
  private buffer: AudioBuffer | null;
  private url: string | null;
  private provider: SampleProvider;
  private loadPromise: Promise<void> | null = null;

  /**
   * @param ctx - 音频上下文
   * @param soundId - 音效标识符
   * @param params - 声音参数
   * @param buffer - 已解码的音频缓冲区（可选）
   * @param url - 音频资源 URL（可选）
   * @param provider - 所属 SampleProvider
   */
  constructor(
    ctx: BaseAudioContext,
    soundId: string,
    params: SoundParams,
    buffer: AudioBuffer | null,
    url: string | null,
    provider: SampleProvider
  ) {
    this.ctx = ctx;
    this.soundId = soundId;
    this.params = params;
    this.buffer = buffer;
    this.url = url;
    this.provider = provider;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.currentGain = 0;

    if (params.filter) {
      const f = ctx.createBiquadFilter();
      f.type = params.filter.type;
      f.frequency.value = params.filter.frequency;
      if (params.filter.Q !== undefined) {
        f.Q.value = params.filter.Q;
      }
      if (params.filter.gain !== undefined) {
        f.gain.value = params.filter.gain;
      }
      this.filterNode = f;
      this.filterNode.connect(this.masterGain);
    }

    if (!buffer && url) {
      this.loadPromise = this.loadFromUrl(url);
    }
  }

  private async loadFromUrl(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      if (!this.disposed) {
        this.buffer = audioBuffer;
        this.provider._cacheBuffer(this.soundId, audioBuffer);
      }
    } catch {
      // ignore
    }
  }

  /**
   * 连接到目标音频节点。
   * @param node - 目标音频节点
   * @example
   * ```ts
   * sound.connect(bus.input);
   * ```
   */
  connect(node: AudioNode): void {
    if (this.connected || this.disposed) return;
    this.connected = true;
    this.masterGain.connect(node);
  }

  /**
   * 在指定时间开始播放。
   * @param when - 开始时间（音频上下文时间）
   * @param playParams - 实时播放参数覆盖
   * @example
   * ```ts
   * sound.start(ctx.currentTime, { volume: 0.8, pitch: 1.2 });
   * ```
   */
  start(when: number, playParams: PlayParams): void {
    if (this.started || this.disposed) return;

    if (this.buffer) {
      this.doStart(when, playParams);
    } else if (this.loadPromise) {
      this.loadPromise.then(() => {
        if (!this.disposed && !this.started && this.buffer) {
          const now = this.ctx.currentTime;
          if (when >= now) {
            this.doStart(when, playParams);
          }
        }
      });
    }
  }

  private doStart(when: number, playParams: PlayParams): void {
    if (this.started || this.disposed || !this.buffer) return;
    this.started = true;

    const delay = Number.isFinite(playParams.delay) ? (playParams.delay ?? 0) : 0;
    const t0 = when + delay;
    const volume = Number.isFinite(playParams.volume)
      ? (playParams.volume ?? this.params.volume ?? 1)
      : (this.params.volume ?? 1);
    const pitchMul = Number.isFinite(playParams.pitch) ? (playParams.pitch ?? 1) : 1;
    const envelope = this.params.envelope;

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.setValueAtTime(pitchMul, t0);

    if (this.filterNode) {
      source.connect(this.filterNode);
    } else {
      source.connect(this.masterGain);
    }

    this.activeSource = source;

    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(t0);
    gain.setValueAtTime(0, t0);
    this.currentGain = 0;

    if (envelope) {
      const attack = toSeconds(envelope.attack);
      const decay = toSeconds(envelope.decay);
      const peak = volume;
      const sustain = envelope.sustain * volume;

      gain.linearRampToValueAtTime(peak, t0 + attack);
      gain.linearRampToValueAtTime(sustain, t0 + attack + decay);
      this.currentGain = sustain;
    } else {
      gain.linearRampToValueAtTime(volume, t0);
      this.currentGain = volume;
    }

    source.start(t0);
  }

  /**
   * 在指定时间停止播放并进入释放阶段。
   * @param when - 停止时间（音频上下文时间）
   * @example
   * ```ts
   * sound.stop(ctx.currentTime + 0.5);
   * ```
   */
  stop(when: number): void {
    if (this.disposed) return;
    const releaseMs = this.params.envelope?.release ?? 100;
    const now = this.ctx.currentTime;
    const releaseStart = Math.max(when, now);
    const releaseEnd = releaseStart + toSeconds(releaseMs);

    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentGain, releaseStart);
    gain.linearRampToValueAtTime(0, releaseEnd);
    this.currentGain = 0;

    if (this.activeSource) {
      try {
        this.activeSource.stop(releaseEnd);
      } catch {
        // May not have been started
      }
    }
  }

  /**
   * 释放所有内部节点资源。
   * @example
   * ```ts
   * sound.dispose();
   * ```
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // ignore
      }
      this.activeSource.disconnect();
      this.activeSource = undefined;
    }

    if (this.filterNode) {
      this.filterNode.disconnect();
    }

    this.masterGain.disconnect();
  }
}
