import type { SoundParams } from '../providers/types.js';

export interface SoundPackEntry {
  provider?: string;
  waveforms?: SoundParams['waveforms'];
  envelope?: SoundParams['envelope'];
  filter?: SoundParams['filter'];
  volume?: number;
  duration?: number;
  pitch?: SoundParams['pitch'];
}

export interface SoundPack {
  name: string;
  style?: string;
  sounds: Record<string, SoundPackEntry>;
}

export class SoundPackLoader {
  private packs: Map<string, SoundPack> = new Map();
  private activePackName: string | null = null;
  private soundCache: Map<string, SoundParams> = new Map();

  register(pack: SoundPack): void {
    this.packs.set(pack.name, pack);
    if (this.activePackName === pack.name) {
      this.soundCache.clear();
    }
  }

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

  listSounds(): string[] {
    if (!this.activePackName) {
      return [];
    }
    const pack = this.packs.get(this.activePackName);
    return pack ? Object.keys(pack.sounds) : [];
  }

  getActivePackName(): string | null {
    return this.activePackName;
  }

  getPackNames(): string[] {
    return Array.from(this.packs.keys());
  }
}
