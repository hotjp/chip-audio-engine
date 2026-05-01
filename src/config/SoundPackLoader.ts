import type { SoundParams } from '../providers/types.js';

export interface SoundPackEntry {
  provider: string;
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

  register(pack: SoundPack): void {
    this.packs.set(pack.name, pack);
  }

  setActive(packName: string): boolean {
    if (!this.packs.has(packName)) {
      return false;
    }
    this.activePackName = packName;
    return true;
  }

  getSound(soundId: string): SoundParams | null {
    const entry = this.getSoundEntry(soundId);
    if (!entry) {
      return null;
    }
    return {
      waveforms: entry.waveforms,
      envelope: entry.envelope,
      filter: entry.filter,
      volume: entry.volume,
      duration: entry.duration,
      pitch: entry.pitch,
    };
  }

  getSoundEntry(soundId: string): SoundPackEntry | null {
    if (!this.activePackName) {
      return null;
    }
    const pack = this.packs.get(this.activePackName);
    if (!pack) {
      return null;
    }
    return pack.sounds[soundId] ?? null;
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
