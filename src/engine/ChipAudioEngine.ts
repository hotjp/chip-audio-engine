import type { PlayParams } from '../providers/types.js';
import type { SoundProvider, SoundInstance } from '../providers/SoundProvider.js';
import { OscillatorProvider } from '../providers/OscillatorProvider.js';
import { AudioBus } from '../core/AudioBus.js';
import { ChannelPool } from '../core/ChannelPool.js';
import { Aggregator, AggregationConfig } from '../core/Aggregator.js';
import { DuckManager, DuckRule } from '../core/DuckManager.js';
import { SoundPackLoader, SoundPack } from '../config/SoundPackLoader.js';
import { EventEmitter } from '../core/EventEmitter.js';
import type { EngineEvents } from './types.js';

export interface EngineConfig {
  audioContext?: AudioContext;
  channelCount?: number;
  soundPack?: SoundPack;
}

interface ActiveSound {
  instance: SoundInstance;
  channelId: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class ChipAudioEngine extends EventEmitter<EngineEvents> {
  private ctx: AudioContext | null = null;
  private ownsContext: boolean = false;
  private masterBus: AudioBus | null = null;
  private channelPool: ChannelPool | null = null;
  private aggregator: Aggregator;
  private duckManager: DuckManager;
  private soundPackLoader: SoundPackLoader;
  private providers: Map<string, SoundProvider> = new Map();
  private activeSounds: Map<string, ActiveSound> = new Map();
  private config: EngineConfig;

  constructor(config: EngineConfig = {}) {
    super();
    this.config = config;
    this.aggregator = new Aggregator();
    this.duckManager = new DuckManager();
    this.soundPackLoader = new SoundPackLoader();

    if (config.soundPack) {
      this.soundPackLoader.register(config.soundPack);
      this.soundPackLoader.setActive(config.soundPack.name);
    }
  }

  init(): void {
    if (this.config.audioContext) {
      this.ctx = this.config.audioContext;
      this.ownsContext = false;
    } else {
      this.ctx = new AudioContext();
      this.ownsContext = true;
    }

    this.initBusTree();

    this.channelPool = new ChannelPool({
      maxChannels: this.config.channelCount ?? 8,
    });

    const oscProvider = new OscillatorProvider();
    this.providers.set(oscProvider.id, oscProvider);
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
    this.masterBus.addBus(sfxBus);
    sfxBus.addBus(uiBus);
    sfxBus.addBus(gameplayBus);

    this.masterBus.output.connect(this.ctx.destination);
  }

  play(soundId: string, playParams?: PlayParams): void {
    if (!this.ctx || !this.masterBus || !this.channelPool) {
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

    const bus = this.resolveBus(soundId);
    if (!bus) {
      this.channelPool.release(channelId);
      return;
    }

    const when = this.ctx.currentTime + (playParams?.delay ?? 0);
    this.startSound(soundId, instance, bus, when, playParams);

    const durationMs = soundParams.duration ?? 300;
    const timeoutId = setTimeout(() => {
      this.disposeSound(soundId, 'completed');
    }, durationMs + 100);

    this.activeSounds.set(soundId, {
      instance,
      channelId,
      timeoutId,
    });

    this.emit('play', { soundId, channelId });

    // Dispose the old instance of the same sound after the new state is set,
    // so that listeners observing activeSounds during the 'stop' event see
    // the new sound already registered.
    if (oldActive) {
      clearTimeout(oldActive.timeoutId);
      oldActive.instance.stop(this.ctx.currentTime);
      oldActive.instance.dispose();
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

  stop(soundId: string): void {
    this.stopIfActive(soundId, 'manual');
  }

  stopAll(): void {
    const soundIds = Array.from(this.activeSounds.keys());
    for (const soundId of soundIds) {
      this.disposeSound(soundId, 'manual');
    }
  }

  destroy(): void {
    this.stopAll();

    if (this.masterBus) {
      this.masterBus.output.disconnect();
      this.masterBus = null;
    }

    if (this.ownsContext && this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.ctx = null;

    this.channelPool = null;
    this.providers.clear();
    this.aggregator.reset();
    this.duckManager.clearAll();
    this.activeSounds.clear();
  }

  suspend(): void {
    if (this.ctx && this.ownsContext) {
      this.ctx.suspend();
    }
  }

  resume(): void {
    if (this.ctx && this.ownsContext) {
      this.ctx.resume();
    }
  }

  isSuspended(): boolean {
    return this.ctx?.state === 'suspended';
  }

  registerProvider(provider: SoundProvider): void {
    this.providers.set(provider.id, provider);
  }

  loadSoundPack(pack: SoundPack): void {
    this.soundPackLoader.register(pack);
    this.soundPackLoader.setActive(pack.name);
  }

  getBus(busId: string): AudioBus | undefined {
    return this.masterBus?.getBus(busId);
  }

  getMasterBus(): AudioBus | null {
    return this.masterBus;
  }

  addDuckRule(rule: DuckRule): void {
    this.duckManager.addRule(rule);
  }

  setAggregation(soundId: string, config: AggregationConfig): void {
    this.aggregator.setConfig(soundId, config);
  }

  get masterVolume(): number {
    return this.masterBus?.volume ?? 1;
  }

  set masterVolume(value: number) {
    if (this.masterBus) {
      this.masterBus.volume = value;
      this.emit('bus:volume', { busId: 'master', volume: value });
    }
  }

  get masterMuted(): boolean {
    return this.masterBus?.muted ?? false;
  }

  set masterMuted(value: boolean) {
    if (this.masterBus) {
      this.masterBus.muted = value;
    }
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
  ): void {
    instance.connect(bus.input);
    instance.start(when, playParams ?? {});
    this.applyDucking(soundId);
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

    for (const rule of rules) {
      const isDucked = this.duckManager.isDucked(rule.target);
      if (!isDucked) {
        const bus = this.masterBus.getBus(rule.target);
        if (bus) {
          const originalVol = this.duckManager.getOriginalVolume(rule.target);
          bus.fadeTo(originalVol, rule.fadeInMs);
        }
      }
    }
  }
}
