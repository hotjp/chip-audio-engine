import type { SoundParams } from '../providers/types.js';

/**
 * 音色定义。每个音色是一个不带 frequency 的 SoundParams，
 * 频率由乐谱中的音符提供。
 */
export interface TimbreDefinition {
  provider: string;
  waveforms?: Array<{
    type: OscillatorType | 'noise';
    gain?: number;
    detune?: number;
  }>;
  envelope?: SoundParams['envelope'];
  filter?: SoundParams['filter'];
  volume?: number;
  pitch?: SoundParams['pitch'];
}

/**
 * 音色包，包含一组命名音色。
 */
export interface TimbrePack {
  name: string;
  style?: string;
  description?: string;
  timbres: Record<string, TimbreDefinition>;
}

/**
 * 音色包加载器，管理多个音色包的注册与激活。
 *
 * @example
 * ```ts
 * const loader = new TimbrePackLoader();
 * loader.register({ name: '16bit-sfc', timbres: { lead: { provider: 'oscillator' } } });
 * loader.setActive('16bit-sfc');
 * const timbre = loader.getTimbre('lead');
 * ```
 */
export class TimbrePackLoader {
  private packs: Map<string, TimbrePack> = new Map();
  private activePackName: string | null = null;

  /**
   * 注册音色包。若已存在同名包则覆盖。
   * @param pack - 音色包对象
   * @example
   * ```ts
   * loader.register({ name: '16bit-sfc', timbres: {} });
   * ```
   */
  register(pack: TimbrePack): void {
    this.packs.set(pack.name, pack);
  }

  /**
   * 切换到指定音色包。
   * @param name - 音色包名称
   * @returns 如果成功切换则返回 true，未注册则返回 false
   * @example
   * ```ts
   * const ok = loader.setActive('16bit-sfc');
   * ```
   */
  setActive(name: string): boolean {
    if (!this.packs.has(name)) {
      return false;
    }
    this.activePackName = name;
    return true;
  }

  /**
   * 从当前激活的包中获取音色定义。
   * @param timbreName - 音色名称
   * @returns 音色定义，若不存在则返回 undefined
   * @example
   * ```ts
   * const timbre = loader.getTimbre('lead');
   * ```
   */
  getTimbre(timbreName: string): TimbreDefinition | undefined {
    if (!this.activePackName) {
      return undefined;
    }
    const pack = this.packs.get(this.activePackName);
    if (!pack) {
      return undefined;
    }
    return pack.timbres[timbreName];
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
   * 列出当前激活包中的所有音色名称。
   * @returns 音色名称数组
   * @example
   * ```ts
   * const names = loader.listTimbres();
   * ```
   */
  listTimbres(): string[] {
    if (!this.activePackName) {
      return [];
    }
    const pack = this.packs.get(this.activePackName);
    return pack ? Object.keys(pack.timbres) : [];
  }
}
