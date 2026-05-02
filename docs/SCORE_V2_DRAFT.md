# CAE Score v2 — Schema Design

> 设计目标：解决音轨对齐、断点续写、章节过渡、字面量压缩
> 原则：纯 JSON，所有模型原生支持，通过结构设计压缩而非自定义语法
> 适用场景：AI Agent 创作 8bit/16bit 芯片音乐

---

## 1. 整体结构

Score v2 分为三个独立维度：

| 维度 | 内容 | 修改频率 | 谁负责 |
|------|------|---------|--------|
| **A: Score** | 小节、音符、pattern | 高（逐小节写） | Agent |
| **B: Performance** | 演奏参数曲线 | 低（写一次管全曲） | Agent 或预设 |
| **C: Meta** | BPM、音色包、轨道声明 | 一次性 | Agent |

Agent 大部分时间只跟维度 A 打交道。

```json
{
  "$schema": "cae-score-v2",
  "meta": { ... },
  "tracks": [ ... ],
  "patterns": { ... },
  "chapters": [ ... ],
  "score": [ ... ]
}
```

---

## 2. Meta（维度 C）

全局元数据，写一次不改。

```json
"meta": {
  "title": "Hero's March",
  "bpm": 130,
  "timeSignature": [4, 4],
  "timbrePack": "16bit-sfc",
  "duration": "2:00"
}
```

---

## 3. Tracks 声明 + Performance（维度 B）

**关键设计：Performance 与音符数据完全分离。**

- layback、humanize、swing 声明在 track 级别
- velocity 用连续曲线表达，锚定 chapter 名称（不是绝对 bar number）
- Agent 改音符时完全碰不到这些参数

```json
"tracks": [
  {
    "name": "lead",
    "timbre": "lead",
    "perf": {
      "layback": 10,
      "humanize": 0.15,
      "velocity": {
        "curve": "linear",
        "points": [
          ["intro:start", 0.4],
          ["intro:end", 0.6],
          ["climax:mid", 0.95],
          ["outro:end", 0.3]
        ]
      }
    }
  },
  {
    "name": "kick",
    "timbre": "kick",
    "perf": {
      "velocity": {
        "curve": "linear",
        "points": [
          ["intro:start", 0.3],
          ["climax:start", 1.0],
          ["outro:end", 0.0]
        ]
      }
    }
  },
  {
    "name": "arp",
    "timbre": "arp",
    "perf": {
      "swing": 0.3,
      "humanize": 0.2
    }
  }
]
```

### Velocity 曲线

- `points` 是 `[锚点, 值]` 的数组
- 锚点格式：`"chapterId:position"`，position 可以是 `start`、`end`、`mid`、或数字（chapter 内第 N 小节）
- 也可以用百分比：`[0.0, 0.4]` 表示曲子开头，`[0.5, 0.8]` 表示曲子中点
- 引擎在任意小节根据锚点插值计算实际 velocity
- **插入小节不影响曲线**——锚点跟着 chapter 走，不是绝对编号

### Performance 参数说明

| 参数 | 类型 | 含义 | 默认值 |
|------|------|------|--------|
| `layback` | number(ms) | 整轨延后 N 毫秒 | 0 |
| `humanize` | 0-1 | 随机时间偏移强度 | 0 |
| `swing` | 0-1 | 偶数拍延迟比例 | 0 |
| `velocity` | curve | 力度曲线 | 恒定 1.0 |

---

## 4. Patterns

可复用的音符片段，用于鼓组、琶音等重复性内容。

```json
"patterns": {
  "kick-std": {
    "kick": [["C2","q",1],["R","q",2],["C2","q",3],["R","q",4]]
  },
  "hihat-8th": {
    "hihat": [["C6","e",1],["R","e",1.5],["C6","e",2],["R","e",2.5],["C6","e",3],["R","e",3.5],["C6","e",4],["R","e",4.5]]
  },
  "imperial-motif": {
    "lead": [["G3","q",1],["G3","q",2],["D4","h","3-4"]]
  }
}
```

### 引用方式

```json
"kick": "$kick-std.kick"                              // 简单引用
"lead": {"$ref":"imperial-motif.lead","transpose":5}   // 移调引用
"arp": {"$ref":"arp-fast.arp","velocity":0.8}          // 带 velocity 覆盖
```

---

## 5. Chapters + Transition

### 结构

Chapter 按顺序排列，不用绝对 bar number。每个 chapter 声明自己有几小节。

```json
"chapters": [
  {"id":"intro",   "bars":6,  "transition":2, "mood":"march, moderate"},
  {"id":"dev",     "bars":8,  "transition":2, "mood":"crescendo"},
  {"id":"calm",    "bars":8,  "transition":2, "mood":"gentle, sustained"},
  {"id":"rebuild", "bars":8,  "transition":2, "mood":"building, sparse-to-dense"},
  {"id":"climax",  "bars":10, "transition":2, "mood":"intense, full power"},
  {"id":"outro",   "bars":6,  "mood":"fade, resolution"}
]
```

### Transition 机制

`"transition": 2` 表示这个 chapter 的**最后 2 小节是过渡区**，与下一个 chapter 的前 2 小节交叠。

```
时间线：
[intro bar 1-4][intro bar 5-6 / dev bar 1-2 交叠][dev bar 3-6][dev bar 7-8 / calm bar 1-2 交叠]...
                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                 过渡区：intro 收尾 + dev 铺垫
```

过渡区的 bar 用 `blend` 字段标记：

```json
{
  "chapter": "intro",
  "bar": 5,
  "blend": {"next": "dev", "weight": 0.3},
  "t": {
    "lead": [["G4","q",1],["F4","q",2],["Eb4","h","3-4"]],
    "bass": [["Bb1","w",1]],
    "arp": [["D4","e",1],["F4","e",1.5],["A4","e",2],["D5","e",2.5]]
  }
}
```

- `weight: 0.3` = 30% 下一个 chapter 的色彩
- 引擎可以用 weight 做 velocity 插值、音色渐变等
- 8bit/16bit 场景下过渡不需要很细腻，2 小节交叠足够

### Agent 续写流程

1. 读取 `chapters` → 理解整体结构
2. 写当前 chapter 的主体 bars
3. 写当前 chapter 的 transition bars（需要看下一个 chapter 的 mood）
4. 写下一个 chapter 时，开头衔接 transition 的结束状态

**Agent 单次上下文**：当前 chapter + 前后各一章的最后 2 小节（~2KB 开销）

---

## 6. Score（维度 A）

### 小节格式

```json
{
  "chapter": "intro",
  "bar": 1,
  "t": {
    "lead": [["G3","q",1],["G3","q",2],["D4","h","3-4"]],
    "bass": [["G2","w",1]],
    "kick": "$kick-std.kick",
    "hihat": "$hihat-8th.hihat"
  }
}
```

- `"t"` 是 `tracks` 的缩写，减少字面量
- 不出现的 track = 不动/延续上一个状态
- bar number 在 chapter 内部有意义，不影响其他 chapter

### 小节复用

| 语法 | 含义 |
|------|------|
| `"ref": 3` | 复制本 chapter 的 bar 3 |
| `"silence": true` | 全静音小节 |
| `"override": {...}` | 在 ref 基础覆盖部分 track |

### 过渡小节

```json
{
  "chapter": "intro",
  "bar": 6,
  "blend": {"next": "dev", "weight": 0.7},
  "t": {
    "lead": [["D4","q",1],["F4","q",2],["G4","h","3-4"]],
    "bass": [["D2","w",1]],
    "arp": [["D4","e",1],["F4","e",1.5],["A4","e",2],["D5","e",2.5]]
  }
}
```

---

## 7. 音符格式：数组约定

### 格式：`[note, duration, beat?]`

| 位置 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 0 | note | string | 音名 `"G3"` 或休止 `"R"` |
| 1 | duration | string | 时值 `"w" "h" "q" "e" "s" "t"` |
| 2 | beat | string/number? | 可选，拍位 |

### 示例

```
["G3","q",1]       → G3 四分音符，第1拍
["R","q",2]        → 休止，第2拍
["D4","h","3-4"]   → D4 二分音符，跨第3-4拍
["G2","w",1]       → G2 全音符
["C6","e",1.5]     → C6 八分音符，第1拍后半
["G3","q"]         → 省略 beat = 顺序累加
```

### beat 规则

- 4/4 拍制下范围 1-4（或 1.0-4.999）
- `"3-4"` = 跨拍长音（第3拍到第4拍）
- `"1-4"` = 全小节长音
- 小数 = 拍内位置：`2.5` = 第2拍后半
- 省略 = 顺序累加

---

## 8. 压缩效果预估

### 180BPM × 3分钟 × 7轨

| 方案 | 大小 | 128K 上下文占比 |
|------|------|----------------|
| v1 铺排式 | ~75 KB | 59% |
| v2 小节网格 + pattern | ~40 KB | 31% |
| v2 单 chapter 断点续写 | ~7 KB | 5% |

### 压缩来源

1. **数组替代表达**：`["G3","q",1]` vs `{"note":"G3","duration":"q","beat":"1"}` → 13 vs 35 字符
2. **Pattern 复用**：鼓组 30 小节同一 pattern → 写 1 次 + 引用 30 次
3. **小节引用**：`"ref": 3` 代替重写
4. **静音简写**：`"silence": true`
5. **字段缩写**：`"t"` 代替 `"tracks"`

---

## 9. 兼容性

- **v2 是创作格式，v1 是执行格式**
- v2 → v1 转换器：展开 patterns、展开 refs、展开 beat 为 duration 累加、展开 velocity 曲线为逐音符 velocity
- v1 → v2 转换器：自动检测重复 pattern、按小节边界切分
- 引擎内部仍用 v1 的扁平格式执行，v2 到引擎之间有一层编译

---

## 10. 开放问题

1. ~~chapter 之间允许 overlap 吗？~~ → 已解决：transition + blend
2. ~~velocity 在哪层控制？~~ → 已解决：track 级别曲线
3. ~~swing/shuffle 怎么表达？~~ → 已解决：track 级别 perf 参数
4. ~~绝对 bar number 脆弱~~ → 已解决：chapter 相对锚定
5. **pattern 是否支持嵌套？** — 暂不支持，保持简单
6. **blend.weight 引擎侧怎么用？** — 8bit 场景下可以做简单 crossfade，后续迭代

---

## 11. Composer Guide（创作指南）— 必须交付

Schema 只管数据结构。Agent 需要一份独立的创作指南才知道怎么写出好听的曲子。
这份指南是 v2 的**必须交付物**，不是可选的。

### 指南内容范围

| 主题 | 内容 | 目的 |
|------|------|------|
| 章节过渡 | 过渡模板（同调/转调/情绪变化） | 避免 chapter 之间割裂 |
| 和声进行 | 常用进行（I-V-vi-IV / i-iv-VII-III） | 给 Agent 和弦选择参考 |
| 旋律衔接 | 音程跳跃规则、动机重复与变奏 | 旋律有记忆点、不随机 |
| 鼓组编排 | 节奏型模板 + 密度梯度 | 鼓组随情绪自然变化 |
| 动态曲线 | velocity/密度/音域的配合方式 | 渐强渐弱听感自然 |
| 风格参考 | 8bit-nes / 16bit-sfc / synthwave 的特征 | Agent 知道不同风格怎么写 |

### 过渡模板示例

```
## 同调情绪转换（如 march → calm）
1. 保留最后和弦音作为长音 pad
2. 鼓组在前 chapter 最后 2 小节逐步退出
3. lead 旋律走下行音阶收束到根音
4. 新 chapter 从 pad 长音开始，逐步加入新旋律

## 升调过渡（如 G minor → Bb major）
1. 找 pivot chord：G minor 的 VI = Eb = Bb major 的 IV
2. 倒数第 2 小节结束在 Eb 和弦
3. 最后 1 小节用 Bb 和弦建立新调
4. lead 走 G→Bb→D 上行建立新主题

## 舒缓到激烈（calm → climax）
1. pad 持续音保持不变
2. lead 停 1 小节，bass 独奏建立节奏
3. kick 从 half-time 变标准 4/4
4. snare 加 roll（连续 16 分）过渡
5. arp 从单音变和弦分解，逐步加密
```

### 交付形式

- 文件名：`AGENT.md`（放在项目根目录）
- Agent 每次创作时读取此文件作为系统提示的一部分
- 指南内容需要根据实际听感反馈持续迭代

---

## 12. 音轨扩展与性能分层

### 轨道数量不设硬限制

当前 16bit-sfc 音色包只有 7 种 timbre，但 schema 本身不限轨道数。音乐人可以自由叠加：

```json
"tracks": [
  {"name":"kick",    "timbre":"kick"},
  {"name":"snare",   "timbre":"snare"},
  {"name":"hihat",   "timbre":"hihat"},
  {"name":"tom1",    "timbre":"tom"},
  {"name":"bass",    "timbre":"bass"},
  {"name":"bass-sub","timbre":"bass"},
  {"name":"lead",    "timbre":"lead"},
  {"name":"lead-harm","timbre":"lead"},   // 共享 lead 音色
  {"name":"pad",     "timbre":"pad"},
  {"name":"arp",     "timbre":"arp"},
  {"name":"fx",      "timbre":"noise"}
]
```

多条 track 可以共享同一个 timbre（如 lead + lead-harm 都用 lead 音色）。

### 性能分层

多轨实时播放有性能压力。按复杂度分三层：

| 层级 | 轨道数 | 适用场景 | 目标设备 |
|------|--------|---------|----------|
| minimal | 4 轨 | 8bit-nes 风格 | 任何设备 |
| standard | 7-8 轨 | 16bit-sfc 风格 | 桌面 + 中端手机 |
| extended | 12-16 轨 | 多层叠加 | 桌面端 |

在 meta 里声明：

```json
"meta": {
  "bpm": 130,
  "timbrePack": "16bit-sfc",
  "complexity": "standard"
}
```

引擎可以根据 complexity 选择降级策略（如 extended 在手机上自动砍到 standard 轨道数）。

### 音色包扩展

当前 timbre pack 格式支持 oscillator 参数配置，音乐人可以通过 JSON 定义新音色。

```json
"lead": {
  "provider": "oscillator",
  "waveforms": [{"type":"square","gain":0.5,"detune":-4}],
  "filter": {"type":"lowpass","frequency":2800,"Q":1},
  "envelope": {"attack":5,"decay":30,"sustain":0.3,"release":60}
}
```

**共建流程**：音乐人提交 timbre JSON → review → 合入音色包 → 写 score 验证 → 听感反馈迭代。

未来可扩展：效果链（chain）、FM 合成、采样加载、预设别名系统。

---

## 13. 音乐编程工作流

CAE 的本质是**音乐编程**——用编程的方式创作、构建、发布音乐。
将传统软件工程概念映射过来：

### 概念映射

| 编程概念 | 音乐编程对应 | CAE 状态 |
|---------|------------|----------|
| 源代码 | Score JSON | ✅ |
| 依赖库 | Timbre Pack | ✅（需扩展） |
| 编译 | Score → Audio 渲染 | ❌ Builder 待实现 |
| 构建产物 | WAV / OGG | ❌ 待实现 |
| Lint | Schema 校验 | ✅ ScoreValidator |
| CI | 提交自动校验 + 构建 | ❌ 待实现 |
| CD | 部署音频 + 播放器 | 部分（Pages 已有） |
| Package | 音色包 + 曲目包 | 基础格式 |
| 版本号 | Pack semver | ❌ 待实现 |
| Review | 听感 Review | ❌ 待实现 |

### 核心定位（不能偏）

**CAE 的初心是游戏实时音频管线**。实时播放是主线，Builder 是锦上添花。

```
游戏实时场景（主线）：
  Score JSON → CAE Engine → Web Audio API → 实时播放
  适用：音效、UI 反馈、互动音乐、场景过渡

BGM 离线构建（锦上添花）：
  Score JSON → Builder → WAV/OGG → 游戏资源包
  适用：复杂 BGM 预渲染，减少实时管线压力
```

Builder 解决的问题：
- 复杂 BGM（15+ 轨）预渲染成音频文件，游戏加载时直接播放
- 减少游戏运行时的音频管线压力
- CI/CD 自动构建音频产物

### Builder 技术路径

**方案：Headless Browser + OfflineAudioContext**

```
Score JSON → Playwright 启动无头浏览器
  → 加载 CAE 引擎
  → OfflineAudioContext 渲染
  → 导出 WAV
```

选择 headless browser 而不是 Node.js 原生合成的原因：
- **渲染逻辑跟播放引擎完全一致**，不会出现"构建出来跟播放不一样"的 bug
- 不用维护两套合成代码
- 离线构建不需要实时，2 分钟曲子等 10 秒可以接受

### 完整工作流

```
音乐人/Agent 写 Score ──→ Git Repo
    │                        │
    │                   ┌─────┴──────┐
    │                   │ CI (Action) │
    │                   │ ├ validate  │
    │                   │ └ lint      │
    │                   └─────┬──────┘
    │                         │
    │              ┌──────────┴──────────┐
    │              │ Builder (可选)       │
    │              │ Playwright + CAE    │
    │              │ → WAV/OGG           │
    │              └──────────┬──────────┘
    │                         │
    │              ┌──────────┴──────────┐
    │              │ CD (Pages / CDN)    │
    │              │ 音频 + 播放器       │
    │              └─────────────────────┘
    │
    └──→ Pack Registry
         ├ timbre packs (JSON)
         └ score packs (JSON + 音频缓存)
```

---

## 14. 引擎性能优化

当前引擎在密集段落（高潮段每秒 30+ 音符）存在性能瓶颈。
以下优化服务于**即时性和性能**，不改变外部 API。

### 14.1 节点复用（Track Node Pool）

**现状**：每个音符创建完整的 OscillatorNode + GainNode + FilterNode + 可能的 LFO。
用完全部 dispose。同一 track 的连续音符用的是同一个 timbre，但每次都重建整棵节点树。

**优化**：同一 track 共享 GainNode 和 FilterNode，只切换 OscillatorNode。

```
当前（每音符）：
  Osc → Gain → Filter → masterGain
  用完全部 dispose

优化后（per-track 常驻）：
  TrackInput[Gain + Filter 常驻]
  每音符只创建：Osc → TrackInput
  音符结束只 dispose Osc
```

预估减少 50-60% 的节点创建/销毁开销。

### 14.2 Pink Noise Buffer 缓存

**现状**：每个 noise 音符调用 `createPinkNoiseBuffer()`，生成 1 秒的 AudioBuffer。
kick + snare + hihat 三轨密集段每秒可能触发 30+ 次，等于每秒生成 30 个 pink noise buffer。

**优化**：AudioContext 级别缓存一份，所有 noise 音符共享。

```typescript
private pinkNoiseCache = new Map<number, AudioBuffer>();

getPinkNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!this.pinkNoiseCache.has(ctx.sampleRate)) {
    this.pinkNoiseCache.set(ctx.sampleRate, createPinkNoiseBuffer(ctx));
  }
  return this.pinkNoiseCache.get(ctx.sampleRate)!;
}
```

三轨鼓组密集段减少 90%+ 的 buffer 生成。

### 14.3 清理机制优化

**现状**：每个音符一个 setTimeout 做清理。2057 个音符 = 2057 个 timer。
高峰期同时 pending 的 timeout 可能有上百个。

**优化**：单一 interval 统一清理。

```typescript
// 每 100ms 清理一次已结束的音符
private cleanupInterval = setInterval(() => this.cleanup(), 100);

private cleanup(): void {
  const now = Date.now();
  this.activeNotes = this.activeNotes.filter(note => {
    if (note.endTime <= now) {
      note.instance.dispose();
      return false;
    }
    return true;
  });
}
```

减少 95% 的 timer 开销（N 个 setTimeout → 1 个 setInterval）。

### 14.4 调度精度

当前参数：
```
scheduleAheadTime = 0.1s (100ms 提前调度)
lookahead = 25ms (每 25ms 检查一次)
```

这对游戏场景是合理的。但如果出现听感延迟，可调参数：
- 降低 lookahead 到 10ms（更及时，但 CPU 占用微增）
- 提高 scheduleAheadTime 到 0.2s（更平滑，但内存微增）

### 14.5 优化优先级

| 优化项 | 收益 | 难度 | 优先级 |
|--------|------|------|--------|
| Pink Noise 缓存 | 高（鼓组场景） | 低 | P0 |
| 清理机制（单 interval） | 中 | 低 | P0 |
| 节点复用（Track Pool） | 高 | 中 | P1 |
| 批量调度（pattern 识别） | 中 | 中 | P2 |
| 优先级调度（SFX > BGM） | 低 | 高 | P3 |

### 漂移红线

> CAE 引擎的设计决策只服务于"游戏实时音频管线"这个核心场景。
> Builder、CI/CD、Pack Registry 作为独立工具存在，
> 它们的实现不能反过来要求引擎做结构性妥协。
