# Timbre Pack System 设计文档

> 状态：Draft v0.1
> 日期：2026-05-02
> 作者：锻 + 姜琦

---

## 0. 问题定义

### 现状

CAE 当前有两个独立的数据格式：

- **SoundPack**（`packs/*.json`）：定义音效的合成参数（波形/包络/滤波器）
- **BGMScore**（`src/engine/types.ts`）：定义 BGM 乐谱的音符序列

**问题**：BGMScore 的每个 track 直接写 `waveform: "square"` 和 `freq: 440`——音色定义和乐谱耦合在一起。

### 目标

1. **AI 创作 BGM 时只写乐谱，不碰音色参数**
2. **换一个风格 = 换一个 Timbre Pack，乐谱不用改**
3. **Timbre Pack 可被独立维护、分享、复用**

---

## 1. 核心抽象：三层分离

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Score（乐谱）                          │
│  只写音符 + 引用 timbre 名                        │
│  风格无关，可移植                                 │
├─────────────────────────────────────────────────┤
│  Layer 2: Timbre Pack（音色包）                   │
│  定义 timbre 的合成参数                           │
│  风格相关，可复用                                 │
├─────────────────────────────────────────────────┤
│  Layer 1: Engine（引擎）                          │
│  OscillatorProvider / SampleProvider             │
│  风格无关，固定                                   │
└─────────────────────────────────────────────────┘
```

### 对比：改前 vs 改后

**改前**（乐谱直接定义音色）：

```json
{
  "id": "title",
  "bpm": 120,
  "tracks": [{
    "waveform": "square",
    "filter": { "type": "lowpass", "frequency": 2000, "Q": 1 },
    "envelope": { "attack": 5, "decay": 30, "sustain": 0.3, "release": 50 },
    "notes": [
      { "freq": 440, "duration": 500 },
      { "freq": 494, "duration": 500 }
    ]
  }]
}
```

问题：换一个 8-bit 风格？每个 track 的 waveform/filter/envelope 全要重写。

**改后**（乐谱引用 timbre）：

```json
{
  "id": "title",
  "bpm": 120,
  "timbrePack": "16bit-sfc",
  "tracks": [{
    "timbre": "lead",
    "notes": [
      { "note": "A4", "duration": "q" },
      { "note": "B4", "duration": "q" }
    ]
  }]
}
```

换风格？改 `timbrePack` 为 `"8bit-nes"`，乐谱零改动。

---

## 2. Timbre Pack 格式

### 2.1 定义

一个 Timbre Pack 就是一个 JSON 文件，定义一组命名音色。

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
    "pad": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "sine", "gain": 0.4, "detune": -7 },
        { "type": "sine", "gain": 0.4, "detune": 7 },
        { "type": "triangle", "gain": 0.2 }
      ],
      "filter": { "type": "lowpass", "frequency": 1500, "Q": 0.5 },
      "envelope": { "attack": 80, "decay": 100, "sustain": 0.6, "release": 200 }
    },
    "arp": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "square", "gain": 0.35 }
      ],
      "filter": { "type": "lowpass", "frequency": 3500, "Q": 1.5 },
      "envelope": { "attack": 1, "decay": 15, "sustain": 0, "release": 20 }
    },
    "kick": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "sine", "gain": 0.7 }
      ],
      "envelope": { "attack": 1, "decay": 80, "sustain": 0, "release": 60 },
      "pitch": { "start": 1.5, "end": 0.5 }
    },
    "snare": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "noise", "gain": 0.5 },
        { "type": "triangle", "gain": 0.3 }
      ],
      "filter": { "type": "highpass", "frequency": 500, "Q": 0.7 },
      "envelope": { "attack": 1, "decay": 40, "sustain": 0, "release": 30 }
    },
    "hihat": {
      "provider": "oscillator",
      "waveforms": [
        { "type": "noise", "gain": 0.2 }
      ],
      "filter": { "type": "highpass", "frequency": 6000, "Q": 0.5 },
      "envelope": { "attack": 0, "decay": 10, "sustain": 0, "release": 5 }
    }
  }
}
```

### 2.2 Timbre 定义规范

每个 timbre 就是一个不带 `frequency` 的 SoundParams——频率由乐谱的音符决定。

| 字段 | 必须 | 说明 |
|------|------|------|
| `provider` | 是 | `"oscillator"` 或 `"sample"` |
| `waveforms` | 是 | 波形层定义（`frequency` 由音符提供，不在此写） |
| `envelope` | 否 | ADSR 包络（ms / 0-1） |
| `filter` | 否 | 滤波器配置 |
| `pitch` | 否 | 相对音高变化（用于 kick 这类需要 pitch bend 的打击乐） |
| `volume` | 否 | 音量缩放（0-1） |

### 2.3 与 SoundPack 的关系

**Timbre Pack 定义 BGM 音色，SoundPack 定义音效音色。**

```
Timbre Pack                SoundPack
─────────────              ─────────
面向 BGM 乐谱              面向音效系统
timbre 是"乐器"           sound 是"音效"
被 Score.track.timbre 引用  被 engine.play(soundId) 引用
可复用、可换风格            可复用、可换风格
```

两者格式相似但不完全相同：
- Timbre 不写 `frequency`（由音符提供）
- Timbre 不写 `duration`（由音符时值提供）
- SoundPack 的每个 sound 是完整定义，Timbre 是音色模板

---

## 3. Score 格式升级

### 3.1 新的 Score 格式

```typescript
interface Score {
  id: string;
  name: string;
  bpm: number;
  /** 引用 Timbre Pack 名 */
  timbrePack: string;
  /** 全局设置（可选） */
  config?: ScoreConfig;
  tracks: ScoreTrack[];
}

interface ScoreConfig {
  /** 循环模式：全部 track 循环 */
  loop?: boolean;
  /** 主音量（0-1） */
  volume?: number;
  /** 混响 preset */
  reverb?: string;
}

interface ScoreTrack {
  /** 引用 Timbre Pack 中的 timbre 名 */
  timbre: string;
  /** 轨道音量覆盖（0-1） */
  volume?: number;
  /** 轨道静音 */
  mute?: boolean;
  /** 循环起点（小节号），默认从头循环 */
  loopStart?: number;
  /** 八度偏移（半音数），用于转调 */
  transpose?: number;
  /** 演奏表情配置（swing / humanize / layback / velocityCurve） */
  performance?: PerformanceExpr;
  /** 音符序列 */
  notes: ScoreNote[];
}

interface ScoreNote {
  /** 音名（如 "C4", "A#3", "Gb5"），null 表示休止符 */
  note: string | null;
  /** 时值：分数记法或毫秒数 */
  duration: DurationValue;
  /** 力度（0-1），覆盖 timbre 默认音量 */
  velocity?: number;
  /**
   * 时间偏移（ms）。正数 = 晚出（layback），负数 = 抢拍。
   * 用于制造拖拍感、摇摆感等人类化演奏表情。
   * @default 0
   * @example
   * ```ts
   * { note: "E5", duration: "q", offset: 20 }  // 微微拖拍
   * ```
   */
  offset?: number;
}

/**
 * 演奏表情配置，作用于 track 级别。
 * 所有参数都是可选的，未设置 = 机器精度。
 */
interface PerformanceExpr {
  /**
   * Swing 比例（0-1）。
   * 0 = 平均八分音符（直拍），
   * 0.33 = 轻度 shuffle，
   * 0.66 = 典型 swing，
   * 1 = 极端 triplet feel。
   *
   * 原理：将每对八分音符的前一个拉长、后一个缩短。
   * swing=0.66 时，八分音符对从 [250ms, 250ms] 变成 [333ms, 167ms]（BPM 120）。
   * @default 0
   */
  swing?: number;

  /**
   * Humanize 强度（0-1）。
   * 给每个音符的起始时间和力度加随机微偏移，去掉机器感。
   * 0 = 关闭，0.3 = 轻微，0.7 = 明显的人类化。
   *
   * 实际偏移范围：
   * - 时间: ±(humanize × 30)ms
   * - 力度: ±(humanize × 0.15)
   * @default 0
   */
  humanize?: number;

  /**
   * 全局 layback（ms）。整轨所有音符统一后移。
   * 与 per-note offset 叠加：最终偏移 = track.layback + note.offset + humanize 随机。
   * @default 0
   */
  layback?: number;

  /**
   * 力度曲线：跨多个音符的渐强/渐弱。
   * 定义一组 [位置, 力度倍率] 控制点，中间线性插值。
   *
   * @example
   * ```json
   * // 从第 1 个音渐强到第 8 个音
   * "velocityCurve": [[0, 0.3], [7, 1.0]]
   * ```
   */
  velocityCurve?: [number, number][];
}

/** 时值：支持多种记法 */
type DurationValue =
  | "w"    // 全音符 (whole)
  | "h"    // 二分音符 (half)
  | "q"    // 四分音符 (quarter)
  | "e"    // 八分音符 (eighth)
  | "s"    // 十六分音符 (sixteenth)
  | "t"    // 三十二分音符 (thirty-second)
  | "w."   // 附点全音符
  | "h."   // 附点二分音符
  | "q."   // 附点四分音符
  | "e."   // 附点八分音符
  | "s."   // 附点十六分音符
  | number; // 自定义毫秒数
```

### 3.2 音名系统

采用科学音高记号（Scientific Pitch Notation）：

```
格式: [音名][升降][八度]

音名: C D E F G A B
升降: # (升) b (降) 或省略
八度: 0-9（C4 = 中央 C = 261.63Hz）

示例:
  C4  = 261.63 Hz（中央 C）
  A4  = 440.00 Hz（标准音高）
  A#4 = 466.16 Hz
  Bb4 = 466.16 Hz（等价于 A#4）
  C5  = 523.25 Hz
  E3  = 164.81 Hz
  null = 休止符
```

### 3.3 时值系统

基于 BPM 的相对时值：

| 记法 | 名称 | 时长计算（BPM=120） |
|------|------|---------------------|
| `w` | 全音符 | 4 拍 = 2000ms |
| `h` | 二分音符 | 2 拍 = 1000ms |
| `q` | 四分音符 | 1 拍 = 500ms |
| `e` | 八分音符 | ½ 拍 = 250ms |
| `s` | 十六分音符 | ¼ 拍 = 125ms |
| `t` | 三十二分音符 | ⅛ 拍 = 62.5ms |
| `q.` | 附点四分 | 1.5 拍 = 750ms |
| `250` | 自定义 | 250ms（绝对值） |

**换 BPM = 所有相对时值自动调整，不用改乐谱。**

### 3.4 完整乐谱示例

```json
{
  "id": "title-theme",
  "name": "Title Screen",
  "bpm": 130,
  "timbrePack": "16bit-sfc",
  "config": {
    "loop": true,
    "reverb": "room"
  },
  "tracks": [
    {
      "timbre": "lead",
      "performance": {
        "layback": 15,
        "humanize": 0.2,
        "velocityCurve": [[0, 0.5], [4, 0.9], [8, 0.5]]
      },
      "notes": [
        { "note": "E5", "duration": "q" },
        { "note": "G5", "duration": "q" },
        { "note": "A5", "duration": "h" },
        { "note": "G5", "duration": "q", "offset": 25 },
        { "note": "E5", "duration": "q" },
        { "note": "D5", "duration": "h" },
        { "note": null, "duration": "q" },
        { "note": "E5", "duration": "q" }
      ]
    },
    {
      "timbre": "bass",
      "performance": {
        "layback": 5
      },
      "notes": [
        { "note": "A2", "duration": "w" },
        { "note": "G2", "duration": "w" }
      ]
    },
    {
      "timbre": "arp",
      "performance": {
        "swing": 0.4
      },
      "notes": [
        { "note": "A4", "duration": "e" },
        { "note": "C5", "duration": "e" },
        { "note": "E5", "duration": "e" },
        { "note": "A5", "duration": "e" },
        { "note": "G4", "duration": "e" },
        { "note": "B4", "duration": "e" },
        { "note": "D5", "duration": "e" },
        { "note": "G5", "duration": "e" }
      ]
    },
    {
      "timbre": "kick",
      "notes": [
        { "note": "C2", "duration": "q" },
        { "note": null, "duration": "q" },
        { "note": null, "duration": "q" },
        { "note": "C2", "duration": "q" },
        { "note": null, "duration": "q" },
        { "note": null, "duration": "q" },
        { "note": "C2", "duration": "q" },
        { "note": "C2", "duration": "q" }
      ]
    },
    {
      "timbre": "hihat",
      "performance": {
        "humanize": 0.15
      },
      "notes": [
        { "note": "C6", "duration": "e" },
        { "note": null, "duration": "e" },
        { "note": "C6", "duration": "e" },
        { "note": null, "duration": "e" },
        { "note": "C6", "duration": "e" },
        { "note": null, "duration": "e" },
        { "note": "C6", "duration": "e" },
        { "note": null, "duration": "e" }
      ]
    }
  ]
}
```

### 3.5 模式化（Pattern）扩展（v2 预留）

对于重复片段，v1 先用数组展开写，v2 再加 pattern 引用：

```json
{
  "patterns": {
    "drumBeat": [
      { "note": "C2", "duration": "q" },
      { "note": null, "duration": "q" },
      { "note": null, "duration": "q" },
      { "note": "C2", "duration": "q" }
    ]
  },
  "tracks": [{
    "timbre": "kick",
    "notes": [
      { "$ref": "drumBeat" },
      { "$ref": "drumBeat" }
    ]
  }]
}
```

v1 不实现 pattern 引用，但设计上预留这个扩展位。

---

## 4. 音乐辅助函数

为了让 AI 和人类不跟数学打交道，提供工具函数。

### 4.1 MusicUtils

```typescript
class MusicUtils {
  // ── 音名 ↔ 频率 ──

  /** 音名转频率：noteToFreq("A4") → 440 */
  static noteToFreq(note: string): number;

  /** 频率转音名（最近的）：freqToNote(442) → "A4" */
  static freqToNote(freq: number): string;

  // ── 时值计算 ──

  /** 时值记号转毫秒：durationToMs("q", 120) → 500 */
  static durationToMs(duration: DurationValue, bpm: number): number;

  /** BPM 转四分音符毫秒：bpmToQNoteMs(120) → 500 */
  static bpmToQNoteMs(bpm: number): number;

  // ── 音阶 ──

  /** 获取音阶在指定八度的所有音名 */
  static scale(root: string, type: ScaleType, octave?: number): string[];
  // scale("C", "major", 4) → ["C4","D4","E4","F4","G4","A4","B4"]

  /** 获取和弦的音名 */
  static chord(root: string, type: ChordType, octave?: number): string[];
  // chord("A", "minor", 3) → ["A3","C4","E4"]

  // ── 转调 ──

  /** 转调：transpose("C4", 2) → "D4" */
  static transpose(note: string, semitones: number): string;

  // ── 八度操作 ──

  /** 改变八度：setOctave("C4", 5) → "C5" */
  static setOctave(note: string, octave: number): string;
}

type ScaleType =
  | "major" | "minor" | "pentatonic" | "blues"
  | "dorian" | "mixolydian" | "phrygian" | "lydian";

type ChordType =
  | "major" | "minor" | "dim" | "aug"
  | "maj7" | "min7" | "dom7" | "sus2" | "sus4";
```

### 4.2 使用场景

**AI 写乐谱时**：
```typescript
// AI 不用算频率，直接写音名
MusicUtils.noteToFreq("A4"); // 440

// AI 不用算时值，直接写节拍
MusicUtils.durationToMs("q", 130); // ~462ms

// AI 可以程序化生成旋律
const scale = MusicUtils.scale("C", "pentatonic", 5);
// ["C5","D5","E5","G5","A5"]

// AI 可以生成和弦进行
const chord = MusicUtils.chord("A", "minor", 3);
// ["A3","C4","E4"]
```

**Score 解析时**：
```typescript
// BGMEngine 内部转换
freq = MusicUtils.noteToFreq(scoreNote.note);  // "E5" → 659.25
ms   = MusicUtils.durationToMs(scoreNote.duration, score.bpm);  // "q" → 462
```

---

## 5. Timbre Pack Loader

### 5.1 职责

```
Score 引用 timbrePack: "16bit-sfc"
          ↓
TimbrePackLoader.load("16bit-sfc")
          ↓
加载 timbres/16bit-sfc.json
          ↓
Score 引用 track.timbre: "lead"
          ↓
查找 pack.timbres["lead"]
          ↓
返回 TimbreDefinition（波形+包络+滤波器）
          ↓
BGMEngine 用频率 + TimbreDefinition 创建声音
```

### 5.2 API

```typescript
class TimbrePackLoader {
  /** 注册一个音色包（JSON 对象） */
  register(pack: TimbrePack): void;

  /** 设置当前激活的音色包 */
  setActive(name: string): void;

  /** 获取指定 timbre 的定义 */
  getTimbre(timbreName: string): TimbreDefinition | undefined;

  /** 获取当前包名 */
  getActivePackName(): string | null;

  /** 列出当前包的所有 timbre 名 */
  listTimbres(): string[];
}
```

### 5.3 与 ChipAudioEngine 集成

```typescript
const engine = new ChipAudioEngine();

// 加载 Timbre Pack
engine.loadTimbrePack(sfcPack);

// 加载乐谱（自动引用 Timbre Pack）
engine.loadScore(titleTheme);

// 播放 BGM
engine.playBGM('title-theme');
```

---

## 6. 向后兼容

### 6.1 旧格式仍可用

现有的 `BGMScore`（直接写 waveform + freq）不废弃，作为"内联模式"保留：

```typescript
// 内联模式（向后兼容）：track 直接定义波形
interface BGMTrackLegacy {
  waveform: OscillatorType | "noise";
  notes: { freq: number | null; duration: number; gain?: number }[];
  // ...
}

// Timbre Pack 模式（新）：track 引用 timbre 名
interface ScoreTrackNew {
  timbre: string;
  notes: { note: string | null; duration: DurationValue; velocity?: number }[];
  // ...
}
```

BGMEngine 检测 track 有 `timbre` 字段就走新模式，有 `waveform` 字段就走旧模式。

### 6.2 SoundPack 不受影响

SoundPack（音效定义）保持不变，Timbre Pack（BGM 音色定义）是新增的平行系统。

---

## 7. 文件结构

```
chip-audio-engine/
├── timbres/                     # Timbre Pack 目录（新增）
│   ├── schema.json             # Timbre Pack JSON Schema
│   ├── 16bit-sfc.json          # SFC/GBA 风格
│   ├── 8bit-nes.json           # NES 风格（后续）
│   └── synth-pad.json          # 合成器 Pad 风格（后续）
├── scores/                      # 乐谱目录（新增）
│   ├── schema.json             # Score JSON Schema
│   └── title-theme.json        # 示例乐谱
├── packs/                       # SoundPack 目录（已有）
│   ├── schema.json
│   └── pixel-sfc.json
└── src/
    ├── music/
    │   ├── MusicUtils.ts       # 音乐辅助函数
    │   ├── NoteParser.ts       # 音名解析器
    │   └── DurationParser.ts   # 时值解析器
    ├── core/
    │   ├── FocusManager.ts     # （已有）
    │   └── ...
    ├── engine/
    │   ├── BGMEngine.ts        # 升级：支持 timbre 引用
    │   ├── ChipAudioEngine.ts  # 升级：loadTimbrePack / loadScore
    │   └── types.ts            # 升级：新增 Score 类型
    └── config/
        ├── SoundPackLoader.ts  # （已有）
        └── TimbrePackLoader.ts # （新增）
```

---

## 8. 实现计划

| 阶段 | 内容 | 预估代码量 |
|------|------|-----------|
| Phase A | MusicUtils + NoteParser + DurationParser | ~300 行 |
| Phase B | Timbre Pack 格式 + TimbrePackLoader + schema | ~200 行 |
| Phase C | Score 格式 + Score 类型定义 + schema | ~150 行 |
| Phase D | BGMEngine 升级（支持 timbre 引用 + 音名/时值解析 + 演奏表情） | ~300 行 |
| Phase E | ChipAudioEngine 集成（loadTimbrePack / loadScore） | ~100 行 |
| Phase F | 第一个完整 Timbre Pack（16bit-sfc.json）+ 示例乐谱 | ~150 行 |
| **合计** | | **~1200 行** |

---

## 9. AI 创作工作流（目标状态）

```
1. AI 选择 Timbre Pack
   engine.loadTimbrePack(sfcPack)
   // 可用音色: lead, bass, pad, arp, kick, snare, hihat

2. AI 用音乐术语写乐谱
   {
     "bpm": 130,
     "tracks": [{
       "timbre": "lead",
       "notes: [{ "note": "E5", "duration": "q" }, ...]
     }]
   }

3. AI 可用辅助函数程序化生成
   const scale = MusicUtils.scale("A", "minor", 4);
   // → A3, B3, C4, D4, E4, F4, G4

4. 一行播放
   engine.playBGM('title-theme');

5. 换风格？
   改 timbrePack 为 "8bit-nes"
   乐谱零改动
```

**AI 从此不碰频率、波形、滤波器参数。只写音乐。**

---

## 10. 演奏表情系统（Performance Expression）

> 纯机器精度的音乐听起来死板。演奏表情系统让 AI 能控制"人味儿"。

### 10.1 设计原则

**所有表情参数都是可选的。** 不写 = 机器精度，写了 = 有人味儿。

**叠加计算**：最终时间偏移 = `track.layback` + `note.offset` + `humanize 随机`。

### 10.2 四种表情

#### Layback（拖拍）

整轨音符统一后移，制造放松感。

```
layback: 15ms  →  每个"音都比节拍晚 15ms
layback: 0ms   →  卡拍（默认）
layback: -10ms →  抢拍（罕见，制造紧张感）
```

典型值：5-30ms。超过 50ms 听起来像弹错了。

#### Swing（摇摆）

让八分音符不均匀——前长后短，产生 groove。

```
swing: 0    →  [250ms, 250ms]  直拍
swing: 0.33 →  [312ms, 188ms]  轻度 shuffle
swing: 0.66 →  [375ms, 125ms]  典型 swing（jazz/blues）
swing: 1.0  →  [500ms, 0ms]   极端（几乎三连音）
```

计算公式：`前半 = baseMs × (1 + swing)`，`后半 = baseMs × 2 - 前半`。

只影响八分音符和更短的时值（e / s / t），不影响四分及以上。

#### Humanize（人性化）

给每个音符加随机微偏移，去掉机器感。

```
humanize: 0   →  关闭
humanize: 0.2 →  微妙（±6ms 时间偏移，±0.03 力度偏移）
humanize: 0.5 →  明显（±15ms，±0.075）
humanize: 0.8 →  夸张（±24ms，±0.12）
```

实际范围：
- 时间偏移 = `(Math.random() * 2 - 1) × humanize × 30` ms
- 力度偏移 = `(Math.random() * 2 - 1) × humanize × 0.15`

使用 seeded PRNG（基于 scoreId + trackIndex + noteIndex），保证同一乐谱每次播放的 humanize 结果一致（可复现）。

#### Velocity Curve（力度曲线）

跨多个音符的渐强/渐弱，用控制点插值。

```json
"velocityCurve": [[0, 0.3], [4, 1.0], [8, 0.3]]
```

含义：
- 第 0 个音符力度 × 0.3（弱起）
- 第 4 个音符力度 × 1.0（高潮）
- 第 8 个音符力度 × 0.3（回落）
- 中间线性插值

力度倍率与 per-note `velocity` 相乘：`最终力度 = note.velocity × curveMultiplier`。

### 10.3 叠加优先级

```
最终时间偏移 = track.performance.layback
              + note.offset
              + humanize(随机)

最终力度 = timbre 默认音量
          × track.volume
          × note.velocity
          × velocityCurve(noteIndex)
          × (1 + humanize(随机))

Swing 单独作用于时值解析阶段，不与 offset 叠加
```

### 10.4 使用示例

**放松的 lead**（微微拖拍 + 人性化）：
```json
{
  "timbre": "lead",
  "performance": {
    "layback": 15,
    "humanize": 0.2
  }
}
```

**爵士 swing arp**：
```json
{
  "timbre": "arp",
  "performance": {
    "swing": 0.55,
    "humanize": 0.3
  }
}
```

**渐强渐弱的 pad**：
```json
{
  "timbre": "pad",
  "performance": {
    "velocityCurve": [[0, 0.2], [3, 0.8], [6, 0.8], [8, 0.2]]
  }
}
```

**精确的鼓组**（不加表情，卡拍）：
```json
{
  "timbre": "kick",
  "notes": [{ "note": "C2", "duration": "q" }]
}
```

**人类化的 hi-hat**：
```json
{
  "timbre": "hihat",
  "performance": {
    "humanize": 0.15
  }
}
```
