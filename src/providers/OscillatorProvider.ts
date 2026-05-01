import type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
  WaveformConfig,
} from './types.js';
import type { SoundProvider, SoundInstance } from './SoundProvider.js';

function toSeconds(ms: number): number {
  return ms / 1000;
}

function getBaseFrequency(wave: WaveformConfig): number {
  if (Array.isArray(wave.frequency)) {
    return wave.frequency.length > 0 ? wave.frequency[0] : 440;
  }
  return wave.frequency;
}

export class OscillatorProvider implements SoundProvider {
  readonly id = 'oscillator';
  readonly capabilities: SoundProviderCapabilities = {
    supportedTypes: ['synth'],
    maxPolyphony: Infinity,
    realtimeParams: true,
  };

  createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance {
    return new OscillatorSound(ctx, soundId, params);
  }

  async preload(_soundIds: string[]): Promise<void> {
    // Oscillator nodes require no external asset loading.
  }
}

export class OscillatorSound implements SoundInstance {
  private ctx: BaseAudioContext;
  private params: SoundParams;
  private oscillators: OscillatorNode[] = [];
  private waveGains: GainNode[] = [];
  private masterGain: GainNode;
  private filterNode?: BiquadFilterNode;
  private connected = false;
  private started = false;
  private currentGain = 0;
  private disposed = false;

  constructor(ctx: BaseAudioContext, _soundId: string, params: SoundParams) {
    this.ctx = ctx;
    this.params = params;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.currentGain = 0;

    if (params.filter) {
      const f = ctx.createBiquadFilter();
      f.type = params.filter.type;
      f.frequency.value = params.filter.frequency;
      if (params.filter.Q !== undefined) {
        f.Q.value = params.filter.Q;
      }
      if (params.filter.gain !== undefined) {
        f.gain.value = params.filter.gain;
      }
      this.filterNode = f;
    }

    const waveforms = params.waveforms ?? [{ type: 'sine', frequency: 440 }];

    for (const wave of waveforms) {
      const osc = ctx.createOscillator();
      osc.type = wave.type;
      osc.frequency.value = getBaseFrequency(wave);
      if (wave.detune !== undefined) {
        osc.detune.value = wave.detune;
      }

      const g = ctx.createGain();
      g.gain.value = wave.gain ?? 1;

      osc.connect(g);
      if (this.filterNode) {
        g.connect(this.filterNode);
      } else {
        g.connect(this.masterGain);
      }

      this.oscillators.push(osc);
      this.waveGains.push(g);
    }

    if (this.filterNode) {
      this.filterNode.connect(this.masterGain);
    }
  }

  connect(node: AudioNode): void {
    if (this.connected || this.disposed) return;
    this.connected = true;
    this.masterGain.connect(node);
  }

  start(when: number, playParams: PlayParams): void {
    if (this.started || this.disposed) return;
    this.started = true;

    const delay = Number.isFinite(playParams.delay) ? (playParams.delay ?? 0) : 0;
    const t0 = when + delay;
    const volume = Number.isFinite(playParams.volume)
      ? (playParams.volume ?? this.params.volume ?? 1)
      : (this.params.volume ?? 1);
    const pitchMul = Number.isFinite(playParams.pitch) ? (playParams.pitch ?? 1) : 1;
    const envelope = this.params.envelope;
    const pitchCurve = this.params.pitch;
    const durationMs = this.params.duration;

    const waveforms = this.params.waveforms ?? [{ type: 'sine', frequency: 440 }];

    for (let i = 0; i < this.oscillators.length; i++) {
      const osc = this.oscillators[i];
      const wave = waveforms[i];
      const baseFreq = getBaseFrequency(wave) * pitchMul;

      if (pitchCurve && durationMs !== undefined) {
        const startFreq = Math.max(0.01, baseFreq * pitchCurve.start);
        const endFreq = Math.max(0.01, baseFreq * pitchCurve.end);
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + toSeconds(durationMs));
      } else {
        osc.frequency.setValueAtTime(baseFreq, t0);
      }

      osc.start(t0);
    }

    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(t0);
    gain.setValueAtTime(0, t0);
    this.currentGain = 0;

    if (envelope) {
      const attack = toSeconds(envelope.attack);
      const decay = toSeconds(envelope.decay);
      const peak = volume;
      const sustain = envelope.sustain * volume;

      gain.linearRampToValueAtTime(peak, t0 + attack);
      gain.linearRampToValueAtTime(sustain, t0 + attack + decay);
      this.currentGain = sustain;
    } else {
      gain.linearRampToValueAtTime(volume, t0);
      this.currentGain = volume;
    }
  }

  stop(when: number): void {
    if (this.disposed) return;
    const releaseMs = this.params.envelope?.release ?? 100;
    const now = this.ctx.currentTime;
    const releaseStart = Math.max(when, now);
    const releaseEnd = releaseStart + toSeconds(releaseMs);

    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentGain, releaseStart);
    gain.linearRampToValueAtTime(0, releaseEnd);
    this.currentGain = 0;

    for (const osc of this.oscillators) {
      try {
        osc.stop(releaseEnd);
      } catch {
        // Oscillator may already be stopped or not yet started.
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const osc of this.oscillators) {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      osc.disconnect();
    }
    for (const g of this.waveGains) {
      g.disconnect();
    }
    if (this.filterNode) {
      this.filterNode.disconnect();
    }
    this.masterGain.disconnect();

    this.oscillators = [];
    this.waveGains = [];
    this.filterNode = undefined;
  }
}
