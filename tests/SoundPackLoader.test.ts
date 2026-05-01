import { describe, it, expect } from 'vitest';
import { SoundPackLoader } from '../src/config/SoundPackLoader.js';
import type { SoundPack } from '../src/config/SoundPackLoader.js';

describe('SoundPackLoader', () => {
  it('should register a pack', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: {
        jump: { provider: 'oscillator', waveforms: [{ type: 'sine', frequency: 440 }] },
      },
    };
    loader.register(pack);
    expect(loader.getPackNames()).toContain('test-pack');
  });

  it('should set active pack', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: { jump: { provider: 'oscillator' } },
    };
    loader.register(pack);
    const ok = loader.setActive('test-pack');
    expect(ok).toBe(true);
    expect(loader.getActivePackName()).toBe('test-pack');
  });

  it('should fail to set active for unregistered pack', () => {
    const loader = new SoundPackLoader();
    const ok = loader.setActive('missing');
    expect(ok).toBe(false);
  });

  it('should get sound params', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: {
        jump: { provider: 'oscillator', volume: 0.8 },
      },
    };
    loader.register(pack);
    loader.setActive('test-pack');
    const params = loader.getSound('jump');
    expect(params).not.toBeNull();
    expect(params!.volume).toBe(0.8);
  });

  it('should return null for missing sound', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: {},
    };
    loader.register(pack);
    loader.setActive('test-pack');
    expect(loader.getSound('missing')).toBeNull();
  });

  it('should return null when no active pack', () => {
    const loader = new SoundPackLoader();
    expect(loader.getSound('anything')).toBeNull();
  });

  it('should list sounds', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: {
        jump: { provider: 'oscillator' },
        shoot: { provider: 'oscillator' },
      },
    };
    loader.register(pack);
    loader.setActive('test-pack');
    const sounds = loader.listSounds();
    expect(sounds).toContain('jump');
    expect(sounds).toContain('shoot');
    expect(sounds).toHaveLength(2);
  });

  it('should return empty list when no active pack', () => {
    const loader = new SoundPackLoader();
    expect(loader.listSounds()).toEqual([]);
  });

  it('should get sound entry', () => {
    const loader = new SoundPackLoader();
    const pack: SoundPack = {
      name: 'test-pack',
      sounds: {
        jump: { provider: 'oscillator' },
      },
    };
    loader.register(pack);
    loader.setActive('test-pack');
    const entry = loader.getSoundEntry('jump');
    expect(entry).not.toBeNull();
    expect(entry!.provider).toBe('oscillator');
  });

  it('should return null entry when no active pack', () => {
    const loader = new SoundPackLoader();
    expect(loader.getSoundEntry('jump')).toBeNull();
  });

  it('should overwrite pack with same name', () => {
    const loader = new SoundPackLoader();
    const pack1: SoundPack = { name: 'pack', sounds: { a: { provider: 'oscillator' } } };
    const pack2: SoundPack = { name: 'pack', sounds: { b: { provider: 'oscillator' } } };
    loader.register(pack1);
    loader.register(pack2);
    loader.setActive('pack');
    expect(loader.listSounds()).toContain('b');
  });
});
