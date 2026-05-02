import { describe, it, expect } from 'vitest';
import { TimbrePackLoader } from '../src/config/TimbrePackLoader.js';
import type { TimbrePack, TimbreDefinition } from '../src/config/TimbrePackLoader.js';

describe('TimbrePackLoader', () => {
  function createTestPack(name: string, timbreNames: string[]): TimbrePack {
    const timbres: Record<string, TimbreDefinition> = {};
    for (const t of timbreNames) {
      timbres[t] = { provider: 'oscillator' };
    }
    return { name, timbres };
  }

  it('should register a pack', () => {
    const loader = new TimbrePackLoader();
    const pack = createTestPack('test-pack', ['lead', 'bass']);
    loader.register(pack);
    expect(loader.getActivePackName()).toBeNull();
  });

  it('should set active pack and return true', () => {
    const loader = new TimbrePackLoader();
    const pack = createTestPack('test-pack', ['lead']);
    loader.register(pack);
    const ok = loader.setActive('test-pack');
    expect(ok).toBe(true);
    expect(loader.getActivePackName()).toBe('test-pack');
  });

  it('should return false when setting active for unregistered pack', () => {
    const loader = new TimbrePackLoader();
    const ok = loader.setActive('missing');
    expect(ok).toBe(false);
  });

  it('should get timbre from active pack', () => {
    const loader = new TimbrePackLoader();
    const pack: TimbrePack = {
      name: 'test-pack',
      timbres: {
        lead: { provider: 'oscillator', volume: 0.8 },
      },
    };
    loader.register(pack);
    loader.setActive('test-pack');
    const timbre = loader.getTimbre('lead');
    expect(timbre).toBeDefined();
    expect(timbre!.provider).toBe('oscillator');
    expect(timbre!.volume).toBe(0.8);
  });

  it('should return undefined for unregistered timbre in active pack', () => {
    const loader = new TimbrePackLoader();
    const pack = createTestPack('test-pack', ['lead']);
    loader.register(pack);
    loader.setActive('test-pack');
    expect(loader.getTimbre('missing')).toBeUndefined();
  });

  it('should return undefined when getting timbre with no active pack', () => {
    const loader = new TimbrePackLoader();
    expect(loader.getTimbre('lead')).toBeUndefined();
  });

  it('should list all timbre names in active pack', () => {
    const loader = new TimbrePackLoader();
    const pack = createTestPack('test-pack', ['lead', 'bass', 'pad']);
    loader.register(pack);
    loader.setActive('test-pack');
    const names = loader.listTimbres();
    expect(names).toContain('lead');
    expect(names).toContain('bass');
    expect(names).toContain('pad');
    expect(names).toHaveLength(3);
  });

  it('should return empty list when no active pack', () => {
    const loader = new TimbrePackLoader();
    expect(loader.listTimbres()).toEqual([]);
  });

  it('should switch active pack and use new pack for getTimbre', () => {
    const loader = new TimbrePackLoader();
    const packA: TimbrePack = {
      name: 'pack-a',
      timbres: {
        lead: { provider: 'oscillator', volume: 0.5 },
      },
    };
    const packB: TimbrePack = {
      name: 'pack-b',
      timbres: {
        lead: { provider: 'oscillator', volume: 0.9 },
        bass: { provider: 'oscillator' },
      },
    };
    loader.register(packA);
    loader.register(packB);
    loader.setActive('pack-a');
    expect(loader.getTimbre('lead')!.volume).toBe(0.5);
    expect(loader.getTimbre('bass')).toBeUndefined();

    loader.setActive('pack-b');
    expect(loader.getTimbre('lead')!.volume).toBe(0.9);
    expect(loader.getTimbre('bass')).toBeDefined();
  });

  it('should return null for getActivePackName in empty state', () => {
    const loader = new TimbrePackLoader();
    expect(loader.getActivePackName()).toBeNull();
  });

  it('should overwrite pack with same name', () => {
    const loader = new TimbrePackLoader();
    const pack1: TimbrePack = {
      name: 'pack',
      timbres: {
        a: { provider: 'oscillator', volume: 0.1 },
      },
    };
    const pack2: TimbrePack = {
      name: 'pack',
      timbres: {
        b: { provider: 'oscillator', volume: 0.2 },
      },
    };
    loader.register(pack1);
    loader.register(pack2);
    loader.setActive('pack');
    expect(loader.listTimbres()).toContain('b');
    expect(loader.listTimbres()).not.toContain('a');
    expect(loader.getTimbre('b')!.volume).toBe(0.2);
  });
});
