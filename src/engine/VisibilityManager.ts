import type { ChipAudioEngine } from './ChipAudioEngine.js';

export class VisibilityManager implements EventListenerObject {
  private readonly engine: ChipAudioEngine;
  private enabled: boolean = false;
  private previousMuted: boolean = false;
  private wasHidden: boolean = false;

  constructor(engine: ChipAudioEngine) {
    this.engine = engine;
  }

  /** Enable auto-mute when the page becomes hidden. */
  enable(): void {
    if (this.enabled) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    this.enabled = true;
    this.wasHidden = false;
    document.addEventListener('visibilitychange', this);
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
      this.wasHidden = true;
    }
  }

  /** Disable visibility monitoring and restore previous mute state. */
  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this);
    }
    if (this.wasHidden) {
      this.engine.masterMuted = this.previousMuted;
      this.wasHidden = false;
    }
  }

  /** Check whether visibility monitoring is active. */
  isEnabled(): boolean {
    return this.enabled;
  }

  handleEvent(_event: Event): void {
    if (!this.enabled || typeof document === 'undefined') {
      return;
    }
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
      this.wasHidden = true;
    } else {
      this.engine.masterMuted = this.previousMuted;
    }
  }
}
