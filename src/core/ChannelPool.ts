interface ChannelEntry {
  soundId: string;
  priority: number;
}

export interface ChannelPoolOptions {
  maxChannels?: number;
  reservedChannels?: number;
}

export class ChannelPool {
  private readonly maxChannels: number;
  private readonly reservedChannels: number;
  private readonly channels: (ChannelEntry | null)[];
  private usedCount: number = 0;

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

  release(channelId: number): void {
    if (channelId >= 0 && channelId < this.maxChannels) {
      if (this.channels[channelId] !== null) {
        this.usedCount--;
      }
      this.channels[channelId] = null;
    }
  }

  releaseAll(): void {
    for (let i = 0; i < this.maxChannels; i++) {
      this.channels[i] = null;
    }
    this.usedCount = 0;
  }

  isInUse(channelId: number): boolean {
    if (channelId < 0 || channelId >= this.maxChannels) {
      return false;
    }
    return this.channels[channelId] !== null;
  }

  getUsedCount(): number {
    return this.usedCount;
  }

  getFreeCount(): number {
    return this.maxChannels - this.usedCount;
  }

  getMaxChannels(): number {
    return this.maxChannels;
  }
}
