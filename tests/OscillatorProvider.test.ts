import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OscillatorProvider, OscillatorSound } from '../src/providers/OscillatorProvider.js';
import type { SoundParams } from '../src/providers/types.js';

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
  } as unknown as BaseAudioContext;
}

describe('OscillatorProvider', () => {
  it('should create SoundInstance with createSound', () => {
    const provider = new OscillatorProvider();
    const ctx = createMockAudioContext();
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
    };
    const instance = provider.createSound(ctx, 'test', params);
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(OscillatorSound);
  });

  it('should have correct id and capabilities', () => {
    const provider = new OscillatorProvider();
    expect(provider.id).toBe('oscillator');
    expect(provider.capabilities.supportedTypes).toContain('synth');
    expect(provider.capabilities.realtimeParams).toBe(true);
  });

  it('should preload without error', async () => {
    const provider = new OscillatorProvider();
    await expect(provider.preload(['a', 'b'])).resolves.toBeUndefined();
  });
});

describe('OscillatorSound', () => {
  let ctx: BaseAudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct with params', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
  });

  it('should construct with filter', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sawtooth', frequency: 220 }],
      filter: { type: 'lowpass', frequency: 1000, Q: 2, gain: 1 },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
  });

  it('should connect without error', () => {
    const params: SoundParams = { waveforms: [{ type: 'sine', frequency: 440 }] };
    const sound = new OscillatorSound(ctx, 'id', params);
    const node = { connect: vi.fn() } as unknown as AudioNode;
    sound.connect(node);
  });

  it('should start without error', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      envelope: { attack: 10, decay: 20, sustain: 0.5, release: 30 },
      duration: 100,
      pitch: { start: 1, end: 0.5 },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.start(0, { volume: 0.8, pitch: 1.2, delay: 0 });
  });

  it('should start without envelope', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      duration: 100,
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.start(0, {});
  });

  it('should stop without error', () => {
    const params: SoundParams = { waveforms: [{ type: 'sine', frequency: 440 }] };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.stop(0);
  });

  it('should dispose without error', () => {
    const params: SoundParams = { waveforms: [{ type: 'sine', frequency: 440 }] };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.dispose();
  });

  it('should handle connect idempotency', () => {
    const params: SoundParams = { waveforms: [{ type: 'sine', frequency: 440 }] };
    const sound = new OscillatorSound(ctx, 'id', params);
    const node = { connect: vi.fn() } as unknown as AudioNode;
    sound.connect(node);
    sound.connect(node);
  });

  it('should handle start idempotency', () => {
    const params: SoundParams = { waveforms: [{ type: 'sine', frequency: 440 }] };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.start(0, {});
    sound.start(0, {});
  });

  it('should handle array frequency', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'square', frequency: [220, 440] }],
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
  });

  it('should handle detune and wave gain', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'triangle', frequency: 330, detune: 10, gain: 0.5 }],
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
  });

  it('should support noise waveform', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'noise', frequency: 0 }],
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
    const node = { connect: vi.fn() } as unknown as AudioNode;
    sound.connect(node);
    sound.start(0, {});
    sound.stop(0);
    sound.dispose();
  });

  it('should support multiple waveform stacking', () => {
    const params: SoundParams = {
      waveforms: [
        { type: 'sine', frequency: 220 },
        { type: 'square', frequency: 440, gain: 0.5 },
        { type: 'noise', frequency: 0, gain: 0.3 },
      ],
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
    const node = { connect: vi.fn() } as unknown as AudioNode;
    sound.connect(node);
    sound.start(0, {});
    sound.stop(0);
    sound.dispose();
  });

  it('should apply ADSR envelope parameters', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      envelope: { attack: 100, decay: 50, sustain: 0.3, release: 200 },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    const node = { connect: vi.fn() } as unknown as AudioNode;
    sound.connect(node);
    sound.start(0, { volume: 1 });

    const masterGain = (sound as any).masterGain as GainNode;
    expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 0.1);
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.3, expect.closeTo(0.15, 10));
  });

  it('should handle vibrato pitch curve', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      pitch: { start: 1, end: 1, curve: 'vibrato', vibrato: { rate: 6, depth: 20 } },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    expect(sound).toBeDefined();
  });

  it('should handle linear pitch curve', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      duration: 200,
      pitch: { start: 1, end: 0.5, curve: 'linear' },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.start(0, {});
    sound.stop(0);
  });

  it('should handle exponential pitch curve', () => {
    const params: SoundParams = {
      waveforms: [{ type: 'sine', frequency: 440 }],
      duration: 200,
      pitch: { start: 1, end: 0.5, curve: 'exponential' },
    };
    const sound = new OscillatorSound(ctx, 'id', params);
    sound.start(0, {});
    sound.stop(0);
  });
});
