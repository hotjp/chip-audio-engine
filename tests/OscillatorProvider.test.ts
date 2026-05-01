import { describe, it, expect, vi } from 'vitest';
import { OscillatorProvider, OscillatorSound } from '../src/providers/OscillatorProvider.js';
import type { SoundParams } from '../src/providers/types.js';

function createMockAudioContext() {
  return {
    currentTime: 0,
    createGain: () => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      detune: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { value: 20000, setValueAtTime: vi.fn() },
      Q: { value: 1, setValueAtTime: vi.fn() },
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
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
});
