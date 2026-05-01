import type { SoundParams } from '../providers/types.js';

/**
 * 音效包条目，描述单个音效的参数。
 * @example
 * ```ts
 * const entry: SoundPackEntry = {
 *   provider: 'oscillator',
 *   waveforms: [{ type: 'sine', frequency: 440 }],
 *   duration: 100,
 * };
 * ```
 */
export interface SoundPackEntry {
  provider?: string;
  waveforms?: SoundParams['waveforms'];
  envelope?: SoundParams['envelope'];
  filter?: SoundParams['filter'];
  volume?: number;
  duration?: number;
  pitch?: SoundParams['pitch'];
}

/**
 * 音效包，包含一组音效的集合。
 * @example
 * ```ts
 * const pack: SoundPack = {
 *   name: 'sfx',
 *   style: 'pixel',
 *   sounds: {
 *     'ui.click': { duration: 50, waveforms: [{ type: 'square', frequency: 880 }] },
 *   },
 * };
 * ```
 */
export interface SoundPack {
  name: string;
  style?: string;
  sounds: Record<string, SoundPackEntry>;
}

/**
 * 音效包加载器，管理多个音效包的注册与激活。
 *
 * @example
 * ```ts
 * const loader = new SoundPackLoader();
 * loader.register({ name: 'default', sounds: { 'ui.click': { duration: 100 } } });
 * loader.setActive('default');
 * const params = loader.getSound('ui.click');
 * ```
 */
export class SoundPackLoader {
  private packs: Map<string, SoundPack> = new Map();
  private activePackName: string | null = null;
  private soundCache: Map<string, SoundParams> = new Map();

  /**
   * 注册音效包。若已存在同名包则覆盖。
   * @param pack - 音效包对象
   * @example
   * ```ts
   * loader.register({ name: 'sfx', sounds: {} });
   * ```
   */
  register(pack: SoundPack): void {
    this.packs.set(pack.name, pack);
    if (this.activePackName === pack.name) {
      this.soundCache.clear();
    }
  }

  /**
   * 切换到指定音效包。
   * @param packName - 音效包名称
   * @returns 如果成功切换则返回 true，未注册则返回 false
   * @example
   * ```ts
   * const ok = loader.setActive('sfx');
   * ```
   */
  setActive(packName: string): boolean {
    if (!this.packs.has(packName)) {
      return false;
    }
    if (this.activePackName !== packName) {
      this.activePackName = packName;
      this.soundCache.clear();
    }
    return true;
  }

  /**
   * 获取合并后的音效播放参数。
   * @param soundId - 音效标识符
   * @returns 合并后的播放参数，若不存在则返回 null
   * @example
   * ```ts
   * const params = loader.getSound('ui.click');
   * if (params) engine.play('ui.click');
   * ```
   */
  getSound(soundId: string): SoundParams | null {
    const cached = this.soundCache.get(soundId);
    if (cached) {
      return cached;
    }
    const entry = this.getSoundEntry(soundId);
    if (!entry) {
      return null;
    }
    const params: SoundParams = {
      waveforms: entry.waveforms,
      envelope: entry.envelope,
      filter: entry.filter,
      volume: entry.volume,
      duration: entry.duration,
      pitch: entry.pitch,
    };
    this.soundCache.set(soundId, params);
    return params;
  }

  /**
   * 从当前激活的包中获取原始条目。
   * @param soundId - 音效标识符
   * @returns 原始条目，若不存在则返回 null
   * @example
   * ```ts
   * const entry = loader.getSoundEntry('ui.click');
   * ```
   */
  getSoundEntry(soundId: string): SoundPackEntry | null {
    if (!this.activePackName) {
      return null;
    }
    const pack = this.packs.get(this.activePackName);
    if (!pack) {
      return null;
    }
    const entry = pack.sounds[soundId] ?? null;
    // Consumers may wish to warn here in debug builds when entry is null.
    return entry;
  }

  /**
   * 列出当前激活包中的所有音效 ID。
   * @returns 音效 ID 数组
   * @example
   * ```ts
   * const ids = loader.listSounds();
   * ```
   */
  listSounds(): string[] {
    if (!this.activePackName) {
      return [];
    }
    const pack = this.packs.get(this.activePackName);
    return pack ? Object.keys(pack.sounds) : [];
  }

  /**
   * 获取当前激活包的名称。
   * @returns 包名称，若未激活则返回 null
   * @example
   * ```ts
   * const name = loader.getActivePackName();
   * ```
   */
  getActivePackName(): string | null {
    return this.activePackName;
  }

  /**
   * 获取所有已注册包的名称列表。
   * @returns 包名称数组
   * @example
   * ```ts
   * const names = loader.getPackNames();
   * ```
   */
  getPackNames(): string[] {
    return Array.from(this.packs.keys());
  }
}
