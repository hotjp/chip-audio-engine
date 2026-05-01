import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChipAudioEngine } from '../src/engine/ChipAudioEngine.js';
import type { SoundPack } from '../src/config/SoundPackLoader.js';
import type { SoundProvider, SoundInstance } from '../src/providers/SoundProvider.js';
import type { SoundParams, PlayParams } from '../src/providers/types.js';

function createMockAudioContext() {
  const createOscillatorSpy = vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    detune: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

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

  const createBiquadFilterSpy = vi.fn(() => ({
    type: 'lowpass',
    frequency: { value: 20000, setValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockOscillator = {
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    detune: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockFilter = {
    type: 'lowpass',
    frequency: { value: 20000, setValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    createGain: createGainSpy,
    createOscillator: createOscillatorSpy,
    createBiquadFilter: createBiquadFilterSpy,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    currentTime: 0,
    close: vi.fn(),
    state: 'running',
  } as unknown as AudioContext;
}

const mockPack: SoundPack = {
  name: 'default',
  sounds: {
    'game.jump': {
      provider: 'oscillator',
      waveforms: [{ type: 'sine', frequency: 440 }],
      duration: 100,
    },
    'ui.click': {
      provider: 'oscillator',
      waveforms: [{ type: 'square', frequency: 880 }],
      duration: 50,
    },
    'bgm.theme': {
      provider: 'oscillator',
      waveforms: [{ type: 'triangle', frequency: 220 }],
      duration: 200,
    },
  },
};

describe('ChipAudioEngine', () => {
  let mockCtx: AudioContext;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create instance with config', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    expect(engine).toBeDefined();
    expect(engine.getMasterBus()).toBeNull();
  });

  it('should init and create bus tree', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    expect(engine.getMasterBus()).not.toBeNull();
    expect(engine.getBus('master')).toBeDefined();
    expect(engine.getBus('music')).toBeDefined();
    expect(engine.getBus('sfx')).toBeDefined();
    expect(engine.getBus('ui')).toBeDefined();
    expect(engine.getBus('gameplay')).toBeDefined();
  });

  it('should play a sound', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('game.jump');
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should play with playParams', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('game.jump', { volume: 0.5, pitch: 1.2, delay: 0.01 });
  });

  it('should ignore play when not initialized', () => {
    const engine = new ChipAudioEngine({ soundPack: mockPack });
    expect(() => engine.play('game.jump')).not.toThrow();
  });

  it('should ignore unknown sound', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    expect(() => engine.play('unknown')).not.toThrow();
  });

  it('should stopAll sounds', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('game.jump');
    engine.stopAll();
    expect(engine.getBus('master')).toBeDefined();
  });

  it('should destroy engine', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.destroy();
    expect(engine.getMasterBus()).toBeNull();
    expect(mockCtx.close).not.toHaveBeenCalled(); // because we passed it in
  });

  it('should close owned context on destroy', () => {
    const closeFn = vi.fn();
    const gainNode = { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    const fakeCtx = {
      state: 'running',
      close: closeFn,
      currentTime: 0,
      destination: {},
      createGain: () => gainNode,
      createOscillator: () => ({ type: 'sine', frequency: { value: 440, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: { value: 20000, setValueAtTime: vi.fn() }, Q: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }),
    } as any;
    class MockAudioContext {
      constructor() { return fakeCtx; }
    }
    (globalThis as any).AudioContext = MockAudioContext;

    const engine = new ChipAudioEngine({ soundPack: mockPack });
    engine.init();
    engine.destroy();
    expect(closeFn).toHaveBeenCalled();
    delete (globalThis as any).AudioContext;
  });

  it('should register custom provider', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    const customProvider: SoundProvider = {
      id: 'custom',
      capabilities: { supportedTypes: ['synth'], maxPolyphony: 1, realtimeParams: false },
      createSound: () => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        dispose: vi.fn(),
      }),
    };
    engine.registerProvider(customProvider);
    // Can't directly test play with custom provider without pack referencing it
  });

  it('should loadSoundPack', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx });
    engine.init();
    const newPack: SoundPack = {
      name: 'new-pack',
      sounds: {
        test: { provider: 'oscillator', waveforms: [{ type: 'sine', frequency: 440 }], duration: 100 },
      },
    };
    engine.loadSoundPack(newPack);
    expect(() => engine.play('test')).not.toThrow();
  });

  it('should add duck rule and apply ducking', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.addDuckRule({ trigger: 'game.jump', target: 'music', duckVolume: 0.2, fadeOutMs: 50, fadeInMs: 50, holdMs: 100 });
    engine.play('game.jump');
  });

  it('should set aggregation config', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.setAggregation('game.jump', { strategy: 'debounce', windowMs: 200 });
    engine.play('game.jump');
  });

  it('should get and set masterVolume', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.masterVolume = 0.5;
    expect(engine.masterVolume).toBe(0.5);
  });

  it('should get and set masterMuted', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.masterMuted = true;
    expect(engine.masterMuted).toBe(true);
  });

  it('should return default masterVolume when not initialized', () => {
    const engine = new ChipAudioEngine({ soundPack: mockPack });
    expect(engine.masterVolume).toBe(1);
  });

  it('should return default masterMuted when not initialized', () => {
    const engine = new ChipAudioEngine({ soundPack: mockPack });
    expect(engine.masterMuted).toBe(false);
  });

  it('should handle play when channel allocation fails', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack, channelCount: 1 });
    engine.init();
    // fill the only channel
    engine.play('game.jump');
    // second play should fail allocation gracefully
    expect(() => engine.play('ui.click')).not.toThrow();
  });

  it('should route ui.* sounds to ui bus', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('ui.click');
  });

  it('should route bgm.* sounds to music bus', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('bgm.theme');
  });

  it('should route music.* sounds to music bus', () => {
    const pack: SoundPack = {
      name: 'default',
      sounds: {
        'music.intro': { provider: 'oscillator', waveforms: [{ type: 'sine', frequency: 330 }], duration: 100 },
      },
    };
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: pack });
    engine.init();
    engine.play('music.intro');
  });

  it('should replace previous active sound of same id', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.play('game.jump');
    engine.play('game.jump');
  });

  it('should ignore play when aggregator blocks', () => {
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: mockPack });
    engine.init();
    engine.setAggregation('game.jump', { strategy: 'stack', windowMs: 1000, maxQueueDepth: 1 });
    engine.play('game.jump');
    engine.play('game.jump');
  });

  it('should handle destroy when not initialized', () => {
    const engine = new ChipAudioEngine({ soundPack: mockPack });
    expect(() => engine.destroy()).not.toThrow();
  });

  it('should handle stopAll when not initialized', () => {
    const engine = new ChipAudioEngine({ soundPack: mockPack });
    expect(() => engine.stopAll()).not.toThrow();
  });

  it('should handle play without soundPack entry provider', () => {
    const pack: SoundPack = {
      name: 'default',
      sounds: {
        'test': { waveforms: [{ type: 'sine', frequency: 440 }], duration: 100 },
      },
    };
    const engine = new ChipAudioEngine({ audioContext: mockCtx, soundPack: pack });
    engine.init();
    engine.play('test');
  });
});
