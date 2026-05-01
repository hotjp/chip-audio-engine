import type {
  SoundParams,
  PlayParams,
  SoundProviderCapabilities,
  WaveformConfig,
  PitchCurve,
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

function createPinkNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate; // 1 second
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] *= 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function getVibratoConfig(pitchCurve?: PitchCurve): { rate: number; depth: number } | null {
  if (!pitchCurve) return null;
  if (pitchCurve.curve === 'vibrato') {
    return {
      rate: pitchCurve.vibrato?.rate ?? 5,
      depth: pitchCurve.vibrato?.depth ?? 10,
    };
  }
  if (pitchCurve.vibrato) {
    return {
      rate: pitchCurve.vibrato.rate,
      depth: pitchCurve.vibrato.depth,
    };
  }
  return null;
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
  private noiseNodes: AudioBufferSourceNode[] = [];
  private waveGains: GainNode[] = [];
  private masterGain: GainNode;
  private filterNode?: BiquadFilterNode;
  private vibratoLFOs: OscillatorNode[] = [];
  private vibratoGains: GainNode[] = [];
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
      const g = ctx.createGain();
      g.gain.value = wave.gain ?? 1;

      if (wave.type === 'noise') {
        const buffer = createPinkNoiseBuffer(ctx);
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        noise.connect(g);
        this.noiseNodes.push(noise);
      } else {
        const osc = ctx.createOscillator();
        osc.type = wave.type;
        osc.frequency.value = getBaseFrequency(wave);
        if (wave.detune !== undefined) {
          osc.detune.value = wave.detune;
        }
        osc.connect(g);
        this.oscillators.push(osc);
      }

      if (this.filterNode) {
        g.connect(this.filterNode);
      } else {
        g.connect(this.masterGain);
      }

      this.waveGains.push(g);
    }

    if (this.filterNode) {
      this.filterNode.connect(this.masterGain);
    }

    // Setup vibrato if configured
    const vibrato = getVibratoConfig(params.pitch);
    if (vibrato && this.oscillators.length > 0) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = vibrato.rate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = vibrato.depth;
      lfo.connect(lfoGain);

      for (const osc of this.oscillators) {
        lfoGain.connect(osc.detune);
      }

      this.vibratoLFOs.push(lfo);
      this.vibratoGains.push(lfoGain);
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

    let oscIndex = 0;
    for (let i = 0; i < waveforms.length; i++) {
      const wave = waveforms[i];
      if (wave.type === 'noise') continue;

      const osc = this.oscillators[oscIndex++];
      const baseFreq = getBaseFrequency(wave) * pitchMul;

      if (pitchCurve && durationMs !== undefined && pitchCurve.curve !== 'vibrato') {
        const startFreq = Math.max(0.01, baseFreq * pitchCurve.start);
        const endFreq = Math.max(0.01, baseFreq * pitchCurve.end);
        osc.frequency.setValueAtTime(startFreq, t0);
        if (pitchCurve.curve === 'linear') {
          osc.frequency.linearRampToValueAtTime(endFreq, t0 + toSeconds(durationMs));
        } else {
          osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + toSeconds(durationMs));
        }
      } else {
        osc.frequency.setValueAtTime(baseFreq, t0);
      }

      osc.start(t0);
    }

    for (const noise of this.noiseNodes) {
      noise.start(t0);
    }

    for (const lfo of this.vibratoLFOs) {
      lfo.start(t0);
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

    for (const noise of this.noiseNodes) {
      try {
        noise.stop(releaseEnd);
      } catch {
        // Noise node may already be stopped or not yet started.
      }
    }

    for (const lfo of this.vibratoLFOs) {
      try {
        lfo.stop(releaseEnd);
      } catch {
        // LFO may already be stopped or not yet started.
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

    for (const noise of this.noiseNodes) {
      try {
        noise.stop();
      } catch {
        // ignore
      }
      noise.disconnect();
    }

    for (const lfo of this.vibratoLFOs) {
      try {
        lfo.stop();
      } catch {
        // ignore
      }
      lfo.disconnect();
    }

    for (const g of this.vibratoGains) {
      g.disconnect();
    }

    for (const g of this.waveGains) {
      g.disconnect();
    }

    if (this.filterNode) {
      this.filterNode.disconnect();
    }

    this.masterGain.disconnect();

    this.oscillators = [];
    this.noiseNodes = [];
    this.waveGains = [];
    this.vibratoLFOs = [];
    this.vibratoGains = [];
    this.filterNode = undefined;
  }
}
