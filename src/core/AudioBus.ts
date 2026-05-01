export interface IAudioBus {
  readonly id: string;
  readonly parent: IAudioBus | null;
  volume: number;
  muted: boolean;

  fadeTo(target: number, durationMs: number): void;
  getActiveCount(): number;
}

/**
 * 音频总线，封装 GainNode 实现层级音量控制。
 *
 * @example
 * ```ts
 * const master = new AudioBus(ctx, 'master');
 * const music = new AudioBus(ctx, 'music', master);
 * master.output.connect(ctx.destination);
 * ```
 */
export class AudioBus implements IAudioBus {
  readonly id: string;
  private _parent: AudioBus | null = null;
  private readonly context: BaseAudioContext;
  private readonly gainNode: GainNode;
  private _volume: number = 1;
  private _muted: boolean = false;
  private readonly children: Map<string, AudioBus> = new Map();

  /**
   * @param context - 音频上下文
   * @param id - 总线标识符
   * @param parent - 可选的父总线
   */
  constructor(context: BaseAudioContext, id: string, parent: AudioBus | null = null) {
    this.context = context;
    this.id = id;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;
    if (parent) {
      parent.addBus(this);
    }
  }

  /**
   * 获取父总线。
   * @returns 父总线，若不存在则返回 null
   * @example
   * ```ts
   * const parent = bus.parent;
   * ```
   */
  get parent(): IAudioBus | null {
    return this._parent;
  }

  /**
   * 底层 GainNode，作为总线输入。
   * @returns GainNode 输入节点
   * @example
   * ```ts
   * sound.connect(bus.input);
   * ```
   */
  get input(): AudioNode {
    return this.gainNode;
  }

  /**
   * 底层 GainNode，作为总线输出。
   * @returns GainNode 输出节点
   * @example
   * ```ts
   * bus.output.connect(ctx.destination);
   * ```
   */
  get output(): AudioNode {
    return this.gainNode;
  }

  /**
   * 获取当前音量。
   * @returns 当前音量值（0–1）
   * @example
   * ```ts
   * const vol = bus.volume;
   * ```
   */
  get volume(): number {
    return this._volume;
  }

  /**
   * 设置当前音量。
   * @param value - 目标音量（0–1）
   * @example
   * ```ts
   * bus.volume = 0.5;
   * ```
   */
  set volume(value: number) {
    this.setVolume(value);
  }

  /**
   * 设置音量值。
   * @param value - 目标音量（0–1），超出范围会被裁剪
   * @example
   * ```ts
   * bus.setVolume(0.75);
   * ```
   */
  setVolume(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, value));
    this._volume = clamped;
    if (!this._muted) {
      const now = this.context.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(clamped, now);
    }
  }

  /**
   * 获取静音状态。
   * @returns 如果已静音则返回 true
   * @example
   * ```ts
   * if (bus.muted) { ... }
   * ```
   */
  get muted(): boolean {
    return this._muted;
  }

  /**
   * 设置静音状态。
   * @param value - 是否静音
   * @example
   * ```ts
   * bus.muted = true;
   * ```
   */
  set muted(value: boolean) {
    this.setMuted(value);
  }

  /**
   * 设置静音状态。
   * @param value - 是否静音
   * @example
   * ```ts
   * bus.setMuted(true);
   * ```
   */
  setMuted(value: boolean): void {
    if (this._muted === value) {
      return;
    }
    this._muted = value;
    const now = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    if (value) {
      this.gainNode.gain.setValueAtTime(0, now);
    } else {
      this.gainNode.gain.setValueAtTime(this._volume, now);
    }
  }

  /**
   * 渐变到目标音量。
   * @param target - 目标音量（0–1）
   * @param durationMs - 渐变时长（毫秒）
   * @example
   * ```ts
   * bus.fadeTo(0, 500);
   * ```
   */
  fadeTo(target: number, durationMs: number): void {
    if (!Number.isFinite(target) || !Number.isFinite(durationMs)) {
      return;
    }
    const clampedTarget = Math.max(0, Math.min(1, target));
    const now = this.context.currentTime;

    this.gainNode.gain.cancelScheduledValues(now);
    if (durationMs <= 0) {
      this.gainNode.gain.setValueAtTime(clampedTarget, now);
    } else {
      const endTime = now + durationMs / 1000;
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(clampedTarget, endTime);
    }

    this._volume = clampedTarget;
    // A fade to a positive target implies the bus should be audible,
    // so we clear the muted flag as a side effect.
    if (this._muted && clampedTarget > 0) {
      this._muted = false;
    }
  }

  /**
   * 添加子总线。子总线必须没有父总线。
   * @param subBus - 子总线实例
   * @throws 如果子总线是自己、已有父总线或 ID 已存在
   * @example
   * ```ts
   * master.addBus(new AudioBus(ctx, 'music'));
   * ```
   */
  addBus(subBus: AudioBus): void {
    if (subBus === this) {
      throw new Error('Cannot add a bus as a child of itself');
    }
    if (subBus._parent !== null) {
      throw new Error(`Bus "${subBus.id}" already has a parent`);
    }
    if (this.children.has(subBus.id)) {
      throw new Error(`Bus with id "${subBus.id}" already exists in bus "${this.id}"`);
    }
    this.children.set(subBus.id, subBus);
    subBus._parent = this;
    subBus.output.connect(this.input);
  }

  /**
   * 递归查找总线。若 ID 匹配自身则返回自身。
   * @param id - 总线标识符
   * @returns 找到的总线，若不存在则返回 undefined
   * @example
   * ```ts
   * const found = master.getBus('music');
   * ```
   */
  getBus(id: string): AudioBus | undefined {
    if (this.id === id) {
      return this;
    }
    for (const child of this.children.values()) {
      const found = child.getBus(id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /**
   * 获取附加到该总线的子总线数量。
   * @returns 子总线数量
   * @example
   * ```ts
   * const count = master.getActiveCount();
   * ```
   */
  getActiveCount(): number {
    return this.children.size;
  }
}
