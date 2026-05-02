import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BGMEngine } from '../src/engine/BGMEngine.js';
import { ChipAudioEngine } from '../src/engine/ChipAudioEngine.js';
import { OscillatorProvider } from '../src/providers/OscillatorProvider.js';
import { TimbrePackLoader } from '../src/config/TimbrePackLoader.js';
import { V2Compiler } from '../src/music/V2Compiler.js';
import type { AudioBus } from '../src/core/AudioBus.js';
import type { ScoreV2 } from '../src/engine/types-v2.js';

function createMockAudioContext() {
  const createGainSpy = vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  const createOscillatorSpy = vi.fn(() => ({
    type: 'sine',
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    detune: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  const createBiquadFilterSpy = vi.fn(() => ({
    type: 'lowpass',
    frequency: { value: 20000, setValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  return {
    currentTime: 0,
    sampleRate: 48000,
    createGain: createGainSpy,
    createOscillator: createOscillatorSpy,
    createBiquadFilter: createBiquadFilterSpy,
    destination: {},
  } as unknown as AudioContext;
}

function createMockAudioBus(): AudioBus {
  return {
    input: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode,
    output: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode,
    volume: 1,
    muted: false,
    fadeTo: vi.fn(),
    getBus: vi.fn(),
    addBus: vi.fn(),
    removeBus: vi.fn(),
  } as unknown as AudioBus;
}

function createTimbrePackLoader(): TimbrePackLoader {
  const loader = new TimbrePackLoader();
  loader.register({
    name: 'test-pack',
    timbres: {
      lead: {
        provider: 'oscillator',
        waveforms: [{ type: 'square' }],
        envelope: { attack: 5, decay: 50, sustain: 0.75, release: 80 },
      },
      bass: {
        provider: 'oscillator',
        waveforms: [{ type: 'sawtooth' }],
        envelope: { attack: 5, decay: 50, sustain: 0.75, release: 80 },
      },
    },
  });
  loader.setActive('test-pack');
  return loader;
}

function createMinimalV2Score(overrides?: Partial<ScoreV2>): ScoreV2 {
  const base: ScoreV2 = {
    $schema: 'cae-score-v2',
    meta: {
      $schema: 'cae-score-v2',
      title: 'Test V2',
      bpm: 120,
      timeSignature: [4, 4],
      timbrePack: 'test-pack',
    },
    tracks: [{ name: 'lead', timbre: 'lead' }],
    chapters: [{ id: 'intro', bars: 1 }],
    score: [
      { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q', 2], ['E4', 'q', 3], ['F4', 'q', 4]] } },
    ],
  };
  return { ...base, ...overrides } as ScoreV2;
}

describe('BGMEngine v2 integration', () => {
  let ctx: AudioContext;
  let provider: OscillatorProvider;
  let bus: AudioBus;
  let timbreLoader: TimbrePackLoader;
  let engine: BGMEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockAudioContext();
    provider = new OscillatorProvider();
    bus = createMockAudioBus();
    timbreLoader = createTimbrePackLoader();
    engine = new BGMEngine(ctx, provider, bus, undefined, timbreLoader);
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should load v2 score via loadV2Score', () => {
    const v2 = createMinimalV2Score();
    engine.loadV2Score(v2);
    const ids = engine.getLoadedScoreIds();
    expect(ids).toContain('test-v2');
  });

  it('should play v2 score via playV2', () => {
    const v2 = createMinimalV2Score();
    engine.playV2(v2);
    expect(engine.isCurrentlyPlaying()).toBe(true);
    expect(engine.getCurrentScoreId()).toBe('test-v2');
  });

  it('should play v2 score with fadeIn option', () => {
    const v2 = createMinimalV2Score();
    engine.playV2(v2, { fadeIn: 500 });
    expect(engine.isCurrentlyPlaying()).toBe(true);
    expect(bus.fadeTo).toHaveBeenCalled();
  });

  it('should apply velocity curve from v2 during playback', () => {
    const v2 = createMinimalV2Score({
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: {
            velocity: {
              curve: 'linear',
              points: [
                ['intro:start', 0.5],
                ['intro:end', 1.0],
              ],
            },
          },
        },
      ],
      chapters: [{ id: 'intro', bars: 2 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q', 2], ['E4', 'q', 3], ['F4', 'q', 4]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['G4', 'q', 1], ['A4', 'q', 2], ['B4', 'q', 3], ['C5', 'q', 4]] } },
      ],
    });

    engine.loadV2Score(v2);
    const score = engine['scores'].get('test-v2') as import('../src/engine/types.js').Score;
    const notes = score.tracks[0].notes;
    expect(notes[0].velocity).toBeCloseTo(0.5, 2);
    expect(notes[notes.length - 1].velocity!).toBeGreaterThan(notes[0].velocity!);
  });

  it('should preserve swing/humanize/layback performance params', () => {
    const v2 = createMinimalV2Score({
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: { swing: 0.3, humanize: 0.1, layback: 20 },
        },
      ],
    });

    engine.loadV2Score(v2);
    const score = engine['scores'].get('test-v2') as import('../src/engine/types.js').Score;
    const perf = score.tracks[0].performance;
    expect(perf?.swing).toBe(0.3);
    expect(perf?.humanize).toBe(0.1);
    expect(perf?.layback).toBe(20);
  });

  it('should expand pattern references correctly', () => {
    const v2 = createMinimalV2Score({
      tracks: [{ name: 'lead', timbre: 'lead' }],
      patterns: {
        motif: {
          lead: [['C4', 'q', 1], ['E4', 'q', 2], ['G4', 'q', 3]],
        },
      },
      score: [
        { chapter: 'intro', bar: 1, t: { lead: '$motif.lead' } },
      ],
    });

    engine.loadV2Score(v2);
    const score = engine['scores'].get('test-v2') as import('../src/engine/types.js').Score;
    const notes = score.tracks[0].notes;
    expect(notes.map((n) => n.note)).toEqual(['C4', 'E4', 'G4', null]);
  });

  it('should handle transition and blend bars', () => {
    const v2: ScoreV2 = {
      $schema: 'cae-score-v2',
      meta: {
        $schema: 'cae-score-v2',
        title: 'Blend Test',
        bpm: 120,
        timeSignature: [4, 4],
        timbrePack: 'test-pack',
      },
      tracks: [{ name: 'lead', timbre: 'lead' }],
      chapters: [
        { id: 'intro', bars: 4, transition: 2 },
        { id: 'dev', bars: 4 },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['D4', 'w', 1]] } },
        { chapter: 'intro', bar: 3, blend: { next: 'dev', weight: 0.3 }, t: { lead: [['E4', 'w', 1]] } },
        { chapter: 'intro', bar: 4, blend: { next: 'dev', weight: 0.7 }, t: { lead: [['F4', 'w', 1]] } },
        { chapter: 'dev', bar: 1, t: { lead: [['G4', 'w', 1]] } },
        { chapter: 'dev', bar: 2, t: { lead: [['A4', 'w', 1]] } },
        { chapter: 'dev', bar: 3, t: { lead: [['B4', 'w', 1]] } },
        { chapter: 'dev', bar: 4, t: { lead: [['C5', 'w', 1]] } },
      ],
    };

    engine.loadV2Score(v2);
    const score = engine['scores'].get('blend-test') as import('../src/engine/types.js').Score;
    const notes = score.tracks[0].notes;
    expect(notes.map((n) => n.note)).toEqual([
      'C4', 'D4', 'E4', 'G4', 'F4', 'A4', 'B4', 'C5',
    ]);
  });

  it('should not break existing v1 score loading', () => {
    engine.loadScore({
      id: 'v1-test',
      name: 'V1 Test',
      bpm: 120,
      tracks: [
        {
          waveform: 'square',
          notes: [{ freq: 440, duration: 100, gain: 1 }],
        },
      ],
    });

    engine.play('v1-test');
    expect(engine.isCurrentlyPlaying()).toBe(true);
    expect(engine.getCurrentScoreId()).toBe('v1-test');
  });

  it('should not break existing v1 new-format score loading', () => {
    engine.loadNewScore({
      id: 'v1-new',
      name: 'V1 New',
      bpm: 120,
      timbrePack: 'test-pack',
      tracks: [
        {
          timbre: 'lead',
          notes: [{ note: 'C4', duration: 'q' }],
        },
      ],
    });

    engine.play('v1-new');
    expect(engine.isCurrentlyPlaying()).toBe(true);
    expect(engine.getCurrentScoreId()).toBe('v1-new');
  });

  it('should coexist with v1 and v2 scores', () => {
    engine.loadScore({
      id: 'v1-legacy',
      name: 'Legacy',
      bpm: 120,
      tracks: [{ waveform: 'sine', notes: [] }],
    });

    const v2 = createMinimalV2Score({ meta: { ...createMinimalV2Score().meta, title: 'V2 Score' } });
    engine.loadV2Score(v2);

    expect(engine.getLoadedScoreIds()).toContain('v1-legacy');
    expect(engine.getLoadedScoreIds()).toContain('v2-score');
  });

  it('should use title as fallback id when loading v2', () => {
    const v2 = createMinimalV2Score({ meta: { ...createMinimalV2Score().meta, title: 'My Great Song!' } });
    engine.loadV2Score(v2);
    expect(engine.getLoadedScoreIds()).toContain('my-great-song');
  });
});

describe('ChipAudioEngine v2 integration', () => {
  let mockCtx: AudioContext;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return V2Compiler from getV2Compiler', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx });
    engine.init();
    const compiler = engine.getV2Compiler();
    expect(compiler).toBeInstanceOf(V2Compiler);
  });

  it('should compile v2 score through getV2Compiler', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx });
    engine.init();
    const compiler = engine.getV2Compiler()!;
    const v2 = createMinimalV2Score();
    const score = compiler.compile(v2);
    expect(score.id).toBe('test-v2');
    expect(score.bpm).toBe(120);
  });
});
