import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../src/core/EventEmitter.js';

describe('EventEmitter', () => {
  it('should register and emit event handler', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    emitter.on('test', handler);
    emitter.emit('test', 'payload');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('payload');
  });

  it('should remove handler via off', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    emitter.on('test', handler);
    emitter.off('test', handler);
    emitter.emit('test', 'payload');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove handler via unsubscribe function', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    const unsubscribe = emitter.on('test', handler);
    unsubscribe();
    emitter.emit('test', 'payload');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should call once handler only one time', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    emitter.once('test', handler);
    emitter.emit('test', 'first');
    emitter.emit('test', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('should allow unsubscribing a once handler before emit', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    const unsubscribe = emitter.once('test', handler);
    unsubscribe();
    emitter.emit('test', 'payload');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers for same event', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on('test', handler1);
    emitter.on('test', handler2);
    emitter.emit('test', 'payload');
    expect(handler1).toHaveBeenCalledWith('payload');
    expect(handler2).toHaveBeenCalledWith('payload');
  });

  it('should isolate errors in handlers', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const badHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const goodHandler = vi.fn();
    emitter.on('test', badHandler);
    emitter.on('test', goodHandler);
    expect(() => emitter.emit('test', 'payload')).not.toThrow();
    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });

  it('should not throw when emitting event with no handlers', () => {
    const emitter = new EventEmitter<{ test: string }>();
    expect(() => emitter.emit('test', 'payload')).not.toThrow();
  });

  it('should not throw when off is called for unknown event', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = vi.fn();
    expect(() => emitter.off('test', handler)).not.toThrow();
  });

  it('should support different event types', () => {
    const emitter = new EventEmitter<{ a: number; b: { x: number } }>();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    emitter.on('a', handlerA);
    emitter.on('b', handlerB);
    emitter.emit('a', 42);
    emitter.emit('b', { x: 1 });
    expect(handlerA).toHaveBeenCalledWith(42);
    expect(handlerB).toHaveBeenCalledWith({ x: 1 });
  });
});
