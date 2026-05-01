/**
 * DistanceFilter — 基于物理模型的距离滤音
 *
 * 距离越远 → 低通截止频率越低 + 高频自然衰减 + 音量对数衰减。
 * 用于在 64×64 像素风 RTS 中模拟声源远近感。
 */

/** DistanceFilter 配置 */
export interface DistanceFilterConfig {
  /** 参考截止频率（Hz），默认 16000 */
  referenceCutoff?: number;
  /** 参考距离，默认 1.0 */
  referenceDistance?: number;
  /** 距离滚降指数，默认 1.0 */
  rolloffFactor?: number;
  /** 音量滚降比例，默认 0.1 */
  rolloffScale?: number;
  /** 最小有效距离，默认 0 */
  minDistance?: number;
  /** 最大有效距离，默认 Infinity */
  maxDistance?: number;
}

/**
 * DistanceFilter 将欧几里得距离实时映射为：
 * - BiquadFilterNode 的 cutoffFrequency
 * - GainNode 的 gainAttenuation
 */
export class DistanceFilter {
  /** 输入节点 */
  readonly input: GainNode;
  /** 输出节点 */
  readonly output: GainNode;

  private filter: BiquadFilterNode | null = null;
  private gainNode: GainNode;
  private ctx: BaseAudioContext;
  private config: Required<DistanceFilterConfig>;
  private currentDistance = 0;

  constructor(ctx: BaseAudioContext, config: DistanceFilterConfig = {}) {
    this.ctx = ctx;
    this.config = {
      referenceCutoff: config.referenceCutoff ?? 16000,
      referenceDistance: config.referenceDistance ?? 1.0,
      rolloffFactor: config.rolloffFactor ?? 1.0,
      rolloffScale: config.rolloffScale ?? 0.1,
      minDistance: config.minDistance ?? 0,
      maxDistance: config.maxDistance ?? Infinity,
    };

    this.input = ctx.createGain();
    this.gainNode = ctx.createGain();
    this.output = ctx.createGain();

    if (typeof ctx.createBiquadFilter === 'function') {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = this.config.referenceCutoff;
      this.input.connect(this.filter);
      this.filter.connect(this.gainNode);
    } else {
      this.input.connect(this.gainNode);
    }

    this.gainNode.connect(this.output);
  }

  /**
   * 根据距离实时更新滤波器截止频率与增益衰减。
   *
   * cutoffFrequency = referenceCutoff * (referenceDistance / max(distance, referenceDistance)) ^ rolloffFactor
   * gainAttenuation = 1 / (1 + rolloffScale * distance)
   */
  update(distance: number): void {
    const clampedDistance = Math.max(
      this.config.minDistance,
      Math.min(distance, this.config.maxDistance)
    );
    this.currentDistance = clampedDistance;

    const { referenceCutoff, referenceDistance, rolloffFactor, rolloffScale } = this.config;

    const safeDist = Math.max(clampedDistance, referenceDistance);
    const cutoffRatio = Math.pow(referenceDistance / safeDist, rolloffFactor);
    const cutoffFrequency = referenceCutoff * cutoffRatio;

    const gainAttenuation = 1.0 / (1 + rolloffScale * clampedDistance);

    const now = this.ctx.currentTime;

    if (this.filter) {
      this.filter.frequency.setValueAtTime(cutoffFrequency, now);
    }
    this.gainNode.gain.setValueAtTime(gainAttenuation, now);
  }

  /** 当前距离 */
  get distance(): number {
    return this.currentDistance;
  }

  /** 断开所有节点 */
  dispose(): void {
    this.input.disconnect();
    if (this.filter) {
      this.filter.disconnect();
    }
    this.gainNode.disconnect();
    this.output.disconnect();
  }
}
