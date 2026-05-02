import type { PlayParams } from '../providers/types.js';
import type { SoundProvider, SoundInstance } from '../providers/SoundProvider.js';
import { OscillatorProvider } from '../providers/OscillatorProvider.js';
import { AudioBus } from '../core/AudioBus.js';
import { ChannelPool } from '../core/ChannelPool.js';
import { Aggregator, AggregationConfig } from '../core/Aggregator.js';
import { DuckManager, DuckRule } from '../core/DuckManager.js';
import { SoundPackLoader, SoundPack } from '../config/SoundPackLoader.js';
import { TimbrePackLoader } from '../config/TimbrePackLoader.js';
import type { TimbrePack } from '../config/TimbrePackLoader.js';
import { EventEmitter } from '../core/EventEmitter.js';
import { BGMEngine } from './BGMEngine.js';
import type { EngineEvents, BGMScore, Score } from './types.js';
import { ReverbEngine, ReverbParams } from '../effects/ReverbEngine.js';
import { SpatialAudio } from '../effects/SpatialAudio.js';
import { V2Compiler } from '../music/V2Compiler.js';
import { FocusManager } from '../core/FocusManager.js';
import type { FocusMode, FocusConfig } from '../core/FocusManager.js';

export interface EngineConfig {
  audioContext?: AudioContext;
  channelCount?: number;
  soundPack?: SoundPack;
  bgmScores?: BGMScore[];
}

interface ActiveSound {
  instance: SoundInstance;
  channelId: number;
  timeoutId: ReturnType<typeof setTimeout>;
  spatial?: SpatialAudio;
}

/**
 * ChipAudioEngine 是浏览器端音频引擎的主入口，负责管理音频上下文、
 * 总线树、声道池、音效播放、BGM 播放以及闪避和聚合策略。
 *
 * @example
 * ```ts
 * const engine = new ChipAudioEngine({
 *   soundPack: { name: 'default', sounds: { 'ui.click': { duration: 100 } } },
 * });
 * engine.init();
 * engine.play('ui.click');
 * ```
 */
export class ChipAudioEngine extends EventEmitter<EngineEvents> {
  private ctx: AudioContext | null = null;
  private ownsContext: boolean = false;
  private masterBus: AudioBus | null = null;
  private channelPool: ChannelPool | null = null;
  private aggregator: Aggregator;
  private duckManager: DuckManager;
  private soundPackLoader: SoundPackLoader;
  private timbrePackLoader: TimbrePackLoader;
  private providers: Map<string, SoundProvider> = new Map();
  private activeSounds: Map<string, ActiveSound> = new Map();
  private config: EngineConfig;
  private destroyed: boolean = false;
  private bgmEngine: BGMEngine | null = null;
  private reverbEngine: ReverbEngine | null = null;
  private focusManager: FocusManager = new FocusManager();

  /**
   * @param config - 引擎初始化配置
   * @example
   * ```ts
   * const engine = new ChipAudioEngine({
   *   audioContext: new AudioContext(),
   *   channelCount: 16,
   *   soundPack: { name: 'sfx', sounds: {} },
   * });
   * ```
   */
  constructor(config: EngineConfig = {}) {
    super();
    this.config = config;
    this.aggregator = new Aggregator();
    this.duckManager = new DuckManager();
    this.soundPackLoader = new SoundPackLoader();
    this.timbrePackLoader = new TimbrePackLoader();

    if (config.soundPack) {
      this.soundPackLoader.register(config.soundPack);
      this.soundPackLoader.setActive(config.soundPack.name);
    }
  }

  /**
   * 初始化音频上下文和内部总线树。可重复调用（幂等）。
   * @example
   * ```ts
   * const engine = new ChipAudioEngine();
   * engine.init();
   * ```
   */
  init(): void {
    if (this.destroyed || this.ctx) {
      return;
    }
    if (this.config.audioContext) {
      this.ctx = this.config.audioContext;
      this.ownsContext = false;
    } else {
      this.ctx = new AudioContext();
      this.ownsContext = true;
    }

    this.initBusTree();

    this.reverbEngine = new ReverbEngine(this.ctx);
    const masterBus = this.masterBus;
    const musicBus = masterBus?.getBus('music');
    if (musicBus && this.reverbEngine && masterBus) {
      musicBus.output.connect(this.reverbEngine.input);
      this.reverbEngine.output.connect(masterBus.input);
    }

    this.duckManager.addRule({
      trigger: 'bgm',
      target: 'sfx',
      duckVolume: 0.3,
      fadeOutMs: 300,
      fadeInMs: 800,
      holdMs: 0,
    });
    this.duckManager.addRule({
      trigger: 'bgm',
      target: 'ui',
      duckVolume: 0.3,
      fadeOutMs: 300,
      fadeInMs: 800,
      holdMs: 0,
    });

    this.channelPool = new ChannelPool({
      maxChannels: this.config.channelCount ?? 8,
    });

    const oscProvider = new OscillatorProvider();
    this.providers.set(oscProvider.id, oscProvider);

    if (musicBus) {
      this.bgmEngine = new BGMEngine(this.ctx, oscProvider, musicBus, this.duckManager, this.timbrePackLoader);
      this.bgmEngine.on('bgm:start', (payload) => this.emit('bgm:start', payload));
      this.bgmEngine.on('bgm:stop', (payload) => this.emit('bgm:stop', payload));
      if (this.config.bgmScores) {
        this.bgmEngine.loadScores(this.config.bgmScores);
      }
    }

    this.emit('engine:init', { audioContext: this.ctx });
  }

  /**
   * 设置声音焦点模式。
   * @param mode - 焦点模式（viewport / follow / zone / legion）
   * @param config - 模式配置
   * @example
   * ```ts
   * engine.setFocusMode('follow', { target: { x: 100, y: 200 } });
   * ```
   */
  setFocusMode(mode: FocusMode, config?: FocusConfig): void {
    this.focusManager.setMode(mode, config);
    this.emit('focus:change', { mode, config });
  }

  /**
   * 获取当前焦点模式。
   * @returns 当前焦点模式
   * @example
   * ```ts
   * const mode = engine.getFocusMode();
   * ```
   */
  getFocusMode(): FocusMode {
    return this.focusManager.getMode();
  }

  private initBusTree(): void {
    if (!this.ctx) {
      return;
    }
    this.masterBus = new AudioBus(this.ctx, 'master');
    const musicBus = new AudioBus(this.ctx, 'music');
    const sfxBus = new AudioBus(this.ctx, 'sfx');
    const uiBus = new AudioBus(this.ctx, 'ui');
    const gameplayBus = new AudioBus(this.ctx, 'gameplay');

    this.masterBus.addBus(musicBus);
    this.emit('bus:add', { parentId: 'master', busId: 'music' });
    this.masterBus.addBus(sfxBus);
    this.emit('bus:add', { parentId: 'master', busId: 'sfx' });
    sfxBus.addBus(uiBus);
    this.emit('bus:add', { parentId: 'sfx', busId: 'ui' });
    sfxBus.addBus(gameplayBus);
    this.emit('bus:add', { parentId: 'sfx', busId: 'gameplay' });

    this.masterBus.output.connect(this.ctx.destination);
  }

  /**
   * 播放指定音效。
   * @param soundId - 音效标识符
   * @param playParams - 可选的播放覆盖参数
   * @example
   * ```ts
   * engine.play('game.jump', { volume: 0.8, pitch: 1.2 });
   * ```
   */
  play(soundId: string, playParams?: PlayParams): void {
    if (this.destroyed || !this.ctx || !this.masterBus || !this.channelPool) {
      return;
    }

    const soundParams = this.soundPackLoader.getSound(soundId);
    if (!soundParams) {
      return;
    }

    if (!this.aggregator.submit(soundId, 0)) {
      return;
    }

    const provider = this.resolveProvider(soundId);
    if (!provider) {
      return;
    }

    const bus = this.resolveBus(soundId);
    if (!bus) {
      return;
    }

    const channelId = this.channelPool.allocate(soundId, 0);
    if (channelId === null) {
      return;
    }

    // Capture the old active sound with the same id before we overwrite it.
    const oldActive = this.activeSounds.get(soundId);

    // If another active sound was preempted from this channel, note it
    // without mutating activeSounds during iteration.
    const preempted = Array.from(this.activeSounds.entries()).find(
      ([otherSoundId, active]) => active.channelId === channelId && otherSoundId !== soundId
    );

    const instance = provider.createSound(this.ctx, soundId, soundParams);

    const when = this.ctx.currentTime;
    const spatial = this.startSound(soundId, instance, bus, when, playParams);

    const durationMs = soundParams.duration ?? 300;
    const delayMs = Math.max(0, (playParams?.delay ?? 0) * 1000);
    const timeoutId = setTimeout(() => {
      this.disposeSound(soundId, 'completed');
    }, durationMs + delayMs + 100);

    this.activeSounds.set(soundId, {
      instance,
      channelId,
      timeoutId,
      spatial,
    });

    this.emit('play', { soundId, channelId });

    // Dispose the old instance of the same sound after the new state is set,
    // so that listeners observing activeSounds during the 'stop' event see
    // the new sound already registered.
    if (oldActive) {
      clearTimeout(oldActive.timeoutId);
      oldActive.instance.stop(this.ctx.currentTime);
      oldActive.instance.dispose();
      if (oldActive.spatial) {
        oldActive.spatial.dispose();
      }
      if (oldActive.channelId !== channelId) {
        this.channelPool.release(oldActive.channelId);
      }
      this.clearDucking(soundId);
      this.emit('stop', { soundId, reason: 'stolen' });
    }

    if (preempted) {
      this.disposeSound(preempted[0], 'stolen', false);
    }
  }

  /**
   * 停止指定音效（如果正在播放）。
   * @param soundId - 音效标识符
   * @example
   * ```ts
   * engine.stop('game.jump');
   * ```
   */
  stop(soundId: string): void {
    this.stopIfActive(soundId, 'manual');
  }

  /**
   * 停止所有正在播放的音效。
   * @example
   * ```ts
   * engine.stopAll();
   * ```
   */
  stopAll(): void {
    const soundIds = Array.from(this.activeSounds.keys());
    for (const soundId of soundIds) {
      this.disposeSound(soundId, 'manual');
    }
  }

  /**
   * 销毁引擎，停止所有声音，并关闭自有的音频上下文。可重复调用（幂等）。
   * @example
   * ```ts
   * engine.destroy();
   * ```
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stopAll();
    this.activeSounds.clear();

    if (this.reverbEngine) {
      this.reverbEngine.dispose();
      this.reverbEngine = null;
    }

    if (this.masterBus) {
      this.masterBus.output.disconnect();
      this.masterBus = null;
    }

    if (this.ownsContext && this.ctx && this.ctx.state !== 'closed') {
      Promise.resolve(this.ctx.close()).catch(() => {});
    }
    this.ctx = null;

    if (this.bgmEngine) {
      this.bgmEngine.dispose();
      this.bgmEngine = null;
    }

    this.channelPool = null;
    this.providers.clear();
    this.aggregator.reset();
    this.duckManager.clearAll();
    this.activeSounds.clear();

    this.emit('engine:destroy', {});
  }

  /**
   * 暂停自有的音频上下文。
   * @example
   * ```ts
   * engine.suspend();
   * ```
   */
  suspend(): void {
    if (this.ctx && this.ownsContext) {
      Promise.resolve(this.ctx.suspend()).catch(() => {});
    }
    this.emit('engine:suspend', {});
  }

  /**
   * 恢复自有的音频上下文。
   * @example
   * ```ts
   * engine.resume();
   * ```
   */
  resume(): void {
    if (this.ctx && this.ownsContext) {
      Promise.resolve(this.ctx.resume()).catch(() => {});
    }
    this.emit('engine:resume', {});
  }

  /**
   * 检查自有的音频上下文是否处于暂停状态。
   * @returns 如果已暂停则返回 true
   * @example
   * ```ts
   * if (engine.isSuspended()) {
   *   engine.resume();
   * }
   * ```
   */
  isSuspended(): boolean {
    return this.ctx?.state === 'suspended';
  }

  /**
   * 注册自定义音效提供者。
   * @param provider - 音效提供者实例
   * @example
   * ```ts
   * engine.registerProvider(new CustomProvider());
   * ```
   */
  registerProvider(provider: SoundProvider): void {
    this.providers.set(provider.id, provider);
    this.emit('provider:register', { providerId: provider.id });
  }

  /**
   * 加载并激活音效包。
   * @param pack - 音效包对象
   * @example
   * ```ts
   * engine.loadSoundPack({
   *   name: 'pixel-sfc',
   *   sounds: { 'ui.click': { duration: 50 } },
   * });
   * ```
   */
  loadSoundPack(pack: SoundPack): void {
    this.soundPackLoader.register(pack);
    this.soundPackLoader.setActive(pack.name);
    this.emit('pack:load', {
      packName: pack.name,
      soundCount: Object.keys(pack.sounds).length,
    });
  }

  /**
   * 加载音色包。
   * @param pack - 音色包对象
   * @example
   * ```ts
   * engine.loadTimbrePack({
   *   name: 'pixel-sfc',
   *   timbres: { lead: { provider: 'oscillator', waveforms: [{ type: 'square' }] } },
   * });
   * ```
   */
  loadTimbrePack(pack: TimbrePack): void {
    this.timbrePackLoader.register(pack);
    this.timbrePackLoader.setActive(pack.name);
  }

  /**
   * 加载新格式乐谱。
   * @param score - 乐谱对象
   * @example
   * ```ts
   * engine.loadScore({ id: 'title', name: 'Title', bpm: 120, timbrePack: 'pixel-sfc', tracks: [] });
   * ```
   */
  loadScore(score: Score): void {
    if (!this.bgmEngine) return;
    this.bgmEngine.loadNewScore(score);
  }

  /**
   * 按 ID 查找总线（递归查找）。
   * @param busId - 总线标识符
   * @returns 找到的总线，若不存在则返回 undefined
   * @example
   * ```ts
   * const musicBus = engine.getBus('music');
   * ```
   */
  getBus(busId: string): AudioBus | undefined {
    return this.masterBus?.getBus(busId);
  }

  /**
   * 获取主输出总线。
   * @returns 主总线实例，若未初始化则返回 null
   * @example
   * ```ts
   * const master = engine.getMasterBus();
   * ```
   */
  getMasterBus(): AudioBus | null {
    return this.masterBus;
  }

  /**
   * 按 ID 播放 BGM 乐谱。
   * @param scoreId - BGM 乐谱标识符
   * @param options - 可选的淡入时长（毫秒）
   * @example
   * ```ts
   * engine.playBGM('title', { fadeIn: 500 });
   * ```
   */
  playBGM(scoreId: string, options?: { fadeIn?: number }): void {
    if (!this.bgmEngine) {
      return;
    }
    this.bgmEngine.play(scoreId, options);
  }

  /**
   * 停止当前播放的 BGM。
   * @param options - 可选的淡出时长（毫秒）
   * @example
   * ```ts
   * engine.stopBGM({ fadeOut: 800 });
   * ```
   */
  stopBGM(options?: { fadeOut?: number }): void {
    if (!this.bgmEngine) {
      return;
    }
    this.bgmEngine.stop(options);
  }

  /**
   * 获取 BGM 引擎实例。
   * @returns BGMEngine 实例，若未初始化则返回 null
   * @example
   * ```ts
   * const bgm = engine.getBGMEngine();
   * ```
   */
  getBGMEngine(): BGMEngine | null {
    return this.bgmEngine;
  }

  /**
   * 获取 V2Compiler 实例。
   * @returns V2Compiler 实例
   * @example
   * ```ts
   * const compiler = engine.getV2Compiler();
   * const score = compiler!.compile(v2Score);
   * ```
   */
  getV2Compiler(): V2Compiler | null {
    return new V2Compiler();
  }

  /**
   * 添加闪避规则。
   * @param rule - 闪避规则对象
   * @example
   * ```ts
   * engine.addDuckRule({
   *   trigger: 'bgm',
   *   target: 'sfx',
   *   duckVolume: 0.3,
   *   fadeOutMs: 300,
   *   fadeInMs: 800,
   *   holdMs: 0,
   * });
   * ```
   */
  addDuckRule(rule: DuckRule): void {
    this.duckManager.addRule(rule);
  }

  /**
   * 为指定音效配置聚合行为。
   * @param soundId - 音效标识符
   * @param config - 聚合配置
   * @example
   * ```ts
   * engine.setAggregation('ui.click', { strategy: 'debounce', windowMs: 150 });
   * ```
   */
  setAggregation(soundId: string, config: AggregationConfig): void {
    this.aggregator.setConfig(soundId, config);
  }

  /**
   * 获取主总线音量。
   * @returns 当前主音量（0–1），未初始化时返回 1
   * @example
   * ```ts
   * const vol = engine.masterVolume;
   * ```
   */
  get masterVolume(): number {
    return this.masterBus?.volume ?? 1;
  }

  /**
   * 设置主总线音量。
   * @param value - 目标音量（0–1）
   * @example
   * ```ts
   * engine.masterVolume = 0.75;
   * ```
   */
  set masterVolume(value: number) {
    if (this.masterBus) {
      this.masterBus.volume = value;
      this.emit('bus:volume', { busId: 'master', volume: value });
    }
  }

  /**
   * 获取主总线静音状态。
   * @returns 如果主总线已静音则返回 true
   * @example
   * ```ts
   * const muted = engine.masterMuted;
   * ```
   */
  get masterMuted(): boolean {
    return this.masterBus?.muted ?? false;
  }

  /**
   * 设置主总线静音状态。
   * @param value - 是否静音
   * @example
   * ```ts
   * engine.masterMuted = true;
   * ```
   */
  set masterMuted(value: boolean) {
    if (this.masterBus && this.masterBus.muted !== value) {
      this.masterBus.muted = value;
      this.emit('bus:mute', { busId: 'master', muted: value });
    }
  }

  /**
   * 切换混响预设（room / hall / plate）。
   * @param preset - 预设名称
   * @example
   * ```ts
   * engine.setReverb('hall');
   * ```
   */
  setReverb(preset: string): void {
    this.reverbEngine?.setPreset(preset);
  }

  /**
   * 微调当前混响参数。
   * @param params - 混响参数
   * @example
   * ```ts
   * engine.setReverbParams({ wetMix: 0.4, decayTime: 300 });
   * ```
   */
  setReverbParams(params: ReverbParams): void {
    this.reverbEngine?.setParams(params);
  }

  private resolveProvider(soundId: string): SoundProvider | undefined {
    const entry = this.soundPackLoader.getSoundEntry(soundId);
    const providerId = entry?.provider ?? 'oscillator';
    return this.providers.get(providerId);
  }

  private resolveBus(soundId: string): AudioBus | undefined {
    if (!this.masterBus) {
      return undefined;
    }
    if (soundId.startsWith('ui.')) {
      return this.masterBus.getBus('ui');
    } else if (soundId.startsWith('game.')) {
      return this.masterBus.getBus('gameplay');
    } else if (soundId.startsWith('bgm.') || soundId.startsWith('music.')) {
      return this.masterBus.getBus('music');
    }
    return this.masterBus.getBus('gameplay');
  }

  private startSound(
    soundId: string,
    instance: SoundInstance,
    bus: AudioBus,
    when: number,
    playParams?: PlayParams
  ): SpatialAudio | undefined {
    const hasSpatial = playParams?.position && playParams?.viewport && this.ctx;

    if (hasSpatial && this.ctx) {
      const spatial = new SpatialAudio(this.ctx);

      // Use FocusManager to compute pan/distance based on current focus mode
      const { pan, distance } = this.focusManager.computeSpatial(
        playParams.position,
        playParams.viewport
      );

      // Synthesize a virtual position so that SpatialAudio computes correctly
      const halfWidth = playParams.viewport.width / 2;
      const virtualX = playParams.viewport.centerX + pan * halfWidth;
      const dy = Math.sqrt(Math.max(0, distance * distance - (pan * halfWidth) * (pan * halfWidth)));
      const virtualY = playParams.viewport.centerY + dy;

      spatial.updatePosition(virtualX, virtualY, playParams.viewport);
      instance.connect(spatial.input);
      spatial.output.connect(bus.input);
      if (this.reverbEngine) {
        spatial.send.connect(this.reverbEngine.input);
      }
      instance.start(when, playParams ?? {});
      this.applyDucking(soundId);
      return spatial;
    }

    instance.connect(bus.input);
    instance.start(when, playParams ?? {});
    this.applyDucking(soundId);
    return undefined;
  }

  private stopIfActive(soundId: string, reason: 'completed' | 'manual' | 'stolen'): void {
    if (this.activeSounds.has(soundId)) {
      this.disposeSound(soundId, reason);
    }
  }

  private disposeSound(
    soundId: string,
    reason: 'completed' | 'manual' | 'stolen' = 'completed',
    releaseChannel: boolean = true
  ): void {
    const active = this.activeSounds.get(soundId);
    if (!active || !this.ctx || !this.channelPool) {
      return;
    }

    clearTimeout(active.timeoutId);
    active.instance.stop(this.ctx.currentTime);
    active.instance.dispose();
    if (active.spatial) {
      active.spatial.dispose();
    }
    if (releaseChannel) {
      this.channelPool.release(active.channelId);
    }
    this.activeSounds.delete(soundId);

    this.clearDucking(soundId);
    this.emit('stop', { soundId, reason });
  }

  private applyDucking(soundId: string): void {
    if (!this.masterBus) {
      return;
    }

    const rules = this.duckManager.getDuckRules(soundId);
    if (rules.length === 0) {
      return;
    }

    const alreadyDucked = new Set<string>();
    for (const rule of rules) {
      if (!alreadyDucked.has(rule.target) && this.duckManager.isDucked(rule.target)) {
        alreadyDucked.add(rule.target);
      }
    }

    this.duckManager.setActive(soundId);

    for (const rule of rules) {
      if (alreadyDucked.has(rule.target)) {
        continue;
      }
      alreadyDucked.add(rule.target);

      const bus = this.masterBus.getBus(rule.target);
      if (bus) {
        this.duckManager.setOriginalVolume(rule.target, bus.volume);
        bus.fadeTo(rule.duckVolume, rule.fadeOutMs);
      }
    }
  }

  private clearDucking(soundId: string): void {
    if (!this.masterBus) {
      return;
    }

    const rules = this.duckManager.getDuckRules(soundId);
    this.duckManager.clearActive(soundId);

    const restored = new Set<string>();
    for (const rule of rules) {
      if (restored.has(rule.target)) {
        continue;
      }
      if (!this.duckManager.isDucked(rule.target)) {
        const bus = this.masterBus.getBus(rule.target);
        if (bus) {
          const originalVol = this.duckManager.getOriginalVolume(rule.target);
          bus.fadeTo(originalVol, rule.fadeInMs);
        }
        restored.add(rule.target);
      }
    }
  }
}
