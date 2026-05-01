export type FocusMode = 'viewport' | 'follow' | 'zone' | 'legion';

/**
 * 跟随配置。
 * @example
 * ```ts
 * const config: FollowConfig = { target: { x: 100, y: 200 } };
 * ```
 */
export interface FollowConfig {
  target: { x: number; y: number };
}

/**
 * 区域配置。
 * @example
 * ```ts
 * const config: ZoneConfig = { centerX: 100, centerY: 200, radius: 50 };
 * ```
 */
export interface ZoneConfig {
  centerX: number;
  centerY: number;
  radius: number;
}

/**
 * 军团配置。
 * @example
 * ```ts
 * const config: LegionConfig = { targets: [{ x: 10, y: 20 }] };
 * ```
 */
export interface LegionConfig {
  targets: Array<{ x: number; y: number }>;
}

export type FocusConfig = FollowConfig | ZoneConfig | LegionConfig | undefined;

/**
 * 2D 坐标点。
 * @example
 * ```ts
 * const point: Point2D = { x: 32, y: 32 };
 * ```
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 视口描述。
 * @example
 * ```ts
 * const viewport: Viewport = { centerX: 32, centerY: 32, width: 64, height: 64 };
 * ```
 */
export interface Viewport {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * 空间音频计算结果。
 * @example
 * ```ts
 * const result: SpatialResult = { pan: 0.5, distance: 32 };
 * ```
 */
export interface SpatialResult {
  pan: number;
  distance: number;
}

/**
 * FocusManager — 焦点模式状态机
 *
 * 纯计算模块，不依赖 Web Audio API。
 * 根据当前焦点模式将声源位置映射为 pan / distance，
 * 供 SpatialAudio 使用。
 *
 * @example
 * ```ts
 * const fm = new FocusManager();
 * fm.setMode('follow', { target: { x: 100, y: 200 } });
 * const result = fm.computeSpatial({ x: 50, y: 50 }, viewport);
 * ```
 */
export class FocusManager {
  private mode: FocusMode = 'viewport';
  private config: FocusConfig = undefined;

  /**
   * 设置焦点模式与配置。
   * @param mode - 焦点模式
   * @param config - 模式配置
   * @example
   * ```ts
   * fm.setMode('zone', { centerX: 100, centerY: 200, radius: 50 });
   * ```
   */
  setMode(mode: FocusMode, config?: FocusConfig): void {
    this.mode = mode;
    this.config = config;
  }

  /**
   * 获取当前焦点模式。
   * @returns 当前焦点模式
   * @example
   * ```ts
   * const mode = fm.getMode();
   * ```
   */
  getMode(): FocusMode {
    return this.mode;
  }

  /**
   * 获取当前配置。
   * @returns 当前配置
   * @example
   * ```ts
   * const config = fm.getConfig();
   * ```
   */
  getConfig(): FocusConfig {
    return this.config;
  }

  /**
   * 根据当前焦点模式计算空间音频参数。
   * @param soundPos - 声源位置
   * @param viewport - 视口信息
   * @returns pan: [-1, 1]；distance: 欧几里得距离（像素）
   * @example
   * ```ts
   * const { pan, distance } = fm.computeSpatial({ x: 10, y: 20 }, viewport);
   * ```
   */
  computeSpatial(soundPos: Point2D, viewport: Viewport): SpatialResult {
    switch (this.mode) {
      case 'viewport':
        return this.computeViewport(soundPos, viewport);
      case 'follow':
        return this.computeFollow(soundPos, viewport);
      case 'zone':
        return this.computeZone(soundPos, viewport);
      case 'legion':
        return this.computeLegion(viewport);
      default:
        return this.computeViewport(soundPos, viewport);
    }
  }

  private computeViewport(soundPos: Point2D, viewport: Viewport): SpatialResult {
    const halfWidth = viewport.width / 2;
    const pan = Math.max(-1, Math.min(1, (soundPos.x - viewport.centerX) / halfWidth));
    const dx = soundPos.x - viewport.centerX;
    const dy = soundPos.y - viewport.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { pan, distance };
  }

  private computeFollow(soundPos: Point2D, viewport: Viewport): SpatialResult {
    const followConfig = this.config as FollowConfig | undefined;
    const target = followConfig?.target ?? { x: viewport.centerX, y: viewport.centerY };
    const halfWidth = viewport.width / 2;
    const pan = Math.max(-1, Math.min(1, (soundPos.x - target.x) / halfWidth));
    const dx = soundPos.x - target.x;
    const dy = soundPos.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { pan, distance };
  }

  private computeZone(soundPos: Point2D, viewport: Viewport): SpatialResult {
    const zoneConfig = this.config as ZoneConfig | undefined;
    const centerX = zoneConfig?.centerX ?? viewport.centerX;
    const centerY = zoneConfig?.centerY ?? viewport.centerY;
    const halfWidth = viewport.width / 2;
    const pan = Math.max(-1, Math.min(1, (soundPos.x - centerX) / halfWidth));
    const dx = soundPos.x - centerX;
    const dy = soundPos.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { pan, distance };
  }

  private computeLegion(viewport: Viewport): SpatialResult {
    const legionConfig = this.config as LegionConfig | undefined;
    const targets = legionConfig?.targets ?? [];
    const halfWidth = viewport.width / 2;

    if (targets.length === 0) {
      return { pan: 0, distance: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    let sumDist = 0;

    for (const t of targets) {
      sumX += t.x;
      sumY += t.y;
      const dx = t.x - viewport.centerX;
      const dy = t.y - viewport.centerY;
      sumDist += Math.sqrt(dx * dx + dy * dy);
    }

    const avgX = sumX / targets.length;
    const avgDist = sumDist / targets.length;

    const pan = Math.max(-1, Math.min(1, (avgX - viewport.centerX) / halfWidth));

    return { pan, distance: avgDist };
  }
}
