export interface IAudioBus {
  readonly id: string;
  readonly parent: IAudioBus | null;
  volume: number;
  muted: boolean;

  fadeTo(target: number, durationMs: number): void;
  getActiveCount(): number;
}

export class AudioBus implements IAudioBus {
  readonly id: string;
  private _parent: AudioBus | null = null;
  private readonly context: BaseAudioContext;
  private readonly gainNode: GainNode;
  private _volume: number = 1;
  private _muted: boolean = false;
  private readonly children: Map<string, AudioBus> = new Map();

  constructor(context: BaseAudioContext, id: string, parent: AudioBus | null = null) {
    this.context = context;
    this.id = id;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;
    if (parent) {
      parent.addBus(this);
    }
  }

  get parent(): IAudioBus | null {
    return this._parent;
  }

  /** Underlying GainNode used as the bus input. */
  get input(): AudioNode {
    return this.gainNode;
  }

  /** Underlying GainNode used as the bus output. */
  get output(): AudioNode {
    return this.gainNode;
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this.setVolume(value);
  }

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

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this.setMuted(value);
  }

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
   * Add a child bus. The sub-bus must not already have a parent.
   * @throws if the sub-bus is this bus, already has a parent, or the id already exists
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
   * Recursively find a bus by id. Returns this bus if id matches.
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

  /** Returns the number of child buses attached to this bus. */
  getActiveCount(): number {
    return this.children.size;
  }
}
