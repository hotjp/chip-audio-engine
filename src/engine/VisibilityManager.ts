import type { ChipAudioEngine } from './ChipAudioEngine.js';

/**
 * VisibilityManager 在页面隐藏时自动静音，恢复时还原。
 *
 * @example
 * ```ts
 * const vm = new VisibilityManager(engine);
 * vm.enable();
 * ```
 */
export class VisibilityManager implements EventListenerObject {
  private readonly engine: ChipAudioEngine;
  private enabled: boolean = false;
  private previousMuted: boolean = false;
  private wasHidden: boolean = false;

  /**
   * @param engine - ChipAudioEngine 实例
   */
  constructor(engine: ChipAudioEngine) {
    this.engine = engine;
  }

  /**
   * 启用页面隐藏自动静音。
   * @example
   * ```ts
   * vm.enable();
   * ```
   */
  enable(): void {
    if (this.enabled) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    this.enabled = true;
    this.wasHidden = false;
    document.addEventListener('visibilitychange', this);
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
      this.wasHidden = true;
    }
  }

  /**
   * 禁用可见性监控并恢复之前的静音状态。
   * @example
   * ```ts
   * vm.disable();
   * ```
   */
  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this);
    }
    if (this.wasHidden) {
      this.engine.masterMuted = this.previousMuted;
      this.wasHidden = false;
    }
  }

  /**
   * 检查可见性监控是否已激活。
   * @returns 如果已启用则返回 true
   * @example
   * ```ts
   * const active = vm.isEnabled();
   * ```
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 处理 visibilitychange 事件。
   * @param _event - DOM 事件对象
   */
  handleEvent(_event: Event): void {
    if (!this.enabled || typeof document === 'undefined') {
      return;
    }
    if (document.visibilityState === 'hidden') {
      this.previousMuted = this.engine.masterMuted;
      this.engine.masterMuted = true;
      this.wasHidden = true;
    } else {
      this.engine.masterMuted = this.previousMuted;
    }
  }
}
