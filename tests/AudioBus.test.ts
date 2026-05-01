import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioBus } from '../src/core/AudioBus.js';

function createMockAudioContext() {
  return {
    currentTime: 0,
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    destination: {},
  } as unknown as BaseAudioContext;
}

describe('AudioBus', () => {
  let ctx: BaseAudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  it('should create an instance with given id', () => {
    const bus = new AudioBus(ctx, 'master');
    expect(bus.id).toBe('master');
    expect(bus.parent).toBeNull();
    expect(bus.volume).toBe(1);
    expect(bus.muted).toBe(false);
  });

  it('should set volume and update gain value', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setVolume(0.5);
    expect(bus.volume).toBe(0.5);
  });

  it('should clamp volume between 0 and 1', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setVolume(-0.5);
    expect(bus.volume).toBe(0);
    bus.setVolume(1.5);
    expect(bus.volume).toBe(1);
  });

  it('should mute and set gain to 0', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setVolume(0.8);
    bus.setMuted(true);
    expect(bus.muted).toBe(true);
    expect((bus as any).gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('should unmute and restore volume', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setVolume(0.7);
    bus.setMuted(true);
    bus.setMuted(false);
    expect(bus.muted).toBe(false);
  });

  it('should ignore redundant mute calls', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setMuted(false);
    expect((bus as any).gainNode.gain.setValueAtTime).not.toHaveBeenCalled();
  });

  it('should fade to target volume over duration', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.fadeTo(0.3, 500);
    expect(bus.volume).toBe(0.3);
  });

  it('should clamp fade target', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.fadeTo(-1, 100);
    expect(bus.volume).toBe(0);
    bus.fadeTo(2, 100);
    expect(bus.volume).toBe(1);
  });

  it('should ignore NaN and Infinity for setVolume', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setVolume(0.5);
    bus.setVolume(NaN);
    expect(bus.volume).toBe(0.5);
    bus.setVolume(Infinity);
    expect(bus.volume).toBe(0.5);
    bus.setVolume(-Infinity);
    expect(bus.volume).toBe(0.5);
  });

  it('should apply fadeTo immediately when durationMs <= 0', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.fadeTo(0.3, 0);
    expect(bus.volume).toBe(0.3);
    bus.fadeTo(0.6, -100);
    expect(bus.volume).toBe(0.6);
  });

  it('should throw when adding self as child', () => {
    const bus = new AudioBus(ctx, 'bus');
    expect(() => bus.addBus(bus)).toThrow('Cannot add a bus as a child of itself');
  });

  it('should throw when adding a bus that already has a parent', () => {
    const parent1 = new AudioBus(ctx, 'parent1');
    const parent2 = new AudioBus(ctx, 'parent2');
    const child = new AudioBus(ctx, 'child');
    parent1.addBus(child);
    expect(() => parent2.addBus(child)).toThrow('already has a parent');
  });

  it('should unmute when fadeTo sets positive target', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.setMuted(true);
    bus.fadeTo(0.5, 100);
    expect(bus.muted).toBe(false);
  });

  it('should add and retrieve child bus', () => {
    const master = new AudioBus(ctx, 'master');
    const child = new AudioBus(ctx, 'child');
    master.addBus(child);
    expect(master.getActiveCount()).toBe(1);
    expect(master.getBus('child')).toBe(child);
  });

  it('should find bus recursively', () => {
    const master = new AudioBus(ctx, 'master');
    const child = new AudioBus(ctx, 'child');
    const grandchild = new AudioBus(ctx, 'grandchild');
    master.addBus(child);
    child.addBus(grandchild);
    expect(master.getBus('grandchild')).toBe(grandchild);
  });

  it('should return self when id matches', () => {
    const bus = new AudioBus(ctx, 'self');
    expect(bus.getBus('self')).toBe(bus);
  });

  it('should throw when adding duplicate bus id', () => {
    const master = new AudioBus(ctx, 'master');
    const child = new AudioBus(ctx, 'child');
    master.addBus(child);
    expect(() => master.addBus(new AudioBus(ctx, 'child'))).toThrow('already exists');
  });

  it('should expose input and output as AudioNode', () => {
    const bus = new AudioBus(ctx, 'bus');
    expect(bus.input).toBeDefined();
    expect(bus.output).toBeDefined();
  });

  it('should set volume via setter', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.volume = 0.4;
    expect(bus.volume).toBe(0.4);
  });

  it('should set muted via setter', () => {
    const bus = new AudioBus(ctx, 'bus');
    bus.muted = true;
    expect(bus.muted).toBe(true);
  });
});
