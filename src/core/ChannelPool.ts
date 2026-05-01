interface ChannelEntry {
  soundId: string;
  priority: number;
}

/**
 * 声道池配置选项。
 * @example
 * ```ts
 * const options: ChannelPoolOptions = { maxChannels: 16, reservedChannels: 2 };
 * ```
 */
export interface ChannelPoolOptions {
  maxChannels?: number;
  reservedChannels?: number;
}

/**
 * 声道池，管理有限数量的音频声道。
 *
 * @example
 * ```ts
 * const pool = new ChannelPool({ maxChannels: 8, reservedChannels: 1 });
 * const id = pool.allocate('game.jump', 1);
 * if (id !== null) engine.play('game.jump');
 * ```
 */
export class ChannelPool {
  private readonly maxChannels: number;
  private readonly reservedChannels: number;
  private readonly channels: (ChannelEntry | null)[];
  private usedCount: number = 0;

  /**
   * @param options - 声道池配置
   * @example
   * ```ts
   * const pool = new ChannelPool({ maxChannels: 16 });
   * ```
   */
  constructor(options: ChannelPoolOptions = {}) {
    const max = options.maxChannels ?? 8;
    const reserved = options.reservedChannels ?? 1;

    if (!Number.isInteger(max) || max < 1) {
      throw new Error('maxChannels must be a positive integer');
    }
    if (!Number.isInteger(reserved) || reserved < 0) {
      throw new Error('reservedChannels must be a non-negative integer');
    }
    if (reserved > max) {
      throw new Error('reservedChannels cannot exceed maxChannels');
    }

    this.maxChannels = max;
    this.reservedChannels = reserved;
    this.channels = new Array(max).fill(null);
  }

  /**
   * 分配一个非保留声道。
   * @param soundId - 音效标识符
   * @param priority - 优先级，越高越不容易被抢占
   * @returns 声道 ID，若无可用语道且优先级过低则返回 null
   * @example
   * ```ts
   * const channelId = pool.allocate('game.jump', 1);
   * ```
   */
  allocate(soundId: string, priority: number = 0): number | null {
    if (Number.isNaN(priority)) {
      priority = 0;
    }
    const start = this.reservedChannels;
    const end = this.maxChannels;

    // Find a free non-reserved channel
    for (let i = start; i < end; i++) {
      if (this.channels[i] === null) {
        this.channels[i] = { soundId, priority };
        this.usedCount++;
        return i;
      }
    }

    // All non-reserved channels are occupied; try to preempt the lowest priority one
    let lowestPriorityIndex = -1;
    let lowestPriority = Infinity;

    for (let i = start; i < end; i++) {
      const entry = this.channels[i];
      if (entry && entry.priority < lowestPriority) {
        lowestPriority = entry.priority;
        lowestPriorityIndex = i;
      }
    }

    if (lowestPriorityIndex !== -1 && priority > lowestPriority) {
      this.channels[lowestPriorityIndex] = { soundId, priority };
      return lowestPriorityIndex;
    }

    return null;
  }

  /**
   * 分配一个保留声道。
   * @param soundId - 音效标识符
   * @returns 声道 ID，若所有保留声道都在使用中则返回 null
   * @example
   * ```ts
   * const channelId = pool.allocateReserved('bgm.theme');
   * ```
   */
  allocateReserved(soundId: string): number | null {
    for (let i = 0; i < this.reservedChannels; i++) {
      if (this.channels[i] === null) {
        this.channels[i] = { soundId, priority: 0 };
        this.usedCount++;
        return i;
      }
    }
    return null;
  }

  /**
   * 释放指定声道以便重用。无效 ID 无操作。
   * @param channelId - 声道 ID
   * @example
   * ```ts
   * pool.release(3);
   * ```
   */
  release(channelId: number): void {
    if (channelId >= 0 && channelId < this.maxChannels) {
      if (this.channels[channelId] !== null) {
        this.usedCount--;
      }
      this.channels[channelId] = null;
    }
  }

  /**
   * 释放所有声道（包括保留声道）。
   * @example
   * ```ts
   * pool.releaseAll();
   * ```
   */
  releaseAll(): void {
    for (let i = 0; i < this.maxChannels; i++) {
      this.channels[i] = null;
    }
    this.usedCount = 0;
  }

  /**
   * 检查指定声道是否已被分配。
   * @param channelId - 声道 ID
   * @returns 如果声道正在使用则返回 true
   * @example
   * ```ts
   * const inUse = pool.isInUse(3);
   * ```
   */
  isInUse(channelId: number): boolean {
    if (channelId < 0 || channelId >= this.maxChannels) {
      return false;
    }
    return this.channels[channelId] !== null;
  }

  /**
   * 获取当前已使用的声道数量。
   * @returns 已使用声道数
   * @example
   * ```ts
   * const count = pool.getUsedCount();
   * ```
   */
  getUsedCount(): number {
    return this.usedCount;
  }

  /**
   * 获取当前空闲的声道数量。
   * @returns 空闲声道数
   * @example
   * ```ts
   * const free = pool.getFreeCount();
   * ```
   */
  getFreeCount(): number {
    return this.maxChannels - this.usedCount;
  }

  /**
   * 获取最大声道数。
   * @returns 最大声道数
   * @example
   * ```ts
   * const max = pool.getMaxChannels();
   * ```
   */
  getMaxChannels(): number {
    return this.maxChannels;
  }
}
