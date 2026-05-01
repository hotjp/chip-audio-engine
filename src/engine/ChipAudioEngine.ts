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

    // Bus tree: master > music + sfx > ui + gameplay
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

    this.channelPool = new ChannelPool({
      maxChannels: this.config.channelCount ?? 8,
    });

    const oscProvider = new OscillatorProvider();
    this.providers.set(oscProvider.id, oscProvider);
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

    const entry = this.soundPackLoader.getSoundEntry(soundId);
    const providerId = entry?.provider ?? 'oscillator';
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }

    const channelId = this.channelPool.allocate(soundId, 0);
    if (channelId === null) {
      return;
    }

    const instance = provider.createSound(this.ctx, soundId, soundParams);

    let bus: AudioBus | undefined;
    if (soundId.startsWith('ui.')) {
      bus = this.masterBus.getBus('ui');
    } else if (soundId.startsWith('game.')) {
      bus = this.masterBus.getBus('gameplay');
    } else if (soundId.startsWith('bgm.') || soundId.startsWith('music.')) {
      bus = this.masterBus.getBus('music');
    } else {
      bus = this.masterBus.getBus('gameplay');
    }

    if (!bus) {
      this.channelPool.release(channelId);
      return;
    }

    instance.connect(bus.input);
    const when = this.ctx.currentTime + (playParams?.delay ?? 0);
    instance.start(when, playParams ?? {});

    this.applyDucking(soundId);

    const durationMs = soundParams.duration ?? 300;
    const timeoutId = setTimeout(() => {
      this.disposeSound(soundId, 'completed');
    }, durationMs + 100);

    const prev = this.activeSounds.get(soundId);
    if (prev) {
      this.disposeSound(soundId, 'stolen');
    }

    this.activeSounds.set(soundId, {
      instance,
      channelId,
      timeoutId,
    });

    this.emit('play', { soundId, channelId });
  }

  stop(soundId: string): void {
    if (this.activeSounds.has(soundId)) {
      this.disposeSound(soundId, 'manual');
    }
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

  private disposeSound(
    soundId: string,
    reason: 'completed' | 'manual' | 'stolen' = 'completed'
  ): void {
    const active = this.activeSounds.get(soundId);
    if (!active || !this.ctx || !this.channelPool) {
      return;
    }

    clearTimeout(active.timeoutId);
    active.instance.stop(this.ctx.currentTime);
    active.instance.dispose();
    this.channelPool.release(active.channelId);
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

    for (const rule of rules) {
      const wasDucked = this.duckManager.isDucked(rule.target);
      this.duckManager.setActive(soundId);
      const isDucked = this.duckManager.isDucked(rule.target);

      if (!wasDucked && isDucked) {
        const bus = this.masterBus.getBus(rule.target);
        if (bus) {
          this.duckManager.setOriginalVolume(rule.target, bus.volume);
          bus.fadeTo(rule.duckVolume, rule.fadeOutMs);
        }
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
