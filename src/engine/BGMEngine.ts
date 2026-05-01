import type { AudioBus } from '../core/AudioBus.js';
import type { DuckManager } from '../core/DuckManager.js';
import { OscillatorProvider } from '../providers/OscillatorProvider.js';
import type { SoundParams } from '../providers/types.js';
import type { SoundInstance } from '../providers/SoundProvider.js';
import { EventEmitter } from '../core/EventEmitter.js';
import type { BGMScore, BGMTrack, BGMNote } from './types.js';

interface TrackState {
  nextNoteIndex: number;
  nextNoteTime: number;
}

interface ActiveNote {
  instance: SoundInstance;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface BGMEngineEvents {
  'bgm:start': { scoreId: string };
  'bgm:stop': { scoreId: string };
}

/**
 * 后台音乐（BGM）引擎，负责按 Score 调度音符播放。
 *
 * @example
 * ```ts
 * const engine = new ChipAudioEngine();
 * engine.init();
 * const bgm = engine.getBGMEngine()!;
 * bgm.loadScore({ id: 'title', name: 'Title Theme', bpm: 120, tracks: [] });
 * bgm.play('title', { fadeIn: 500 });
 * ```
 */
export class BGMEngine extends EventEmitter<BGMEngineEvents> {
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

  /**
   * @param ctx - 音频上下文
   * @param provider - 振荡器提供者
   * @param musicBus - 音乐总线
   * @param duckManager - 可选的闪避管理器
   */
  constructor(
    ctx: AudioContext,
    provider: OscillatorProvider,
    musicBus: AudioBus,
    duckManager?: DuckManager
  ) {
    super();
    this.ctx = ctx;
    this.provider = provider;
    this.musicBus = musicBus;
    this.duckManager = duckManager ?? null;
  }

  /**
   * 加载单个 BGM 乐谱。
   * @param score - 乐谱对象
   * @example
   * ```ts
   * bgm.loadScore({ id: 'boss', name: 'Boss', bpm: 140, tracks: [] });
   * ```
   */
  loadScore(score: BGMScore): void {
    this.scores.set(score.id, score);
  }

  /**
   * 批量加载 BGM 乐谱。
   * @param scores - 乐谱数组
   * @example
   * ```ts
   * bgm.loadScores([
   *   { id: 'stage1', name: 'Stage 1', bpm: 120, tracks: [] },
   * ]);
   * ```
   */
  loadScores(scores: BGMScore[]): void {
    for (const score of scores) {
      this.scores.set(score.id, score);
    }
  }

  /**
   * 卸载指定乐谱。如果当前正在播放该乐谱，会先停止。
   * @param scoreId - 乐谱标识符
   * @example
   * ```ts
   * bgm.unloadScore('boss');
   * ```
   */
  unloadScore(scoreId: string): void {
    if (this.currentScore?.id === scoreId) {
      this.stop();
    }
    this.scores.delete(scoreId);
  }

  /**
   * 播放指定 BGM 乐谱。
   * @param scoreId - 乐谱标识符
   * @param options - 可选的淡入配置
   * @example
   * ```ts
   * bgm.play('title', { fadeIn: 1000 });
   * ```
   */
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
    this.emit('bgm:start', { scoreId });
  }

  /**
   * 停止当前播放的 BGM。
   * @param options - 可选的淡出配置
   * @example
   * ```ts
   * bgm.stop({ fadeOut: 500 });
   * ```
   */
  stop(options?: { fadeOut?: number }): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    const scoreId = this.currentScore?.id ?? '';

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

    this.emit('bgm:stop', { scoreId });
  }

  /**
   * 检查是否正在播放 BGM。
   * @returns 如果正在播放则返回 true
   * @example
   * ```ts
   * if (bgm.isCurrentlyPlaying()) {
   *   console.log('BGM is playing');
   * }
   * ```
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取当前播放的乐谱 ID。
   * @returns 当前乐谱 ID，如果没有播放则返回 null
   * @example
   * ```ts
   * const id = bgm.getCurrentScoreId();
   * ```
   */
  getCurrentScoreId(): string | null {
    return this.currentScore?.id ?? null;
  }

  /**
   * 获取所有已加载的乐谱 ID 列表。
   * @returns 乐谱 ID 数组
   * @example
   * ```ts
   * const ids = bgm.getLoadedScoreIds();
   * ```
   */
  getLoadedScoreIds(): string[] {
    return Array.from(this.scores.keys());
  }

  /**
   * 释放 BGM 引擎资源。
   * @example
   * ```ts
   * bgm.dispose();
   * ```
   */
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
