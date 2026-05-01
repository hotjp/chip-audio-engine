import type { FilterConfig } from '../providers/types.js';

export interface EngineEvents {
  play: { soundId: string; channelId: number };
  stop: { soundId: string; reason: "completed" | "manual" | "stolen" };
  "bus:volume": { busId: string; volume: number };
  "bus:mute": { busId: string; muted: boolean };
  error: { soundId?: string; error: Error };
}

export interface BGMNote {
  freq: number | null;
  duration: number;
  gain?: number;
}

export interface BGMTrack {
  waveform: OscillatorType | "noise";
  notes: BGMNote[];
  detune?: number;
  filter?: FilterConfig;
  volume?: number;
  loopStart?: number;
}

export interface BGMScore {
  id: string;
  name: string;
  bpm: number;
  tracks: BGMTrack[];
}
