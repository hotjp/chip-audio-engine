/**
 * SpatialAudio — 基于 2D 视口的空间音频定位
 *
 * 针对 64×64 像素风 RTS 设计：利用视口坐标计算 stereo pan 与
 * 距离滤音，并通过 send 增益控制全局混响 wet 比，越远越空旷。
 *
 * 底层组合：DistanceFilter + StereoPannerNode
 */

import { DistanceFilter } from './DistanceFilter.js';

/** 视口描述 */
export interface Viewport {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * SpatialAudio 将声源位置映射为：
 * - StereoPannerNode 的 pan 值（左右定位）
 * - DistanceFilter 的 cutoff / gain（远近滤音）
 * - send GainNode 的增益（混响 wet 比）
 *
 * @example
 * ```ts
 * const spatial = new SpatialAudio(ctx);
 * spatial.updatePosition(32, 32, { centerX: 32, centerY: 32, width: 64, height: 64 });
 * sound.connect(spatial.input);
 * spatial.output.connect(bus.input);
 * ```
 */
export class SpatialAudio {
  /** 声音输入节点 */
  readonly input: GainNode;
  /** 干声输出（接至 gameplay bus） */
  readonly output: GainNode;
  /** 混响 send（接至全局 ReverbEngine） */
  readonly send: GainNode;

  private panner: StereoPannerNode | null = null;
  private distanceFilter: DistanceFilter | null = null;
  private ctx: BaseAudioContext;

  /**
   * @param ctx - 音频上下文
   * @example
   * ```ts
   * const spatial = new SpatialAudio(audioContext);
   * ```
   */
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.send = ctx.createGain();

    if (typeof ctx.createBiquadFilter === 'function') {
      this.distanceFilter = new DistanceFilter(ctx);
    }

    if (typeof ctx.createStereoPanner === 'function') {
      this.panner = ctx.createStereoPanner();
    }

    // 主链路：input → distanceFilter → panner → output
    if (this.distanceFilter) {
      this.input.connect(this.distanceFilter.input);
      if (this.panner) {
        this.distanceFilter.output.connect(this.panner);
        this.panner.connect(this.output);
      } else {
        this.distanceFilter.output.connect(this.output);
      }
    } else if (this.panner) {
      this.input.connect(this.panner);
      this.panner.connect(this.output);
    } else {
      this.input.connect(this.output);
    }

    // Send 链路：input → send（增益由距离控制）
    this.input.connect(this.send);
  }

  /**
   * 更新声源位置与视口参数。
   *
   * pan = clamp((sourceX - centerX) / (width / 2), -1, 1)
   * 距离视口中心越远 → reverb send 越高
   * @param sourceX - 声源 X 坐标
   * @param sourceY - 声源 Y 坐标
   * @param viewport - 视口描述
   * @example
   * ```ts
   * spatial.updatePosition(10, 20, { centerX: 32, centerY: 32, width: 64, height: 64 });
   * ```
   */
  updatePosition(sourceX: number, sourceY: number, viewport: Viewport): void {
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;

    const pan = Math.max(-1, Math.min(1, (sourceX - viewport.centerX) / halfWidth));

    const dx = sourceX - viewport.centerX;
    const dy = sourceY - viewport.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxDistance = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);
    const normalizedDistance = Math.min(1, distance / Math.max(1, maxDistance));

    if (this.panner) {
      this.panner.pan.value = pan;
    }

    if (this.distanceFilter) {
      this.distanceFilter.update(distance);
    }

    // 距离越远，混响 send 越高（0.1 ~ 0.6）
    const sendGain = 0.1 + normalizedDistance * 0.5;
    const now = this.ctx.currentTime;
    this.send.gain.setValueAtTime(sendGain, now);
  }

  /**
   * 断开并清理所有节点。
   * @example
   * ```ts
   * spatial.dispose();
   * ```
   */
  dispose(): void {
    this.input.disconnect();
    this.output.disconnect();
    this.send.disconnect();
    if (this.panner) {
      this.panner.disconnect();
    }
    if (this.distanceFilter) {
      this.distanceFilter.dispose();
    }
  }
}
