# Chip Audio Engine (CAE)

Chip Audio Engine (CAE) 是浏览器端芯片音频合成引擎，支持程序化音效和 BGM 创作播放。

---

## 🎨 特性

- 🎵 **总线树架构** — master → music / sfx → ui / gameplay 层级混音
- 🎹 **振荡器合成 + 采样播放** — 内置 OscillatorProvider 与 SampleProvider，支持合成器与采样双模式
- 🎼 **Timbre Pack 音色包系统** — 将波形、包络、滤波器抽象为可复用音色
- 📝 **Score 乐谱** — 音名 + 时值 + 演奏表情的声明式 BGM 格式
- 🥁 **演奏表情** — layback / swing / humanize / velocityCurve 让机器演奏更自然
- 🔊 **侧链闪避（Ducking）** — BGM 播放时自动降低 sfx / ui 音量
- 📊 **事件聚合** — debounce / stack / arpeggio 策略防止声音爆炸
- 🎧 **空间音频（2D 定位）** — 基于视口坐标计算 pan、距离滤音与混响 send
- 🏠 **混响引擎** — room / hall / plate 三种预设，程序化 IR 轻量短尾混响
- 🎯 **焦点模式** — viewport / follow / zone / legion 四种空间聚焦策略
- ✅ **Score 校验** — `validateScore` 在运行前捕获乐谱语法错误

---

## 🚀 快速开始

### 1. 安装

```bash
npm install chip-audio-engine
```

### 2. 初始化引擎

```typescript
import { ChipAudioEngine } from 'chip-audio-engine';

const engine = new ChipAudioEngine();
engine.init();
```

### 3. 播放音效

```typescript
engine.play('ui.click');
```

---

## 🎼 Timbre Pack + Score 示例

完整的 BGM 创作流程：选音色包 → 写乐谱 → 播放。

```typescript
import { ChipAudioEngine } from 'chip-audio-engine';

const engine = new ChipAudioEngine();
engine.init();

// 1. 加载音色包
engine.loadTimbrePack({
  name: 'my-pack',
  timbres: {
    lead: {
      provider: 'oscillator',
      waveforms: [{ type: 'square', gain: 0.5, detune: -4 }],
      envelope: { attack: 5, decay: 30, sustain: 0.3, release: 60 },
    },
    bass: {
      provider: 'oscillator',
      waveforms: [{ type: 'triangle', gain: 0.6 }],
      envelope: { attack: 2, decay: 20, sustain: 0.5, release: 40 },
    },
  },
});

// 2. 加载乐谱
engine.loadScore({
  id: 'title',
  name: 'Title Theme',
  bpm: 120,
  timbrePack: 'my-pack',
  config: { loop: true },
  tracks: [
    {
      timbre: 'lead',
      notes: [
        { note: 'E5', duration: 'q' },
        { note: 'G5', duration: 'q' },
        { note: 'A5', duration: 'h' },
      ],
    },
    {
      timbre: 'bass',
      notes: [
        { note: 'A2', duration: 'w' },
        { note: 'E2', duration: 'w' },
      ],
    },
  ],
});

// 3. 播放
engine.playBGM('title', { fadeIn: 500 });
```

---

## 📋 API 概览

| 类 / 函数 | 说明 |
|-----------|------|
| `ChipAudioEngine` | 引擎主入口，管理音频上下文、总线树、播放、BGM、闪避与聚合 |
| `AudioBus` | 音频总线，封装 GainNode 实现层级音量与渐变控制 |
| `ChannelPool` | 声道池，按优先级分配有限数量的播放声道 |
| `Aggregator` | 聚合器，控制同一音效的重复提交行为 |
| `DuckManager` | 闪避管理器，根据规则自动调节目标总线音量 |
| `OscillatorProvider` | 振荡器提供者，通过 OscillatorNode 实时合成声音 |
| `SampleProvider` | 采样提供者，通过 AudioBuffer 播放预加载采样 |
| `ReverbEngine` | 混响引擎，支持 preset 切换与全局 send bus |
| `SpatialAudio` | 空间音频，2D 坐标映射为 pan、距离滤音与混响 send |
| `BGMEngine` | BGM 引擎，按 Score 调度音符播放（旧格式与新格式均支持） |
| `TimbrePackLoader` | 音色包加载器，管理音色包的注册与激活 |
| `MusicUtils` | 音乐辅助函数：音名转频率、时值转毫秒、音阶/和弦生成等 |
| `FocusManager` | 焦点模式状态机，将声源位置映射为 pan / distance |
| `validateScore` | 校验 Score JSON 对象是否语法正确 |
| `EventEmitter` | 类型安全的事件发射器基类 |
| `SoundPackLoader` | 音效包加载器，管理音效包的注册、激活与参数合并 |

---

## 📦 SoundPack 格式

SoundPack 是音效的 JSON 配置集合，每个条目描述波形、包络、滤波器、音高等参数。

```typescript
interface SoundPack {
  name: string;
  style?: string;
  sounds: Record<string, SoundPackEntry>;
}

interface SoundPackEntry {
  provider?: string;           // 默认 'oscillator'
  waveforms?: WaveformConfig[];
  envelope?: ADSRConfig;
  filter?: FilterConfig;
  volume?: number;
  duration?: number;           // 毫秒
  pitch?: PitchCurve;
}
```

**摘录自 `packs/pixel-sfc.json`：**

```json
{
  "name": "pixel-sfc",
  "style": "16-bit chiptune",
  "sounds": {
    "ui.click": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "square", "frequency": 800, "gain": 0.5, "detune": -4 },
        { "type": "square", "frequency": 800, "gain": 0.25, "detune": 4 }
      ],
      "filter": { "type": "lowpass", "frequency": 2800, "Q": 1 },
      "envelope": { "attack": 2, "decay": 15, "sustain": 0, "release": 20 },
      "duration": 40,
      "volume": 0.6
    },
    "game.connect": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "sine", "frequency": 300, "gain": 0.4 },
        { "type": "sine", "frequency": 600, "gain": 0.3 },
        { "type": "sine", "frequency": 900, "gain": 0.2 }
      ],
      "filter": { "type": "lowpass", "frequency": 1600, "Q": 1 },
      "envelope": { "attack": 8, "decay": 80, "sustain": 0.3, "release": 120 },
      "duration": 220,
      "volume": 0.5
    }
  }
}
```

---

## 🎹 Timbre Pack 格式

Timbre Pack 是 BGM 专用的音色定义集合。与 SoundPack 不同，Timbre 不携带固定频率，频率由 Score 中的音符提供。

```typescript
interface TimbrePack {
  name: string;
  style?: string;
  description?: string;
  timbres: Record<string, TimbreDefinition>;
}

interface TimbreDefinition {
  provider: string;
  waveforms?: Array<{
    type: OscillatorType | 'noise';
    gain?: number;
    detune?: number;
  }>;
  envelope?: ADSRConfig;
  filter?: FilterConfig;
  volume?: number;
  pitch?: PitchCurve;
}
```

**摘录自 `timbres/16bit-sfc.json`：**

```json
{
  "name": "16bit-sfc",
  "style": "SFC/GBA 16-bit chiptune",
  "description": "温润柔和的 SFC 风格音色，适合像素风游戏",
  "timbres": {
    "lead": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "square", "gain": 0.5, "detune": -4 },
        { "type": "square", "gain": 0.25, "detune": 4 }
      ],
      "filter": { "type": "lowpass", "frequency": 2800, "Q": 1 },
      "envelope": { "attack": 5, "decay": 30, "sustain": 0.3, "release": 60 }
    },
    "bass": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "triangle", "gain": 0.6 },
        { "type": "square", "gain": 0.15, "detune": -6 }
      ],
      "filter": { "type": "lowpass", "frequency": 800, "Q": 0.8 },
      "envelope": { "attack": 2, "decay": 20, "sustain": 0.5, "release": 40 }
    },
    "kick": {
      "provider": "oscillator",
      "waveforms": [{ "type": "sine", "gain": 0.7 }],
      "envelope": { "attack": 1, "decay": 80, "sustain": 0, "release": 60 },
      "pitch": { "start": 1.5, "end": 0.5 }
    }
  }
}
```

---

## 📝 Score 格式

Score 是 CAE 的声明式乐谱格式，用于描述 BGM 的多轨音符与演奏表情。

### 音名系统

音名格式为 `[A-G][#b][0-9]`，例如 `C4`、`A#3`、`Bb5`。使用 `null` 表示休止符。

### 时值系统

| 符号 | 含义 | 拍数（以四分音符为 1 拍） |
|------|------|---------------------------|
| `w`  | 全音符 | 4 |
| `h`  | 二分音符 | 2 |
| `q`  | 四分音符 | 1 |
| `e`  | 八分音符 | 0.5 |
| `s`  | 十六分音符 | 0.25 |
| `t`  | 三十二分音符 | 0.125 |
| `w.` | 附点全音符 | 6 |
| `h.` | 附点二分音符 | 3 |
| `q.` | 附点四分音符 | 1.5 |
| `e.` | 附点八分音符 | 0.75 |
| `s.` | 附点十六分音符 | 0.375 |

也可直接传入 `number`（毫秒）作为绝对时长。

### 演奏表情（PerformanceExpr）

在每个 `ScoreTrack` 的 `performance` 字段中配置：

| 字段 | 类型 | 说明 |
|------|------|------|
| `swing` | `number (0–1)` | Swing 比例，影响八分及以下音符的奇偶拍时长 |
| `humanize` | `number (0–1)` | Humanize 强度，随机扰动音符起始时间与力度 |
| `layback` | `number` | 全局 layback（毫秒），整体向后延迟 |
| `velocityCurve` | `[number, number][]` | 力度曲线控制点，`[音符索引, 力度倍率]` |

### Score 结构

```typescript
interface Score {
  id: string;              // 唯一标识
  name: string;            // 显示名称
  bpm: number;             // 速度
  timbrePack: string;      // 引用的音色包名称
  config?: ScoreConfig;    // 全局配置（loop、volume、reverb）
  tracks: ScoreTrack[];
}

interface ScoreTrack {
  timbre: string;          // Timbre Pack 中的音色名
  volume?: number;         // 轨道音量（0–1）
  mute?: boolean;          // 是否静音
  loopStart?: number;      // 循环起始音符索引
  transpose?: number;      // 移调（半音，-24 ~ 24）
  performance?: PerformanceExpr;
  notes: ScoreNote[];
}

interface ScoreNote {
  note: string | null;     // 音名或休止符
  duration: DurationValue; // 时值符号或毫秒数
  velocity?: number;       // 力度（0–1）
  offset?: number;         // 时间偏移（毫秒）
}
```

### 校验

使用 `validateScore` 在加载前校验乐谱：

```typescript
import { validateScore } from 'chip-audio-engine';

const result = validateScore(scoreJson);
if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.path}: ${err.message}`);
  }
}
```

---

## 🔌 自定义 Provider

实现 `SoundProvider` 接口即可接入任意音源（Web Audio API 合成、WebSocket 音频流、程序生成等）。

```typescript
import type { SoundProvider, SoundInstance, SoundParams, PlayParams } from 'chip-audio-engine';

class MyProvider implements SoundProvider {
  readonly id = 'my-provider';
  readonly capabilities = {
    supportedTypes: ['synth'] as const,
    maxPolyphony: 4,
    realtimeParams: true,
  };

  createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance {
    // 返回一个实现 SoundInstance 的对象
    return {
      connect(node: AudioNode) { /* ... */ },
      start(when: number, playParams: PlayParams) { /* ... */ },
      stop(when: number) { /* ... */ },
      dispose() { /* ... */ },
    };
  }

  async preload(soundIds: string[]): Promise<void> {
    // 可选：预加载资源
  }
}

// 注册到引擎
engine.registerProvider(new MyProvider());
```

---

## 🌐 浏览器兼容性

Chip Audio Engine 依赖 Web Audio API，兼容以下环境：

- Chrome / Edge 14+
- Firefox 25+
- Safari 14.1+（macOS）/ iOS 14.5+

> 旧版浏览器若缺少 `StereoPannerNode`、`ConvolverNode` 或 `BiquadFilterNode`，相关模块会自动降级为直通（bypass），不会抛出错误。

---

## 📄 License

MIT
