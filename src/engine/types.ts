export interface EngineEvents {
  play: { soundId: string; channelId: number };
  stop: { soundId: string; reason: "completed" | "manual" | "stolen" };
  "bus:volume": { busId: string; volume: number };
  "bus:mute": { busId: string; muted: boolean };
  error: { soundId?: string; error: Error };
}
