# Chip Audio Engine API 参考

本文档列出 `chip-audio-engine` 所有公开 API 的详细说明。

---

## 目录

- [ChipAudioEngine](#chipaudioengine)
- [AudioBus](#audiobus)
- [ChannelPool](#channelpool)
- [Aggregator](#aggregator)
- [DuckManager](#duckmanager)
- [OscillatorProvider](#oscillatorprovider)
- [SampleProvider](#sampleprovider)
- [ReverbEngine](#reverbengine)
- [SpatialAudio](#spatialaudio)
- [BGMEngine](#bgmengine)
- [TimbrePackLoader](#timbrepackloader)
- [MusicUtils](#musicutils)
- [FocusManager](#focusmanager)
- [ScoreValidator](#scorevalidator)
- [ScoreV2](#scorev2)
- [V2Compiler](#v2compiler)
- [V1ToV2Converter](#v1tov2converter)
- [EventEmitter](#eventemitter)
- [SoundPackLoader](#soundpackloader)

---

## ChipAudioEngine

引擎主入口，负责管理音频上下文、总线树、声道池、音效播放、BGM 播放以及闪避和聚合策略。

```typescript
import { ChipAudioEngine } from 'chip-audio-engine';

const engine = new ChipAudioEngine(config);
engine.init();
```

### 构造函数

```typescript
new ChipAudioEngine(config?: EngineConfig)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | `EngineConfig` | 可选的初始化配置 |

`EngineConfig` 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `audioContext` | `AudioContext` | 可选的外部音频上下文 |
| `channelCount` | `number` | 声道池最大声道数，默认 8 |
| `soundPack` | `SoundPack` | 初始音效包 |
| `bgmScores` | `BGMScore[]` | 初始加载的旧格式 BGM 乐谱 |

### 方法

#### `init(): void`

初始化音频上下文和内部总线树。可重复调用（幂等）。

```typescript
const engine = new ChipAudioEngine();
engine.init();
```

#### `play(soundId: string, playParams?: PlayParams): void`

播放指定音效。

| 参数 | 类型 | 说明 |
|------|------|------|
| `soundId` | `string` | 音效标识符 |
| `playParams` | `PlayParams` | 可选的播放覆盖参数 |

```typescript
engine.play('game.jump', { volume: 0.8, pitch: 1.2 });
```

#### `stop(soundId: string): void`

停止指定音效（如果正在播放）。

```typescript
engine.stop('game.jump');
```

#### `stopAll(): void`

停止所有正在播放的音效。

```typescript
engine.stopAll();
```

#### `destroy(): void`

销毁引擎，停止所有声音，并关闭自有的音频上下文。可重复调用（幂等）。

```typescript
engine.destroy();
```

#### `suspend(): void`

暂停自有的音频上下文。

```typescript
engine.suspend();
```

#### `resume(): void`

恢复自有的音频上下文。

```typescript
engine.resume();
```

#### `isSuspended(): boolean`

检查自有的音频上下文是否处于暂停状态。

```typescript
if (engine.isSuspended()) {
  engine.resume();
}
```

#### `registerProvider(provider: SoundProvider): void`

注册自定义音效提供者。

```typescript
engine.registerProvider(new CustomProvider());
```

#### `loadSoundPack(pack: SoundPack): void`

加载并激活音效包。

```typescript
engine.loadSoundPack({
  name: 'pixel-sfc',
  sounds: { 'ui.click': { duration: 50 } },
});
```

#### `loadTimbrePack(pack: TimbrePack): void`

加载音色包。

```typescript
engine.loadTimbrePack({
  name: 'pixel-sfc',
  timbres: {
    lead: { provider: 'oscillator', waveforms: [{ type: 'square' }] },
  },
});
```

#### `loadScore(score: Score): void`

加载新格式乐谱。

```typescript
engine.loadScore({
  id: 'title',
  name: 'Title',
  bpm: 120,
  timbrePack: 'pixel-sfc',
  tracks: [],
});
```

#### `getBus(busId: string): AudioBus | undefined`

按 ID 递归查找总线。

```typescript
const musicBus = engine.getBus('music');
```

#### `getMasterBus(): AudioBus | null`

获取主输出总线。

```typescript
const master = engine.getMasterBus();
```

#### `playBGM(scoreId: string, options?: { fadeIn?: number }): void`

按 ID 播放 BGM 乐谱。

```typescript
engine.playBGM('title', { fadeIn: 500 });
```

#### `stopBGM(options?: { fadeOut?: number }): void`

停止当前播放的 BGM。

```typescript
engine.stopBGM({ fadeOut: 800 });
```

#### `getBGMEngine(): BGMEngine | null`

获取 BGM 引擎实例。

```typescript
const bgm = engine.getBGMEngine();
```

#### `addDuckRule(rule: DuckRule): void`

添加闪避规则。

```typescript
engine.addDuckRule({
  trigger: 'bgm',
  target: 'sfx',
  duckVolume: 0.3,
  fadeOutMs: 300,
  fadeInMs: 800,
  holdMs: 0,
});
```

#### `setAggregation(soundId: string, config: AggregationConfig): void`

为指定音效配置聚合行为。

```typescript
engine.setAggregation('ui.click', { strategy: 'debounce', windowMs: 150 });
```

#### `setFocusMode(mode: FocusMode, config?: FocusConfig): void`

设置声音焦点模式。

```typescript
engine.setFocusMode('follow', { target: { x: 100, y: 200 } });
```

#### `getFocusMode(): FocusMode`

获取当前焦点模式。

```typescript
const mode = engine.getFocusMode();
```

#### `setReverb(preset: string): void`

切换混响预设（`room` / `hall` / `plate`）。

```typescript
engine.setReverb('hall');
```

#### `setReverbParams(params: ReverbParams): void`

微调当前混响参数。

```typescript
engine.setReverbParams({ wetMix: 0.4, decayTime: 300 });
```

### 属性

#### `masterVolume: number`

获取或设置主总线音量（0–1）。

```typescript
const vol = engine.masterVolume;
engine.masterVolume = 0.75;
```

#### `masterMuted: boolean`

获取或设置主总线静音状态。

```typescript
const muted = engine.masterMuted;
engine.masterMuted = true;
```

### 事件

通过 `engine.on(event, handler)` 监听：

| 事件 | 载荷 | 说明 |
|------|------|------|
| `play` | `{ soundId: string; channelId: number }` | 单个音效开始播放 |
| `stop` | `{ soundId: string; reason: 'completed' \| 'manual' \| 'stolen' }` | 单个音效停止 |
| `bus:volume` | `{ busId: string; volume: number }` | Bus 音量变化 |
| `bus:mute` | `{ busId: string; muted: boolean }` | Bus 静音状态变化 |
| `error` | `{ soundId?: string; error: Error }` | 播放过程中发生错误 |
| `engine:init` | `{ audioContext: AudioContext }` | 引擎初始化完成 |
| `engine:destroy` | `Record<string, never>` | 引擎销毁 |
| `engine:suspend` | `Record<string, never>` | 引擎暂停 |
| `engine:resume` | `Record<string, never>` | 引擎恢复 |
| `bus:add` | `{ parentId: string; busId: string }` | 子 Bus 被添加 |
| `provider:register` | `{ providerId: string }` | Provider 注册 |
| `pack:load` | `{ packName: string; soundCount: number }` | SoundPack 加载 |
| `bgm:start` | `{ scoreId: string }` | BGM 开始播放 |
| `bgm:stop` | `{ scoreId: string }` | BGM 停止播放 |
| `focus:change` | `{ mode: FocusMode; config: FocusConfig }` | 焦点模式切换 |

---

## AudioBus

音频总线，封装 `GainNode` 实现层级音量控制。

```typescript
import { AudioBus } from 'chip-audio-engine';

const master = new AudioBus(ctx, 'master');
const music = new AudioBus(ctx, 'music', master);
master.output.connect(ctx.destination);
```

### 构造函数

```typescript
new AudioBus(context: BaseAudioContext, id: string, parent?: AudioBus | null)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `context` | `BaseAudioContext` | 音频上下文 |
| `id` | `string` | 总线标识符 |
| `parent` | `AudioBus` | 可选的父总线 |

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 总线标识符（只读） |
| `parent` | `IAudioBus \| null` | 父总线（只读） |
| `input` | `AudioNode` | 底层 GainNode，作为总线输入 |
| `output` | `AudioNode` | 底层 GainNode，作为总线输出 |
| `volume` | `number` | 当前音量（0–1） |
| `muted` | `boolean` | 静音状态 |

### 方法

#### `setVolume(value: number): void`

设置音量值（超出范围会被裁剪到 0–1）。

```typescript
bus.setVolume(0.75);
```

#### `setMuted(value: boolean): void`

设置静音状态。

```typescript
bus.setMuted(true);
```

#### `fadeTo(target: number, durationMs: number): void`

渐变到目标音量。

| 参数 | 类型 | 说明 |
|------|------|------|
| `target` | `number` | 目标音量（0–1） |
| `durationMs` | `number` | 渐变时长（毫秒） |

```typescript
bus.fadeTo(0, 500);
```

#### `addBus(subBus: AudioBus): void`

添加子总线。子总线必须没有父总线。若子总线是自己、已有父总线或 ID 已存在则抛出错误。

```typescript
master.addBus(new AudioBus(ctx, 'music'));
```

#### `getBus(id: string): AudioBus | undefined`

递归查找总线。若 ID 匹配自身则返回自身。

```typescript
const found = master.getBus('music');
```

#### `getActiveCount(): number`

获取附加到该总线的子总线数量。

```typescript
const count = master.getActiveCount();
```

---

## ChannelPool

声道池，管理有限数量的音频声道。

```typescript
import { ChannelPool } from 'chip-audio-engine';

const pool = new ChannelPool({ maxChannels: 8, reservedChannels: 1 });
```

### 构造函数

```typescript
new ChannelPool(options?: ChannelPoolOptions)
```

`ChannelPoolOptions`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxChannels` | `number` | 最大声道数，默认 8 |
| `reservedChannels` | `number` | 保留声道数，默认 1 |

### 方法

#### `allocate(soundId: string, priority?: number): number | null`

分配一个非保留声道。若所有非保留声道都被占用，会尝试抢占优先级最低的声道。

| 参数 | 类型 | 说明 |
|------|------|------|
| `soundId` | `string` | 音效标识符 |
| `priority` | `number` | 优先级，越高越不容易被抢占，默认 0 |

**返回：** 声道 ID，若无可用声道且优先级过低则返回 `null`。

```typescript
const channelId = pool.allocate('game.jump', 1);
```

#### `allocateReserved(soundId: string): number | null`

分配一个保留声道。

```typescript
const channelId = pool.allocateReserved('bgm.theme');
```

#### `release(channelId: number): void`

释放指定声道以便重用。无效 ID 无操作。

```typescript
pool.release(3);
```

#### `releaseAll(): void`

释放所有声道（包括保留声道）。

```typescript
pool.releaseAll();
```

#### `isInUse(channelId: number): boolean`

检查指定声道是否已被分配。

```typescript
const inUse = pool.isInUse(3);
```

#### `getUsedCount(): number`

获取当前已使用的声道数量。

```typescript
const count = pool.getUsedCount();
```

#### `getFreeCount(): number`

获取当前空闲的声道数量。

```typescript
const free = pool.getFreeCount();
```

#### `getMaxChannels(): number`

获取最大声道数。

```typescript
const max = pool.getMaxChannels();
```

---

## Aggregator

聚合器用于控制同一音效的重复提交行为，避免声音爆炸。

```typescript
import { Aggregator, AggregationConfig } from 'chip-audio-engine';

const aggregator = new Aggregator();
aggregator.setDefaultConfig({ strategy: 'debounce', windowMs: 200 });
if (aggregator.submit('ui.click', 0)) {
  engine.play('ui.click');
}
```

### 类型

```typescript
type AggregationStrategy = 'restart' | 'arpeggio' | 'stack' | 'debounce';

interface AggregationConfig {
  strategy: AggregationStrategy;
  windowMs?: number;
  maxQueueDepth?: number;
}
```

### 方法

#### `setConfig(soundId: string, config: AggregationConfig): void`

为指定音效配置聚合策略。

```typescript
aggregator.setConfig('game.jump', { strategy: 'stack', windowMs: 100, maxQueueDepth: 3 });
```

#### `setDefaultConfig(config: AggregationConfig): void`

设置默认聚合策略（用于未单独配置的声音）。

```typescript
aggregator.setDefaultConfig({ strategy: 'restart' });
```

#### `removeAllConfigs(): void`

移除所有音效的单独聚合配置（保留默认配置）。

```typescript
aggregator.removeAllConfigs();
```

#### `submit(soundId: string, priority: number): boolean`

提交一次播放请求，由聚合器决定是否允许播放。

| 参数 | 类型 | 说明 |
|------|------|------|
| `soundId` | `string` | 音效标识符 |
| `priority` | `number` | 优先级 |

**返回：** 如果请求应继续播放则返回 `true`。

```typescript
if (aggregator.submit('ui.click', 0)) {
  engine.play('ui.click');
}
```

#### `reset(): void`

清除所有活跃的聚合状态和待处理定时器。

```typescript
aggregator.reset();
```

---

## DuckManager

闪避管理器，根据规则自动调节目标总线音量。

```typescript
import { DuckManager, DuckRule } from 'chip-audio-engine';

const dm = new DuckManager();
dm.addRule({
  trigger: 'bgm',
  target: 'sfx',
  duckVolume: 0.3,
  fadeOutMs: 300,
  fadeInMs: 800,
  holdMs: 0,
});
```

### 类型

```typescript
interface DuckRule {
  trigger: string;
  target: string;
  duckVolume: number;
  fadeOutMs: number;
  fadeInMs: number;
  holdMs: number;
}
```

### 方法

#### `addRule(rule: DuckRule): void`

注册一条闪避规则。

```typescript
duckManager.addRule({
  trigger: 'dialogue',
  target: 'music',
  duckVolume: 0.2,
  fadeOutMs: 200,
  fadeInMs: 500,
  holdMs: 0,
});
```

#### `removeRule(trigger: string, target: string): void`

按 trigger 和 target 移除闪避规则。

```typescript
duckManager.removeRule('dialogue', 'music');
```

#### `getDuckRules(soundId: string): DuckRule[]`

获取指定声音作为 trigger 的所有规则。

```typescript
const rules = duckManager.getDuckRules('bgm');
```

#### `setActive(soundId: string): void`

标记 trigger 声音已开始播放。

```typescript
duckManager.setActive('bgm');
```

#### `clearActive(soundId: string): void`

标记 trigger 声音已停止播放。

```typescript
duckManager.clearActive('bgm');
```

#### `isDucked(target: string): boolean`

检查目标总线是否正在被闪避。

```typescript
const isDucked = duckManager.isDucked('sfx');
```

#### `getOriginalVolume(target: string): number`

获取目标总线的原始音量（默认 1）。

```typescript
const original = duckManager.getOriginalVolume('sfx');
```

#### `setOriginalVolume(target: string, volume: number): void`

设置目标总线的原始音量。

```typescript
duckManager.setOriginalVolume('sfx', 0.8);
```

#### `clearAll(): void`

重置所有规则和活跃状态。

```typescript
duckManager.clearAll();
```

---

## OscillatorProvider

振荡器提供者，通过 Web Audio API 的 `OscillatorNode` 合成声音。

```typescript
import { OscillatorProvider } from 'chip-audio-engine';

const provider = new OscillatorProvider();
engine.registerProvider(provider);
```

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 提供者标识，固定为 `'oscillator'` |
| `capabilities` | `SoundProviderCapabilities` | 支持 `synth` 类型，无限复音，支持实时参数 |

### 方法

#### `createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance`

创建振荡器声音实例。

```typescript
const sound = provider.createSound(ctx, 'ui.click', params);
```

#### `preload(soundIds: string[]): Promise<void>`

预加载（振荡器无需外部资源，直接 resolve）。

```typescript
await provider.preload(['ui.click', 'game.jump']);
```

---

## SampleProvider

采样提供者，通过 `AudioBuffer` 播放预加载的采样音频。

```typescript
import { SampleProvider } from 'chip-audio-engine';

const provider = new SampleProvider(audioContext);
provider.registerUrl('explosion', '/sfx/explosion.wav');
await provider.preload(['explosion']);
engine.registerProvider(provider);
```

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 提供者标识，固定为 `'sample'` |
| `capabilities` | `SoundProviderCapabilities` | 支持 `sample` 类型，无限复音，不支持实时参数 |

### 方法

#### `registerUrl(soundId: string, url: string): void`

为指定 soundId 注册 URL，供 `preload` 使用。

```typescript
provider.registerUrl('explosion', '/sfx/explosion.wav');
```

#### `registerBuffer(soundId: string, buffer: AudioBuffer): void`

为指定 soundId 注册已解码的 `AudioBuffer`。

```typescript
provider.registerBuffer('explosion', audioBuffer);
```

#### `createSound(ctx: BaseAudioContext, soundId: string, params: SoundParams): SoundInstance`

创建采样声音实例。

```typescript
const sound = provider.createSound(ctx, 'explosion', params);
```

#### `preload(soundIds: string[]): Promise<void>`

预加载指定音效。失败会静默忽略，不会阻塞其他 URL。

```typescript
await provider.preload(['explosion', 'ui.click']);
```

---

## ReverbEngine

混响引擎，通过程序化 IR 提供轻量短尾混响。支持预设切换与全局 send bus 共享。

内部节点链：`input → [preDelay] → convolver → wetGain → output`

```typescript
import { ReverbEngine } from 'chip-audio-engine';

const reverb = new ReverbEngine(ctx, 'hall');
musicBus.output.connect(reverb.input);
reverb.output.connect(masterBus.input);
```

### 构造函数

```typescript
new ReverbEngine(ctx: BaseAudioContext, presetName?: string)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `ctx` | `BaseAudioContext` | 音频上下文 |
| `presetName` | `string` | 初始预设，默认 `'room'` |

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `input` | `GainNode` | Send 目标节点 |
| `output` | `GainNode` | Wet 返回节点 |
| `isEnabled` | `boolean` | 混响启用状态（只读） |

### 方法

#### `setPreset(presetName: string): void`

切换混响预设（`room` / `hall` / `plate`）。

```typescript
reverb.setPreset('hall');
```

#### `setParams(params: ReverbParams): void`

微调当前混响参数并重新生成 IR。

`ReverbParams`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `decayTime` | `number` | 衰减时间（毫秒） |
| `wetMix` | `number` | 湿信号混合比（0–1） |
| `preDelay` | `number` | 预延迟（毫秒） |
| `hfDamping` | `number` | 高频阻尼（0–1） |

```typescript
reverb.setParams({ wetMix: 0.4, decayTime: 300 });
```

#### `enable(): void`

启用混响（恢复 wet gain）。

```typescript
reverb.enable();
```

#### `disable(): void`

旁路混响（wet gain 置 0，不销毁节点）。

```typescript
reverb.disable();
```

#### `dispose(): void`

断开并清理内部节点。

```typescript
reverb.dispose();
```

---

## SpatialAudio

基于 2D 视口的空间音频定位，将声源位置映射为 stereo pan、距离滤音与混响 send。

底层组合：`DistanceFilter + StereoPannerNode`

```typescript
import { SpatialAudio } from 'chip-audio-engine';

const spatial = new SpatialAudio(ctx);
spatial.updatePosition(32, 32, { centerX: 32, centerY: 32, width: 64, height: 64 });
sound.connect(spatial.input);
spatial.output.connect(bus.input);
```

### 构造函数

```typescript
new SpatialAudio(ctx: BaseAudioContext)
```

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `input` | `GainNode` | 声音输入节点 |
| `output` | `GainNode` | 干声输出（接至 gameplay bus） |
| `send` | `GainNode` | 混响 send（接至全局 ReverbEngine） |

### 方法

#### `updatePosition(sourceX: number, sourceY: number, viewport: Viewport): void`

更新声源位置与视口参数。

| 参数 | 类型 | 说明 |
|------|------|------|
| `sourceX` | `number` | 声源 X 坐标 |
| `sourceY` | `number` | 声源 Y 坐标 |
| `viewport` | `Viewport` | 视口描述 |

`Viewport`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `centerX` | `number` | 视口中心 X |
| `centerY` | `number` | 视口中心 Y |
| `width` | `number` | 视口宽度 |
| `height` | `number` | 视口高度 |

```typescript
spatial.updatePosition(10, 20, { centerX: 32, centerY: 32, width: 64, height: 64 });
```

#### `dispose(): void`

断开并清理所有节点。

```typescript
spatial.dispose();
```

---

## BGMEngine

后台音乐（BGM）引擎，负责按 Score 调度音符播放。

```typescript
import { ChipAudioEngine } from 'chip-audio-engine';

const engine = new ChipAudioEngine();
engine.init();
const bgm = engine.getBGMEngine()!;
bgm.loadScore({ id: 'title', name: 'Title Theme', bpm: 120, tracks: [] });
bgm.play('title', { fadeIn: 500 });
```

### 构造函数

BGMEngine 由 `ChipAudioEngine` 内部创建，通常不需要手动实例化。

```typescript
new BGMEngine(
  ctx: AudioContext,
  provider: OscillatorProvider,
  musicBus: AudioBus,
  duckManager?: DuckManager,
  timbrePackLoader?: TimbrePackLoader
)
```

### 方法

#### `loadScore(score: BGMScore): void`

加载单个 BGM 乐谱（旧格式）。

```typescript
bgm.loadScore({ id: 'boss', name: 'Boss', bpm: 140, tracks: [] });
```

#### `loadNewScore(score: Score): void`

加载新格式 Score 乐谱。

```typescript
bgm.loadNewScore({ id: 'boss', name: 'Boss', bpm: 140, timbrePack: 'sfc', tracks: [] });
```

#### `loadV2Score(score: ScoreV2): void`

加载 v2 格式乐谱。内部通过 `V2Compiler` 编译为 v1 后存储。

```typescript
bgm.loadV2Score({
  $schema: 'cae-score-v2',
  meta: { title: 'Boss', bpm: 140, timeSignature: [4, 4], timbrePack: 'sfc' },
  tracks: [{ name: 'lead', timbre: 'lead' }],
  chapters: [{ id: 'main', bars: 16 }],
  score: [{ chapter: 'main', bar: 1, t: { lead: [['C4', 'q', 1]] } }],
});
```

#### `playV2(score: ScoreV2, options?: { fadeIn?: number }): void`

直接播放 v2 乐谱（无需预先用 `loadV2Score` 加载）。

```typescript
bgm.playV2(v2Score, { fadeIn: 500 });
```

#### `loadScores(scores: BGMScore[]): void`

批量加载 BGM 乐谱。

```typescript
bgm.loadScores([
  { id: 'stage1', name: 'Stage 1', bpm: 120, tracks: [] },
]);
```

#### `unloadScore(scoreId: string): void`

卸载指定乐谱。如果当前正在播放该乐谱，会先停止。

```typescript
bgm.unloadScore('boss');
```

#### `play(scoreId: string, options?: { fadeIn?: number }): void`

播放指定 BGM 乐谱。

```typescript
bgm.play('title', { fadeIn: 1000 });
```

#### `stop(options?: { fadeOut?: number }): void`

停止当前播放的 BGM。

```typescript
bgm.stop({ fadeOut: 500 });
```

#### `isCurrentlyPlaying(): boolean`

检查是否正在播放 BGM。

```typescript
if (bgm.isCurrentlyPlaying()) {
  console.log('BGM is playing');
}
```

#### `getCurrentScoreId(): string | null`

获取当前播放的乐谱 ID。

```typescript
const id = bgm.getCurrentScoreId();
```

#### `getLoadedScoreIds(): string[]`

获取所有已加载的乐谱 ID 列表。

```typescript
const ids = bgm.getLoadedScoreIds();
```

#### `dispose(): void`

释放 BGM 引擎资源。

```typescript
bgm.dispose();
```

### 事件

通过 `bgm.on(event, handler)` 监听：

| 事件 | 载荷 | 说明 |
|------|------|------|
| `bgm:start` | `{ scoreId: string }` | BGM 开始播放 |
| `bgm:stop` | `{ scoreId: string }` | BGM 停止播放 |

---

## TimbrePackLoader

音色包加载器，管理音色包的注册与激活。

```typescript
import { TimbrePackLoader } from 'chip-audio-engine';

const loader = new TimbrePackLoader();
loader.register({ name: '16bit-sfc', timbres: { lead: { provider: 'oscillator' } } });
loader.setActive('16bit-sfc');
const timbre = loader.getTimbre('lead');
```

### 方法

#### `register(pack: TimbrePack): void`

注册音色包。若已存在同名包则覆盖。

```typescript
loader.register({ name: '16bit-sfc', timbres: {} });
```

#### `setActive(name: string): boolean`

切换到指定音色包。未注册则返回 `false`。

```typescript
const ok = loader.setActive('16bit-sfc');
```

#### `getTimbre(timbreName: string): TimbreDefinition | undefined`

从当前激活的包中获取音色定义。

```typescript
const timbre = loader.getTimbre('lead');
```

#### `getActivePackName(): string | null`

获取当前激活包的名称。

```typescript
const name = loader.getActivePackName();
```

#### `listTimbres(): string[]`

列出当前激活包中的所有音色名称。

```typescript
const names = loader.listTimbres();
```

---

## MusicUtils

音乐辅助函数集合，包含音名频率转换、时值计算、音阶与和弦生成等。

```typescript
import { MusicUtils } from 'chip-audio-engine';
```

### 静态方法

#### `noteToFreq(note: string): number`

将音名转换为频率（Hz）。

```typescript
const freq = MusicUtils.noteToFreq('A4'); // 440
```

#### `freqToNote(freq: number): string`

将频率转换为最近的音名。

```typescript
const note = MusicUtils.freqToNote(440); // 'A4'
```

#### `durationToMs(duration: DurationValue, bpm: number): number`

将时值转换为毫秒数。

```typescript
const ms = MusicUtils.durationToMs('q', 120); // 500
```

#### `bpmToQNoteMs(bpm: number): number`

计算四分音符时长（毫秒）。

```typescript
const ms = MusicUtils.bpmToQNoteMs(120); // 500
```

#### `scale(root: string, type: ScaleType, octave?: number): string[]`

生成指定根音与类型的音阶。

`ScaleType`：`major` | `minor` | `pentatonic` | `blues` | `dorian` | `mixolydian` | `phrygian` | `lydian`

```typescript
const cMajor = MusicUtils.scale('C', 'major', 4);
// ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']
```

#### `chord(root: string, type: ChordType, octave?: number): string[]`

生成指定根音与类型的和弦。

`ChordType`：`major` | `minor` | `dim` | `aug` | `maj7` | `min7` | `dom7` | `sus2` | `sus4`

```typescript
const cMajor = MusicUtils.chord('C', 'major', 4);
// ['C4', 'E4', 'G4']
```

#### `transpose(note: string, semitones: number): string`

将音名移调指定半音数。

```typescript
const d5 = MusicUtils.transpose('C5', 2); // 'D5'
```

#### `setOctave(note: string, octave: number): string`

将音名设置为指定八度。

```typescript
const c3 = MusicUtils.setOctave('C5', 3); // 'C3'
```

---

## FocusManager

焦点模式状态机。纯计算模块，不依赖 Web Audio API。根据当前焦点模式将声源位置映射为 pan / distance，供 `SpatialAudio` 使用。

```typescript
import { FocusManager } from 'chip-audio-engine';

const fm = new FocusManager();
fm.setMode('follow', { target: { x: 100, y: 200 } });
const result = fm.computeSpatial({ x: 50, y: 50 }, viewport);
```

### 类型

```typescript
type FocusMode = 'viewport' | 'follow' | 'zone' | 'legion';

interface FollowConfig {
  target: { x: number; y: number };
}

interface ZoneConfig {
  centerX: number;
  centerY: number;
  radius: number;
}

interface LegionConfig {
  targets: Array<{ x: number; y: number }>;
}

type FocusConfig = FollowConfig | ZoneConfig | LegionConfig | undefined;
```

### 方法

#### `setMode(mode: FocusMode, config?: FocusConfig): void`

设置焦点模式与配置。

```typescript
fm.setMode('zone', { centerX: 100, centerY: 200, radius: 50 });
```

#### `getMode(): FocusMode`

获取当前焦点模式。

```typescript
const mode = fm.getMode();
```

#### `getConfig(): FocusConfig`

获取当前配置。

```typescript
const config = fm.getConfig();
```

#### `computeSpatial(soundPos: Point2D, viewport: Viewport): SpatialResult`

根据当前焦点模式计算空间音频参数。

| 参数 | 类型 | 说明 |
|------|------|------|
| `soundPos` | `Point2D` | 声源位置 `{ x, y }` |
| `viewport` | `Viewport` | 视口信息 `{ centerX, centerY, width, height }` |

**返回：** `{ pan: number; distance: number }`

- `pan`：[-1, 1]，-1 为完全左声道，1 为完全右声道
- `distance`：欧几里得距离（像素）

```typescript
const { pan, distance } = fm.computeSpatial({ x: 10, y: 20 }, viewport);
```

---

## ScoreValidator

校验 Score JSON 对象是否语法正确。

```typescript
import { validateScore, ValidationResult, ValidationError } from 'chip-audio-engine';
```

### 类型

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
}
```

### 函数

#### `validateScore(score: unknown): ValidationResult`

校验一个 Score 对象。返回包含所有发现错误的结果。

```typescript
const result = validateScore(json);
if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.path}: ${err.message}`);
  }
}
```

**校验规则摘要：**

- `id`、`name`、`timbrePack`：必填非空字符串
- `bpm`：必填数字，范围 `(0, 300]`
- `config.loop`：若存在必须为 `boolean`
- `config.volume`：若存在必须为 `[0, 1]` 数字
- `config.reverb`：若存在必须为字符串
- `tracks`：必填非空数组
- `track.timbre`：必填非空字符串
- `track.volume`：若存在必须为 `[0, 1]`
- `track.transpose`：若存在必须为 `[-24, 24]`
- `track.performance.swing`：`[0, 1]`
- `track.performance.humanize`：`[0, 1]`
- `track.performance.layback`：`[-100, 100]`
- `track.performance.velocityCurve`：最小 2 个 `[index, multiplier]` 点
- `note.note`：必须为音名字符串（如 `C4`、`A#3`）或 `null`
- `note.duration`：必须为时值符号或正数毫秒
- `note.velocity`：`[0, 1]`
- `note.offset`：`[-100, 100]`

---

## ScoreV2Validator

校验 Score v2 JSON 对象是否语法正确。

```typescript
import { validateScoreV2 } from 'chip-audio-engine/dist/music/ScoreV2Validator.js';
```

### 函数

#### `validateScoreV2(score: unknown): ValidationResult`

校验一个 ScoreV2 对象。返回包含所有发现错误的结果。

```typescript
const result = validateScoreV2(v2Json);
if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.path}: ${err.message}`);
  }
}
```

**校验规则摘要：**

- `$schema`：必须为 `"cae-score-v2"`
- `meta.title`：必填非空字符串
- `meta.bpm`：必填数字，`[20, 300]`
- `meta.timeSignature`：必填 `[number, number]`，正整数
- `meta.timbrePack`：必填非空字符串
- `meta.complexity`：若存在必须为 `minimal` / `standard` / `extended`
- `tracks`：必填非空数组
- `track.name`：必填唯一字符串
- `track.timbre`：必填非空字符串
- `track.volume`：若存在必须为 `[0, 1]`
- `track.perf.layback`：若存在必须为数字
- `track.perf.humanize`：若存在必须为 `[0, 1]`
- `track.perf.swing`：若存在必须为 `[0, 1]`
- `track.perf.velocity.curve`：`linear` 或 `step`
- `track.perf.velocity.points`：`[anchor, value]` 数组
- `chapters`：必填非空数组
- `chapter.id`：必填唯一字符串
- `chapter.bars`：必填正整数
- `chapter.transition`：若存在必须为非负整数
- `patterns`：若存在必须为对象
- `pattern` 内容：按 track 分组的 `NoteTuple[]`
- `score`：必填数组
- `bar.chapter`：必须引用已声明的 chapter
- `bar.bar`：必须在 chapter 的小节范围内
- `bar.ref`：若存在必须引用本 chapter 内有效小节
- `bar.silence`：若存在必须为 `boolean`
- `bar.blend.next`：必须引用已声明的 chapter
- `bar.blend.weight`：`[0, 1]`
- `bar.t` / `bar.override`：track 内容必须为 `NoteTuple[]`、字符串 pattern 引用或 `PatternRef` 对象
- `NoteTuple`：`[note, duration, beat?]`，`note` 为 `"R"` 或音名，`duration` 为合法时值符号

---

## ScoreV2

Score v2 类型定义。v2 是创作格式，解决音轨对齐、断点续写、章节过渡、字面量压缩。

### 类型

```typescript
interface ScoreV2 {
  $schema: 'cae-score-v2';
  meta: ScoreV2Meta;
  tracks: ScoreV2Track[];
  patterns?: { [name: string]: PatternDef };
  chapters: Chapter[];
  score: Bar[];
}

interface ScoreV2Meta {
  $schema: 'cae-score-v2';
  title: string;
  bpm: number;
  timeSignature: [number, number];
  timbrePack: string;
  complexity?: 'minimal' | 'standard' | 'extended';
  duration?: string;
}

interface ScoreV2Track {
  name: string;
  timbre: string;
  perf?: Performance;
  volume?: number;
  mute?: boolean;
}

interface Performance {
  layback?: number;
  humanize?: number;
  swing?: number;
  velocity?: VelocityCurve;
}

interface VelocityCurve {
  curve: 'linear' | 'step';
  points: [string | number, number][];
}

interface Chapter {
  id: string;
  bars: number;
  transition?: number;
  mood?: string;
}

interface Bar {
  chapter: string;
  bar: number;
  t?: { [trackName: string]: BarTrackContent };
  ref?: number;
  override?: { [trackName: string]: BarTrackContent };
  silence?: boolean;
  blend?: BlendDef;
}

type BarTrackContent = NoteTuple[] | string | PatternRef;

type NoteTuple = [string, string, (string | number)?];

interface PatternDef {
  [trackName: string]: NoteTuple[];
}

interface PatternRef {
  $ref: string;
  transpose?: number;
  velocity?: number;
}

interface BlendDef {
  next: string;
  weight: number;
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `meta` | 全局元数据：标题、BPM、拍号、音色包 |
| `tracks` | 音轨声明，含演奏参数 `perf` |
| `patterns` | 可复用的音符片段库 |
| `chapters` | 章节定义，`bars` 为小节数，`transition` 为过渡重叠区 |
| `score` | 小节序列，`t` 为 track 内容，`ref` 复用本 chapter 小节 |
| `silence` | 全静音小节 |
| `blend` | 过渡混合定义，`next` 为下一 chapter，`weight` 为混合权重 |

---

## V2Compiler

Score v2 → v1 编译器。将 v2 的小节网格、pattern 引用、velocity 曲线展开为 v1 的扁平格式。

```typescript
import { V2Compiler } from 'chip-audio-engine/dist/music/V2Compiler.js';
```

### 静态方法

#### `compile(v2: ScoreV2): Score`

编译 ScoreV2 为 v1 Score。

```typescript
const v1Score = V2Compiler.compile(v2Score);
```

### 实例方法

#### `compile(v2: ScoreV2): Score`

实例方法，功能与静态方法相同。

```typescript
const compiler = new V2Compiler();
const v1Score = compiler.compile(v2Score);
```

---

## V1ToV2Converter

v1 Score → v2 ScoreV2 转换器。将扁平的 v1 音符序列转换为 v2 的小节网格、pattern 引用和 velocity 曲线。

```typescript
import { V1ToV2Converter } from 'chip-audio-engine/dist/music/V1ToV2Converter.js';
```

### 类型

```typescript
interface ConvertOptions {
  beatsPerBar?: number;
  timeSignature?: [number, number];
  chapters?: Chapter[];
  complexity?: 'minimal' | 'standard' | 'extended';
  duration?: string;
  minPatternRepeats?: number;
}
```

### 静态方法

#### `convert(score: Score, options?: ConvertOptions): ScoreV2`

转换 v1 Score 为 v2 ScoreV2。

```typescript
const v2 = V1ToV2Converter.convert(v1Score, {
  beatsPerBar: 4,
  timeSignature: [4, 4],
  chapters: [
    { id: 'intro', bars: 8, transition: 0 },
    { id: 'verse', bars: 16, transition: 2 },
  ],
  complexity: 'standard',
  minPatternRepeats: 3,
});
```

### 自动章节检测

若未提供 `chapters`，转换器会根据音符密度自动检测章节边界。

---

## EventEmitter

类型安全的事件发射器基类。

```typescript
import { EventEmitter } from 'chip-audio-engine';

interface MyEvents {
  tick: { time: number };
  stop: void;
}

const emitter = new EventEmitter<MyEvents>();
emitter.on('tick', ({ time }) => console.log(time));
emitter.emit('tick', { time: Date.now() });
```

### 方法

#### `on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void`

注册事件处理器。返回取消订阅函数。

```typescript
const off = emitter.on('tick', ({ time }) => console.log(time));
off(); // unsubscribe
```

#### `off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void`

移除事件处理器。

```typescript
const handler = ({ time }: { time: number }) => console.log(time);
emitter.on('tick', handler);
emitter.off('tick', handler);
```

#### `once<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void`

注册一次性事件处理器。

```typescript
emitter.once('tick', ({ time }) => console.log('first tick:', time));
```

#### `emit<K extends keyof Events>(event: K, payload: Events[K]): void`

发射事件到所有已注册的处理器。单个处理器中的错误会被隔离，不会影响后续监听器。

```typescript
emitter.emit('tick', { time: Date.now() });
```

---

## SoundPackLoader

音效包加载器，管理多个音效包的注册与激活。

```typescript
import { SoundPackLoader } from 'chip-audio-engine';

const loader = new SoundPackLoader();
loader.register({ name: 'default', sounds: { 'ui.click': { duration: 100 } } });
loader.setActive('default');
const params = loader.getSound('ui.click');
```

### 方法

#### `register(pack: SoundPack): void`

注册音效包。若已存在同名包则覆盖。

```typescript
loader.register({ name: 'sfx', sounds: {} });
```

#### `setActive(packName: string): boolean`

切换到指定音效包。未注册则返回 `false`。

```typescript
const ok = loader.setActive('sfx');
```

#### `getSound(soundId: string): SoundParams | null`

获取合并后的音效播放参数。若不存在则返回 `null`。

```typescript
const params = loader.getSound('ui.click');
if (params) engine.play('ui.click');
```

#### `getSoundEntry(soundId: string): SoundPackEntry | null`

从当前激活的包中获取原始条目。

```typescript
const entry = loader.getSoundEntry('ui.click');
```

#### `listSounds(): string[]`

列出当前激活包中的所有音效 ID。

```typescript
const ids = loader.listSounds();
```

#### `getActivePackName(): string | null`

获取当前激活包的名称。

```typescript
const name = loader.getActivePackName();
```

#### `getPackNames(): string[]`

获取所有已注册包的名称列表。

```typescript
const names = loader.getPackNames();
```
