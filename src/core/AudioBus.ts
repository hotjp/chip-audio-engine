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
  private _preMuteGain: number = 1;
  private readonly children: Map<string, AudioBus> = new Map();

  constructor(context: BaseAudioContext, id: string, parent: AudioBus | null = null) {
    this.context = context;
    this.id = id;
    this._parent = parent;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;
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
      this._preMuteGain = this.gainNode.gain.value;
      this.gainNode.gain.setValueAtTime(0, now);
    } else {
      this.gainNode.gain.setValueAtTime(this._volume, now);
    }
  }

  fadeTo(target: number, durationMs: number): void {
    const clampedTarget = Math.max(0, Math.min(1, target));
    const now = this.context.currentTime;
    const endTime = now + durationMs / 1000;

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(clampedTarget, endTime);

    this._volume = clampedTarget;
    // A fade to a positive target implies the bus should be audible,
    // so we clear the muted flag as a side effect.
    if (this._muted && clampedTarget > 0) {
      this._muted = false;
    }
  }

  addBus(subBus: AudioBus): void {
    if (this.children.has(subBus.id)) {
      throw new Error(`Bus with id "${subBus.id}" already exists in bus "${this.id}"`);
    }
    this.children.set(subBus.id, subBus);
    subBus._parent = this;
    subBus.output.connect(this.input);
  }

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
