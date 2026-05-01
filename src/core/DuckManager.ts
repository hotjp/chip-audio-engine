/**
 * 闪避规则：当 trigger 声音播放时，target 总线音量会被降低。
 * @example
 * ```ts
 * const rule: DuckRule = {
 *   trigger: 'bgm',
 *   target: 'sfx',
 *   duckVolume: 0.3,
 *   fadeOutMs: 300,
 *   fadeInMs: 800,
 *   holdMs: 0,
 * };
 * ```
 */
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

/**
 * 闪避管理器，根据规则自动调节目标总线音量。
 *
 * @example
 * ```ts
 * const dm = new DuckManager();
 * dm.addRule({ trigger: 'bgm', target: 'sfx', duckVolume: 0.3, fadeOutMs: 300, fadeInMs: 800, holdMs: 0 });
 * dm.setActive('bgm');
 * ```
 */
export class DuckManager {
  private rules: DuckRule[] = [];
  private triggerCounts: Map<string, number> = new Map();
  private targetStates: Map<string, DuckTargetState> = new Map();

  /**
   * 注册一条闪避规则。
   * @param rule - 闪避规则对象
   * @example
   * ```ts
   * duckManager.addRule({
   *   trigger: 'dialogue',
   *   target: 'music',
   *   duckVolume: 0.2,
   *   fadeOutMs: 200,
   *   fadeInMs: 500,
   *   holdMs: 0,
   * });
   * ```
   */
  addRule(rule: DuckRule): void {
    this.rules.push(rule);
  }

  /**
   * 按 trigger 和 target 移除闪避规则。
   * @param trigger - 触发者标识符
   * @param target - 目标总线标识符
   * @example
   * ```ts
   * duckManager.removeRule('dialogue', 'music');
   * ```
   */
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

  /**
   * 获取指定声音作为 trigger 的所有规则。
   * @param soundId - 声音标识符
   * @returns 匹配的闪避规则数组
   * @example
   * ```ts
   * const rules = duckManager.getDuckRules('bgm');
   * ```
   */
  getDuckRules(soundId: string): DuckRule[] {
    return this.rules.filter((r) => r.trigger === soundId);
  }

  /**
   * 标记 trigger 声音已开始播放。
   * @param soundId - 触发者标识符
   * @example
   * ```ts
   * duckManager.setActive('bgm');
   * ```
   */
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

  /**
   * 标记 trigger 声音已停止播放。
   * @param soundId - 触发者标识符
   * @example
   * ```ts
   * duckManager.clearActive('bgm');
   * ```
   */
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

  /**
   * 检查目标总线是否正在被闪避。
   * @param target - 目标总线标识符
   * @returns 如果目标总线被闪避则返回 true
   * @example
   * ```ts
   * const isDucked = duckManager.isDucked('sfx');
   * ```
   */
  isDucked(target: string): boolean {
    const state = this.targetStates.get(target);
    return state !== undefined && state.activeCount > 0;
  }

  /**
   * 获取目标总线的原始音量。
   * @param target - 目标总线标识符
   * @returns 原始音量值（默认 1）
   * @example
   * ```ts
   * const original = duckManager.getOriginalVolume('sfx');
   * ```
   */
  getOriginalVolume(target: string): number {
    return this.targetStates.get(target)?.originalVolume ?? 1;
  }

  /**
   * 设置目标总线的原始音量。
   * @param target - 目标总线标识符
   * @param volume - 原始音量值
   * @example
   * ```ts
   * duckManager.setOriginalVolume('sfx', 0.8);
   * ```
   */
  setOriginalVolume(target: string, volume: number): void {
    const state = this.targetStates.get(target);
    if (state) {
      state.originalVolume = volume;
    }
  }

  /**
   * 重置所有规则和活跃状态。
   * @example
   * ```ts
   * duckManager.clearAll();
   * ```
   */
  clearAll(): void {
    this.rules = [];
    this.triggerCounts.clear();
    this.targetStates.clear();
  }
}
