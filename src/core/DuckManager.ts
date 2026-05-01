export interface DuckRule {
  trigger: string;
  target: string;
  duckVolume: number;
  fadeOutMs: number;
  fadeInMs: number;
  holdMs: number;
}

interface DuckTargetState {
  originalVolume: number;
  activeCount: number;
}

export class DuckManager {
  private rules: DuckRule[] = [];
  private triggerCounts: Map<string, number> = new Map();
  private targetStates: Map<string, DuckTargetState> = new Map();

  /** Register a ducking rule. */
  addRule(rule: DuckRule): void {
    this.rules.push(rule);
  }

  /** Remove a ducking rule by trigger and target. */
  removeRule(trigger: string, target: string): void {
    const hadRule = this.rules.some(
      (r) => r.trigger === trigger && r.target === target
    );
    if (!hadRule) {
      return;
    }

    this.rules = this.rules.filter(
      (r) => !(r.trigger === trigger && r.target === target)
    );

    const stillReferencedTarget = this.rules.some((r) => r.target === target);
    if (!stillReferencedTarget) {
      this.targetStates.delete(target);
    }

    const stillReferencedTrigger = this.rules.some((r) => r.trigger === trigger);
    if (!stillReferencedTrigger) {
      // Note: if the trigger is currently active, its count is not decremented
      // here; this is a known limitation of dynamic rule removal.
      this.triggerCounts.delete(trigger);
    }
  }

  /** Get all rules where the given sound is the trigger. */
  getDuckRules(soundId: string): DuckRule[] {
    return this.rules.filter((r) => r.trigger === soundId);
  }

  /** Signal that a trigger sound has started playing. */
  setActive(soundId: string): void {
    // Invariant: matchingRules must remain stable between setActive and
    // clearActive calls for the same trigger, otherwise activeCount will drift.
    const matchingRules = this.getDuckRules(soundId);
    if (matchingRules.length === 0) {
      return;
    }

    const count = this.triggerCounts.get(soundId) ?? 0;
    this.triggerCounts.set(soundId, count + 1);

    for (const rule of matchingRules) {
      const state = this.targetStates.get(rule.target);
      if (state) {
        state.activeCount++;
      } else {
        this.targetStates.set(rule.target, {
          originalVolume: 1,
          activeCount: 1,
        });
      }
    }
  }

  /** Signal that a trigger sound has stopped playing. */
  clearActive(soundId: string): void {
    const count = this.triggerCounts.get(soundId) ?? 0;
    if (count <= 1) {
      this.triggerCounts.delete(soundId);
    } else {
      this.triggerCounts.set(soundId, count - 1);
    }

    const matchingRules = this.getDuckRules(soundId);
    for (const rule of matchingRules) {
      const state = this.targetStates.get(rule.target);
      if (state) {
        state.activeCount--;
        if (state.activeCount <= 0) {
          this.targetStates.delete(rule.target);
        }
      }
    }
  }

  /** Check whether a target bus is currently ducked. */
  isDucked(target: string): boolean {
    const state = this.targetStates.get(target);
    return state !== undefined && state.activeCount > 0;
  }

  getOriginalVolume(target: string): number {
    return this.targetStates.get(target)?.originalVolume ?? 1;
  }

  setOriginalVolume(target: string, volume: number): void {
    const state = this.targetStates.get(target);
    if (state) {
      state.originalVolume = volume;
    }
  }

  /** Reset all rules and active states. */
  clearAll(): void {
    this.rules = [];
    this.triggerCounts.clear();
    this.targetStates.clear();
  }
}
