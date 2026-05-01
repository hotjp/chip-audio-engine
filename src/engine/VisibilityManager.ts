import type { ChipAudioEngine } from './ChipAudioEngine.js';

export class VisibilityManager implements EventListenerObject {
  private readonly engine: ChipAudioEngine;
  private enabled: boolean = false;
  private previousMuted: boolean = false;

  constructor(engine: ChipAudioEngine) {
    this.engine = engine;
  }

  enable(): void {
    if (this.enabled) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    this.enabled = true;
    document.addEventListener('visibilitychange', this);
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
    }
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this);
    }
    this.engine.masterMuted = this.previousMuted;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  handleEvent(_event: Event): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
    } else {
      this.engine.masterMuted = this.previousMuted;
    }
  }
}
