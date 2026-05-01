# Chip Audio Engine (CAE)

A lightweight, modular Web Audio API wrapper designed for games, apps, and interactive experiences. CAE provides a bus-based mixing architecture, channel pooling, ADSR envelopes, multi-waveform synthesis, ducking, aggregation, and SoundPack-driven audio design — all without external assets.

## Features

- **OscillatorProvider** — Pure synthesis engine using Web Audio API oscillators (sine, square, sawtooth, triangle)
- **ADSR Envelopes** — Attack, Decay, Sustain, Release per sound
- **Pitch Slide** — Frequency glide via pitch curves (`start` → `end` multipliers)
- **Multi-Waveform Stacking** — Layer multiple waveforms for richer chip-tone textures
- **Biquad Filter** — Per-sound lowpass/highpass/bandpass/etc. filtering
- **Bus Tree** — Hierarchical mixer: `master > music + sfx > ui + gameplay`
- **ChannelPool** — Polyphonic channel allocation with priority-based preemption
- **Aggregator** — Playback strategies: restart, arpeggio, stack, debounce
- **DuckManager** — Automatic sidechain ducking rules between buses
- **SoundPack** — JSON-driven sound definitions with provider routing
- **Playground** — Standalone HTML demo for instant browser testing

## Installation

```bash
npm install chip-audio-engine
```

## Quick Start

```typescript
import { ChipAudioEngine } from 'chip-audio-engine';
import pixelSfc from './packs/pixel-sfc.json';

const engine = new ChipAudioEngine({
  channelCount: 8,
  soundPack: pixelSfc,
});

engine.init();

// Play a sound
engine.play('ui.click');
engine.play('game.taskComplete');

// Master volume & mute
engine.masterVolume = 0.8;
engine.masterMuted = true;

// Ducking: when 'game.alert' plays, reduce 'music' bus to 0.2 over 100ms
engine.addDuckRule({
  trigger: 'game.alert',
  target: 'music',
  duckVolume: 0.2,
  fadeOutMs: 100,
  fadeInMs: 300,
  holdMs: 0,
});
```

## API

| Class / Type | Key Members | Description |
|---|---|---|
| `ChipAudioEngine` | `init()`, `play(id, params?)`, `stopAll()`, `destroy()` | Main engine orchestrator |
| | `masterVolume`, `masterMuted` | Master bus controls |
| | `loadSoundPack(pack)`, `registerProvider(p)` | Extend packs & providers |
| | `addDuckRule(rule)`, `setAggregation(id, cfg)` | Ducking & aggregation setup |
| | `getBus(id)`, `getMasterBus()` | Access mixer buses |
| `AudioBus` | `volume`, `muted`, `fadeTo(target, ms)` | Mixer node in the bus tree |
| | `addBus(sub)`, `getBus(id)` | Hierarchical bus nesting |
| `ChannelPool` | `allocate(id, priority)`, `release(id)` | Polyphony limiter |
| | `getUsedCount()`, `getFreeCount()` | Channel telemetry |
| `Aggregator` | `submit(id, priority): boolean` | Throttle duplicate triggers |
| | `setConfig(id, cfg)`, `setDefaultConfig(cfg)` | Per-sound aggregation rules |
| `DuckManager` | `addRule(rule)`, `removeRule(t, tgt)` | Sidechain ducking logic |
| `SoundPackLoader` | `register(pack)`, `setActive(name)` | Pack registry & lookup |
| | `getSound(id)`, `listSounds()` | Sound parameter resolution |
| `OscillatorProvider` | `createSound(ctx, id, params)` | Synthesizer provider |
| `SoundParams` | `waveforms`, `envelope`, `filter` | Sound definition shape |
| | `volume`, `duration`, `pitch` | Playback parameters |

## Architecture

```
┌─────────────────────────────────────────────┐
│           ChipAudioEngine                   │
│  ┌─────────────────────────────────────┐   │
│  │      SoundPackLoader                │   │
│  │   (packs → sound definitions)       │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │      Aggregator                     │   │
│  │   (restart / arpeggio / stack)      │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │      ChannelPool (maxChannels)      │   │
│  │   (allocate / release / preempt)    │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │      Providers (OscillatorProvider) │   │
│  │   (ctx + params → SoundInstance)    │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │      Bus Tree (AudioBus)            │   │
│  │                                     │   │
│  │   master ──► music                  │   │
│  │        │                            │   │
│  │        └──► sfx ──► ui              │   │
│  │               └────► gameplay       │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │      DuckManager                    │   │
│  │   (trigger ──► target volume duck)  │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## SoundPack Example

See [`packs/pixel-sfc.json`](packs/pixel-sfc.json) for a complete 16-bit chiptune pack with 11 sounds.

```json
{
  "name": "pixel-sfc",
  "style": "16-bit chiptune",
  "sounds": {
    "ui.click": {
      "provider": "oscillator",
      "waveforms": [{ "type": "square", "frequency": 800, "gain": 0.5 }],
      "envelope": { "attack": 5, "decay": 15, "sustain": 0.1, "release": 20 },
      "duration": 50,
      "volume": 0.6
    }
  }
}
```

## Playground

Open [`playground.html`](playground.html) directly in any modern browser — no build step required. It includes:

- Master volume, mute, and stop-all controls
- All 11 UI and gameplay sound buttons
- Stress tests: rapid fire and multi-channel playback

## Build

```bash
# Type-check only
npx tsc --noEmit

# Build UMD
npx tsc -p tsconfig.umd.json
```

## License

MIT
