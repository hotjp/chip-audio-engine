import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BGMEngine } from '../src/engine/BGMEngine.js';
import { OscillatorProvider } from '../src/providers/OscillatorProvider.js';
import type { AudioBus } from '../src/core/AudioBus.js';

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

  const createBufferSourceSpy = vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  const createBufferSpy = vi.fn((_channels: number, length: number, _sampleRate: number) => ({
    length,
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));

  return {
    currentTime: 0,
    sampleRate: 48000,
    createGain: createGainSpy,
    createOscillator: createOscillatorSpy,
    createBiquadFilter: createBiquadFilterSpy,
    createBufferSource: createBufferSourceSpy,
    createBuffer: createBufferSpy,
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

describe('BGMEngine', () => {
  let ctx: AudioContext;
  let provider: OscillatorProvider;
  let bus: AudioBus;
  let engine: BGMEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockAudioContext();
    provider = new OscillatorProvider();
    bus = createMockAudioBus();
    engine = new BGMEngine(ctx, provider, bus);
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not create per-note setTimeout', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    engine.loadScore({
      id: 'test',
      name: 'Test',
      bpm: 120,
      tracks: [
        {
          waveform: 'square',
          notes: [{ freq: 440, duration: 100, gain: 1 }],
        },
      ],
    });

    engine.play('test');

    // Scheduler should use short timeouts (lookahead)
    const schedulerTimeouts = setTimeoutSpy.mock.calls.filter(
      (c) => typeof c[1] === 'number' && (c[1] as number) <= 100
    );
    expect(schedulerTimeouts.length).toBeGreaterThan(0);
  });

  it('should cleanup active notes via interval', () => {
    const disposeSpy = vi.fn();
    const originalCreateSound = provider.createSound.bind(provider);
    provider.createSound = vi.fn((c, id, params) => {
      const instance = originalCreateSound(c, id, params);
      const originalDispose = instance.dispose.bind(instance);
      instance.dispose = () => {
        disposeSpy();
        originalDispose();
      };
      return instance;
    });

    engine.loadScore({
      id: 'test',
      name: 'Test',
      bpm: 120,
      tracks: [
        {
          waveform: 'square',
          notes: [{ freq: 440, duration: 50, gain: 1 }],
        },
      ],
    });

    engine.play('test');

    // Advance past note duration (50) + release (80) + buffer (50) + interval (100)
    vi.advanceTimersByTime(300);

    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should clear scheduler timeout on stop', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    engine.loadScore({
      id: 'test',
      name: 'Test',
      bpm: 120,
      tracks: [{ waveform: 'sine', notes: [] }],
    });

    engine.play('test');
    engine.stop();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should clear scheduler timeout on dispose', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    engine.loadScore({
      id: 'test',
      name: 'Test',
      bpm: 120,
      tracks: [{ waveform: 'sine', notes: [] }],
    });

    engine.play('test');
    engine.dispose();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
