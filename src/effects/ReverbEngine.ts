/**
 * ReverbEngine — SFC 风格的短尾混响处理器
 *
 * 使用 ConvolverNode + 程序化生成 impulse response，模拟 16-bit 时代
 * 有限采样空间的温暖混响感。支持 preset 切换与全局 send bus 共享。
 */

/** 混响预设参数 */
export interface ReverbPreset {
  name: string;
  /** 衰减时间（毫秒） */
  decayTime: number;
  /** 湿信号混合比（0–1） */
  wetMix: number;
  /** 预延迟（毫秒） */
  preDelay: number;
  /** 高频阻尼（0–1），模拟空气吸收 */
  hfDamping: number;
}

/** 混响实时可调参数 */
export interface ReverbParams {
  decayTime?: number;
  wetMix?: number;
  preDelay?: number;
  hfDamping?: number;
}

/**
 * ReverbEngine 通过程序化 IR 提供轻量短尾混响。
 *
 * 内部节点链：
 * input → [preDelay] → convolver → wetGain → output
 *
 * 设计为全局 send bus：多个 SoundInstance 可通过 input 送入同一 ConvolverNode，
 * output 返回至 master bus 进行混音。
 *
 * @example
 * ```ts
 * const reverb = new ReverbEngine(ctx, 'hall');
 * musicBus.output.connect(reverb.input);
 * reverb.output.connect(masterBus.input);
 * ```
 */
export class ReverbEngine {
  /** Send 目标节点 */
  readonly input: GainNode;
  /** Wet 返回节点 */
  readonly output: GainNode;

  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private preDelayNode: DelayNode | null = null;
  private enabled = true;
  private ctx: BaseAudioContext;
  private currentPreset: ReverbPreset;

  private static readonly PRESETS: Map<string, ReverbPreset> = new Map([
    ['room', { name: 'room', decayTime: 150, wetMix: 0.2, preDelay: 10, hfDamping: 0.6 }],
    ['hall', { name: 'hall', decayTime: 400, wetMix: 0.3, preDelay: 25, hfDamping: 0.4 }],
    ['plate', { name: 'plate', decayTime: 250, wetMix: 0.25, preDelay: 15, hfDamping: 0.5 }],
  ]);

  /**
   * @param ctx - 音频上下文
   * @param presetName - 初始预设名称，默认为 'room'
   * @example
   * ```ts
   * const reverb = new ReverbEngine(audioContext, 'hall');
   * ```
   */
  constructor(ctx: BaseAudioContext, presetName = 'room') {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    const preset = ReverbEngine.PRESETS.get(presetName);
    this.currentPreset = preset ?? ReverbEngine.PRESETS.get('room')!;

    if (typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function') {
      this.convolver = ctx.createConvolver();
      this.wetGain = ctx.createGain();

      if (typeof ctx.createDelay === 'function') {
        this.preDelayNode = ctx.createDelay();
        this.preDelayNode.delayTime.value = this.currentPreset.preDelay / 1000;
      }

      this.buildImpulseResponse();
      this.connectNodes();
    } else {
      // 降级：直通
      this.input.connect(this.output);
    }
  }

  /** 程序化生成带高频衰减的指数衰减噪声 IR */
  private generateImpulseResponse(): AudioBuffer | null {
    const sampleRate = this.ctx.sampleRate;
    const durationSec = this.currentPreset.decayTime / 1000;
    const length = Math.floor(sampleRate * durationSec);
    if (length <= 0) return null;

    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const decay = this.currentPreset.decayTime;
    const hfDamping = this.currentPreset.hfDamping;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // 指数衰减包络
      const envelope = Math.exp((-3 * t) / (decay / 1000));
      // 高频阻尼模拟空气吸收
      const hfLoss = Math.exp(-hfDamping * t * 8);
      left[i] = (Math.random() * 2 - 1) * envelope * hfLoss;
      right[i] = (Math.random() * 2 - 1) * envelope * hfLoss;
    }
    return buffer;
  }

  private buildImpulseResponse(): void {
    if (!this.convolver) return;
    const ir = this.generateImpulseResponse();
    if (ir) {
      this.convolver.buffer = ir;
    }
  }

  private connectNodes(): void {
    if (!this.convolver || !this.wetGain) return;

    if (this.preDelayNode) {
      this.input.connect(this.preDelayNode);
      this.preDelayNode.connect(this.convolver);
    } else {
      this.input.connect(this.convolver);
    }

    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.wetGain.gain.value = this.enabled ? this.currentPreset.wetMix : 0;
  }

  /**
   * 切换混响预设（room / hall / plate）。
   * @param presetName - 预设名称
   * @example
   * ```ts
   * reverb.setPreset('hall');
   * ```
   */
  setPreset(presetName: string): void {
    const preset = ReverbEngine.PRESETS.get(presetName);
    if (!preset) return;
    this.currentPreset = preset;
    this.buildImpulseResponse();
    if (this.preDelayNode) {
      this.preDelayNode.delayTime.value = preset.preDelay / 1000;
    }
    if (this.enabled && this.wetGain) {
      this.wetGain.gain.value = preset.wetMix;
    }
  }

  /**
   * 微调当前混响参数并重新生成 IR。
   * @param params - 混响参数
   * @example
   * ```ts
   * reverb.setParams({ wetMix: 0.4, decayTime: 300 });
   * ```
   */
  setParams(params: ReverbParams): void {
    if (params.decayTime !== undefined) this.currentPreset.decayTime = params.decayTime;
    if (params.wetMix !== undefined) this.currentPreset.wetMix = params.wetMix;
    if (params.preDelay !== undefined) this.currentPreset.preDelay = params.preDelay;
    if (params.hfDamping !== undefined) this.currentPreset.hfDamping = params.hfDamping;

    this.buildImpulseResponse();
    if (this.preDelayNode) {
      this.preDelayNode.delayTime.value = this.currentPreset.preDelay / 1000;
    }
    if (this.enabled && this.wetGain) {
      this.wetGain.gain.value = this.currentPreset.wetMix;
    }
  }

  /**
   * 启用混响（恢复 wet gain）。
   * @example
   * ```ts
   * reverb.enable();
   * ```
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    if (this.wetGain) {
      this.wetGain.gain.value = this.currentPreset.wetMix;
    }
  }

  /**
   * 旁路混响（wet gain 置 0，不销毁节点）。
   * @example
   * ```ts
   * reverb.disable();
   * ```
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.wetGain) {
      this.wetGain.gain.value = 0;
    }
  }

  /**
   * 获取混响启用状态。
   * @returns 如果已启用则返回 true
   * @example
   * ```ts
   * const on = reverb.isEnabled;
   * ```
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 断开并清理内部节点。
   * @example
   * ```ts
   * reverb.dispose();
   * ```
   */
  dispose(): void {
    this.input.disconnect();
    this.output.disconnect();
    if (this.preDelayNode) {
      this.preDelayNode.disconnect();
    }
    if (this.convolver) {
      this.convolver.disconnect();
    }
    if (this.wetGain) {
      this.wetGain.disconnect();
    }
  }
}
