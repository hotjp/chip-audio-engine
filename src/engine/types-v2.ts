/**
 * CAE Score v2 类型定义
 *
 * v2 是创作格式，解决音轨对齐、断点续写、章节过渡、字面量压缩。
 */

// ------------------------------------------------------------------
// Meta
// ------------------------------------------------------------------

export interface ScoreV2Meta {
  /** Schema 标识 */
  $schema: 'cae-score-v2';
  /** 曲目标题 */
  title: string;
  /** BPM，范围 20-300 */
  bpm: number;
  /** 拍号，如 [4, 4] */
  timeSignature: [number, number];
  /** 引用的音色包名称 */
  timbrePack: string;
  /** 复杂度层级 */
  complexity?: 'minimal' | 'standard' | 'extended';
  /** 时长描述，如 "2:00" */
  duration?: string;
}

// ------------------------------------------------------------------
// Performance
// ------------------------------------------------------------------

export interface VelocityCurve {
  /** 插值曲线类型 */
  curve: 'linear' | 'step';
  /** 锚点列表：[锚点, 值] */
  points: [string | number, number][];
}

export interface Performance {
  /** 整轨延后，单位 ms */
  layback?: number;
  /** 随机偏移强度，范围 0-1 */
  humanize?: number;
  /** 偶数拍延迟比例，范围 0-1 */
  swing?: number;
  /** 力度曲线 */
  velocity?: VelocityCurve;
}

// ------------------------------------------------------------------
// Track 声明
// ------------------------------------------------------------------

export interface ScoreV2Track {
  /** 音轨名称（唯一） */
  name: string;
  /** 引用音色包中的音色名 */
  timbre: string;
  /** 演奏参数 */
  perf?: Performance;
  /** 音量，范围 0-1 */
  volume?: number;
  /** 是否静音 */
  mute?: boolean;
}

// ------------------------------------------------------------------
// Patterns
// ------------------------------------------------------------------

/** 音符元组：[note, duration, beat?] */
export type NoteTuple = [string, string, (string | number)?];

/** Pattern 定义：按 track 分组的音符列表 */
export interface PatternDef {
  [trackName: string]: NoteTuple[];
}

/** Pattern 对象引用 */
export interface PatternRef {
  /** 引用路径，格式 "patternName.trackName" */
  $ref: string;
  /** 移调 semitone */
  transpose?: number;
  /** velocity 倍率 */
  velocity?: number;
}

// ------------------------------------------------------------------
// Chapters
// ------------------------------------------------------------------

export interface Chapter {
  /** 章节 ID（唯一） */
  id: string;
  /** 小节数 */
  bars: number;
  /** 过渡小节数 */
  transition?: number;
  /** 情绪标签 */
  mood?: string;
}

// ------------------------------------------------------------------
// Score Bar
// ------------------------------------------------------------------

/** Bar 中单个 track 的内容 */
export type BarTrackContent = NoteTuple[] | string | PatternRef;

export interface BlendDef {
  /** 下一个 chapter ID */
  next: string;
  /** 混合权重，范围 0-1 */
  weight: number;
}

export interface Bar {
  /** 所属章节 ID */
  chapter: string;
  /** 章节内小节编号（1-based） */
  bar: number;
  /** track 内容映射 */
  t?: { [trackName: string]: BarTrackContent };
  /** 复用本 chapter 的第 N 小节 */
  ref?: number;
  /** 在 ref 基础上覆盖部分 track */
  override?: { [trackName: string]: BarTrackContent };
  /** 全静音小节 */
  silence?: boolean;
  /** 过渡混合定义 */
  blend?: BlendDef;
}

// ------------------------------------------------------------------
// 完整 Score v2
// ------------------------------------------------------------------

export interface ScoreV2 {
  /** Schema 标识 */
  $schema: 'cae-score-v2';
  /** 全局元数据 */
  meta: ScoreV2Meta;
  /** 音轨声明列表 */
  tracks: ScoreV2Track[];
  /** Pattern 库 */
  patterns?: { [name: string]: PatternDef };
  /** 章节定义 */
  chapters: Chapter[];
  /** 小节序列 */
  score: Bar[];
}
