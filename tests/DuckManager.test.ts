import { describe, it, expect } from 'vitest';
import { DuckManager, DuckRule } from '../src/core/DuckManager.js';

describe('DuckManager', () => {
  it('should add and retrieve rules', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    expect(dm.getDuckRules('sfx')).toHaveLength(1);
  });

  it('should remove rule by trigger and target', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.removeRule('sfx', 'music');
    expect(dm.getDuckRules('sfx')).toHaveLength(0);
  });

  it('should track active state', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    expect(dm.isDucked('music')).toBe(true);
  });

  it('should clear active state', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    dm.clearActive('sfx');
    expect(dm.isDucked('music')).toBe(false);
  });

  it('should return default original volume', () => {
    const dm = new DuckManager();
    expect(dm.getOriginalVolume('music')).toBe(1);
  });

  it('should set and get original volume', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    dm.setOriginalVolume('music', 0.8);
    expect(dm.getOriginalVolume('music')).toBe(0.8);
  });

  it('should handle multiple active triggers', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    dm.setActive('sfx');
    dm.clearActive('sfx');
    expect(dm.isDucked('music')).toBe(true);
    dm.clearActive('sfx');
    expect(dm.isDucked('music')).toBe(false);
  });

  it('should not duck when no matching rule', () => {
    const dm = new DuckManager();
    dm.setActive('unknown');
    expect(dm.isDucked('music')).toBe(false);
  });

  it('should clear all rules and states', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    dm.clearAll();
    expect(dm.getDuckRules('sfx')).toHaveLength(0);
    expect(dm.isDucked('music')).toBe(false);
  });

  it('should remove target state when last rule removed', () => {
    const dm = new DuckManager();
    const rule: DuckRule = { trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 };
    dm.addRule(rule);
    dm.setActive('sfx');
    dm.removeRule('sfx', 'music');
    expect(dm.isDucked('music')).toBe(false);
  });

  it('should keep target state when other active rules remain', () => {
    const dm = new DuckManager();
    dm.addRule({ trigger: 'sfx', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 });
    dm.addRule({ trigger: 'voice', target: 'music', duckVolume: 0.3, fadeOutMs: 100, fadeInMs: 200, holdMs: 50 });
    dm.setActive('sfx');
    dm.setActive('voice');
    dm.clearActive('sfx');
    expect(dm.isDucked('music')).toBe(true);
  });

  it('should not throw on clearActive for unknown trigger', () => {
    const dm = new DuckManager();
    expect(() => dm.clearActive('unknown')).not.toThrow();
  });
});
