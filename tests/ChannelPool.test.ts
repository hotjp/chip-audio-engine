import { describe, it, expect } from 'vitest';
import { ChannelPool } from '../src/core/ChannelPool.js';

describe('ChannelPool', () => {
  it('should allocate a free channel', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 1 });
    const id = pool.allocate('sound1', 1);
    expect(id).not.toBeNull();
  });

  it('should release a channel', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 1 });
    const id = pool.allocate('sound1', 1);
    pool.release(id!);
    expect(pool.isInUse(id!)).toBe(false);
  });

  it('should respect maxChannels limit', () => {
    const pool = new ChannelPool({ maxChannels: 2, reservedChannels: 0 });
    pool.allocate('a', 1);
    pool.allocate('b', 1);
    const id = pool.allocate('c', 1);
    expect(id).toBeNull();
  });

  it('should preempt lower priority sound', () => {
    const pool = new ChannelPool({ maxChannels: 2, reservedChannels: 0 });
    pool.allocate('low', 1);
    const id = pool.allocate('high', 5);
    expect(id).not.toBeNull();
  });

  it('should reject allocation when priority is not higher than lowest', () => {
    const pool = new ChannelPool({ maxChannels: 2, reservedChannels: 0 });
    pool.allocate('existing', 5);
    pool.allocate('existing2', 5);
    const id = pool.allocate('new', 5);
    expect(id).toBeNull();
  });

  it('should return correct used count', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 0 });
    pool.allocate('a', 1);
    pool.allocate('b', 2);
    expect(pool.getUsedCount()).toBe(2);
  });

  it('should return correct free count', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 0 });
    pool.allocate('a', 1);
    expect(pool.getFreeCount()).toBe(3);
  });

  it('should allocate reserved channels separately', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 2 });
    const id = pool.allocateReserved('reserved1');
    expect(id).not.toBeNull();
    expect(id).toBeLessThan(2);
  });

  it('should release all channels', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 0 });
    pool.allocate('a', 1);
    pool.allocate('b', 2);
    pool.releaseAll();
    expect(pool.getUsedCount()).toBe(0);
    expect(pool.getFreeCount()).toBe(4);
  });

  it('should validate maxChannels is positive integer', () => {
    expect(() => new ChannelPool({ maxChannels: 0 })).toThrow('positive integer');
    expect(() => new ChannelPool({ maxChannels: -1 })).toThrow('positive integer');
  });

  it('should validate reservedChannels is non-negative', () => {
    expect(() => new ChannelPool({ maxChannels: 4, reservedChannels: -1 })).toThrow('non-negative integer');
  });

  it('should validate reservedChannels does not exceed maxChannels', () => {
    expect(() => new ChannelPool({ maxChannels: 2, reservedChannels: 3 })).toThrow('cannot exceed');
  });

  it('should return maxChannels', () => {
    const pool = new ChannelPool({ maxChannels: 6, reservedChannels: 1 });
    expect(pool.getMaxChannels()).toBe(6);
  });

  it('should handle release of invalid channel id gracefully', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 0 });
    expect(() => pool.release(-1)).not.toThrow();
    expect(() => pool.release(10)).not.toThrow();
  });

  it('should report in use correctly for out of range ids', () => {
    const pool = new ChannelPool({ maxChannels: 4, reservedChannels: 0 });
    expect(pool.isInUse(-1)).toBe(false);
    expect(pool.isInUse(10)).toBe(false);
  });

  it('should use default values when options omitted', () => {
    const pool = new ChannelPool();
    expect(pool.getMaxChannels()).toBe(8);
    expect(pool.getFreeCount()).toBe(8);
  });
});
