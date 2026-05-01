import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aggregator } from '../src/core/Aggregator.js';

describe('Aggregator', () => {
  let aggregator: Aggregator;

  beforeEach(() => {
    aggregator = new Aggregator();
  });

  afterEach(() => {
    aggregator.reset();
    vi.useRealTimers();
  });

  it('should allow submit with default restart strategy', () => {
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should allow submit after setConfig with restart', () => {
    aggregator.setConfig('s1', { strategy: 'restart' });
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should arpeggio strategy allow first submit and block rapid submits', () => {
    aggregator.setConfig('s1', { strategy: 'arpeggio', windowMs: 200 });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });

  it('should arpeggio strategy allow submit after window passes', () => {
    vi.useFakeTimers();
    aggregator.setConfig('s1', { strategy: 'arpeggio', windowMs: 100 });
    expect(aggregator.submit('s1', 0)).toBe(true);
    vi.advanceTimersByTime(150);
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should stack strategy allow submits up to maxQueueDepth', () => {
    aggregator.setConfig('s1', { strategy: 'stack', windowMs: 100, maxQueueDepth: 2 });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });

  it('should stack strategy reset after window', () => {
    vi.useFakeTimers();
    aggregator.setConfig('s1', { strategy: 'stack', windowMs: 100, maxQueueDepth: 2 });
    aggregator.submit('s1', 0);
    aggregator.submit('s1', 0);
    vi.advanceTimersByTime(150);
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should debounce strategy allow first submit and block subsequent', () => {
    vi.useFakeTimers();
    aggregator.setConfig('s1', { strategy: 'debounce', windowMs: 150 });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });

  it('should debounce strategy allow submit after window expires', () => {
    vi.useFakeTimers();
    aggregator.setConfig('s1', { strategy: 'debounce', windowMs: 100 });
    expect(aggregator.submit('s1', 0)).toBe(true);
    vi.advanceTimersByTime(150);
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should use default config when no specific config set', () => {
    aggregator.setDefaultConfig({ strategy: 'stack', windowMs: 50, maxQueueDepth: 1 });
    expect(aggregator.submit('unknown', 0)).toBe(true);
    expect(aggregator.submit('unknown', 0)).toBe(false);
  });

  it('should reset clear all states', () => {
    aggregator.setConfig('s1', { strategy: 'arpeggio', windowMs: 200 });
    aggregator.submit('s1', 0);
    aggregator.reset();
    expect(aggregator.submit('s1', 0)).toBe(true);
  });

  it('should remove all per-sound configs', () => {
    aggregator.setConfig('s1', { strategy: 'arpeggio', windowMs: 200 });
    aggregator.setConfig('s2', { strategy: 'stack', windowMs: 100, maxQueueDepth: 2 });
    aggregator.removeAllConfigs();
    // After removing all configs, sounds should fall back to default (restart)
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s2', 0)).toBe(true);
    expect(aggregator.submit('s2', 0)).toBe(true);
  });

  it('should use default windowMs for arpeggio', () => {
    aggregator.setConfig('s1', { strategy: 'arpeggio' });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });

  it('should use default windowMs and maxQueueDepth for stack', () => {
    aggregator.setConfig('s1', { strategy: 'stack' });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });

  it('should use default windowMs for debounce', () => {
    vi.useFakeTimers();
    aggregator.setConfig('s1', { strategy: 'debounce' });
    expect(aggregator.submit('s1', 0)).toBe(true);
    expect(aggregator.submit('s1', 0)).toBe(false);
  });
});
