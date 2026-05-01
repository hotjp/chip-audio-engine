import type { AudioBus } from '../core/AudioBus.js';
import type { DuckManager } from '../core/DuckManager.js';
import { OscillatorProvider } from '../providers/OscillatorProvider.js';
import type { SoundParams } from '../providers/types.js';
import type { SoundInstance } from '../providers/SoundProvider.js';
import type { BGMScore, BGMTrack, BGMNote } from './types.js';

interface TrackState {
  nextNoteIndex: number;
  nextNoteTime: number;
}

interface ActiveNote {
  instance: SoundInstance;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class BGMEngine {
  private ctx: AudioContext;
  private provider: OscillatorProvider;
  private musicBus: AudioBus;
  private duckManager: DuckManager | null;
  private scores: Map<string, BGMScore> = new Map();
  private currentScore: BGMScore | null = null;
  private isPlaying = false;
  private trackStates: TrackState[] = [];
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private activeNotes: ActiveNote[] = [];
  private disposed = false;
  private normalMusicVolume = 1;
  private readonly scheduleAheadTime = 0.1;
  private readonly lookahead = 25;

  constructor(
    ctx: AudioContext,
    provider: OscillatorProvider,
    musicBus: AudioBus,
    duckManager?: DuckManager
  ) {
    this.ctx = ctx;
    this.provider = provider;
    this.musicBus = musicBus;
    this.duckManager = duckManager ?? null;
  }

  loadScore(score: BGMScore): void {
    this.scores.set(score.id, score);
  }

  loadScores(scores: BGMScore[]): void {
    for (const score of scores) {
      this.scores.set(score.id, score);
    }
  }

  unloadScore(scoreId: string): void {
    if (this.currentScore?.id === scoreId) {
      this.stop();
    }
    this.scores.delete(scoreId);
  }

  play(scoreId: string, options?: { fadeIn?: number }): void {
    if (this.disposed) return;

    const score = this.scores.get(scoreId);
    if (!score) return;

    this.stop();

    this.currentScore = score;
    this.isPlaying = true;

    this.normalMusicVolume = this.musicBus.volume;

    if (options?.fadeIn && options.fadeIn > 0) {
      this.musicBus.volume = 0;
      this.musicBus.fadeTo(this.normalMusicVolume, options.fadeIn);
    }

    if (this.duckManager) {
      this.duckManager.setActive('bgm');
    }

    const now = this.ctx.currentTime;
    this.trackStates = score.tracks.map(() => ({
      nextNoteIndex: 0,
      nextNoteTime: now,
    }));

    this.scheduler();
  }

  stop(options?: { fadeOut?: number }): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.duckManager) {
      this.duckManager.clearActive('bgm');
    }

    if (options?.fadeOut && options.fadeOut > 0) {
      this.musicBus.fadeTo(0, options.fadeOut);
      const timeoutId = setTimeout(() => {
        this.internalCleanup();
        this.musicBus.volume = this.normalMusicVolume;
      }, options.fadeOut);
      this.timeouts.push(timeoutId);
    } else {
      this.internalCleanup();
      this.musicBus.volume = this.normalMusicVolume;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentScoreId(): string | null {
    return this.currentScore?.id ?? null;
  }

  getLoadedScoreIds(): string[] {
    return Array.from(this.scores.keys());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.scores.clear();
  }

  private scheduler(): void {
    if (!this.isPlaying || !this.currentScore) return;

    const now = this.ctx.currentTime;

    for (let i = 0; i < this.currentScore.tracks.length; i++) {
      const track = this.currentScore.tracks[i];
      const state = this.trackStates[i];

      while (state.nextNoteTime < now + this.scheduleAheadTime) {
        const note = track.notes[state.nextNoteIndex];
        if (note && note.freq !== null) {
          this.playNote(track, note, state.nextNoteTime);
        }

        const durationSec = (note?.duration ?? 250) / 1000;
        state.nextNoteTime += durationSec;
        state.nextNoteIndex++;

        if (state.nextNoteIndex >= track.notes.length) {
          state.nextNoteIndex = track.loopStart ?? 0;
        }
      }
    }

    if (this.isPlaying) {
      this.schedulerTimer = setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  private playNote(track: BGMTrack, note: BGMNote, when: number): void {
    const waveformType = track.waveform;
    const isNoise = waveformType === 'noise';

    const waveforms: NonNullable<SoundParams['waveforms']> = [
      {
        type: isNoise ? 'noise' : waveformType,
        frequency: note.freq ?? 440,
        detune: track.detune ?? 0,
        gain: 1,
      },
    ];

    const params: SoundParams = {
      waveforms,
      envelope: {
        attack: 5,
        decay: 50,
        sustain: 0.75,
        release: 80,
      },
      filter: track.filter,
      volume: (note.gain ?? 1) * (track.volume ?? 1),
      duration: note.duration,
    };

    const instance = this.provider.createSound(this.ctx, 'bgm.note', params);
    instance.connect(this.musicBus.input);
    instance.start(when, {});

    const releaseMs = params.envelope?.release ?? 80;
    const stopTime = when + note.duration / 1000;
    instance.stop(stopTime);

    const cleanupDelay = note.duration + releaseMs + 50;
    const timeoutId = setTimeout(() => {
      instance.dispose();
      this.activeNotes = this.activeNotes.filter((n) => n.instance !== instance);
    }, cleanupDelay);

    this.activeNotes.push({ instance, timeoutId });
    this.timeouts.push(timeoutId);
  }

  private internalCleanup(): void {
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    for (const note of this.activeNotes) {
      clearTimeout(note.timeoutId);
      try {
        note.instance.stop(this.ctx.currentTime);
      } catch {
        // ignore
      }
      note.instance.dispose();
    }
    this.activeNotes = [];

    for (const tid of this.timeouts) {
      clearTimeout(tid);
    }
    this.timeouts = [];

    this.currentScore = null;
    this.trackStates = [];
  }
}
