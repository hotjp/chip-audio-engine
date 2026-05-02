import type { ScoreV2, NoteTuple, BarTrackContent, PatternRef } from '../engine/types-v2.js';

/** 合法时值符号集合 */
const DURATION_SYMBOLS = new Set([
  'w', 'h', 'q', 'e', 's', 't',
  'w.', 'h.', 'q.', 'e.', 's.',
]);

/** 音名正则：[A-G][#b]?[0-9] */
const NOTE_RE = /^[A-Ga-g][#b]?[0-9]$/;

/** 简单 Pattern 引用字符串格式：$patternName.trackName */
const SIMPLE_PATTERN_REF_RE = /^\$[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** PatternRef $ref 格式：patternName.trackName */
const PATTERN_REF_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Velocity 锚点字符串格式：chapterId:position */
const VELOCITY_ANCHOR_RE = /^[A-Za-z0-9_-]+:(start|end|mid|\d+)$/;

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * 校验一个 Score v2 JSON 对象是否语法正确。
 */
export function validateScoreV2(score: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof score !== 'object' || score === null) {
    return { valid: false, errors: [{ path: '', message: 'Score must be an object' }] };
  }

  const s = score as Record<string, unknown>;

  // $schema
  if (s.$schema !== 'cae-score-v2') {
    errors.push({ path: '$schema', message: 'Must be "cae-score-v2"' });
  }

  // meta
  if (typeof s.meta !== 'object' || s.meta === null) {
    errors.push({ path: 'meta', message: 'Required: object' });
  } else {
    validateMeta(s.meta as Record<string, unknown>, errors);
  }

  // tracks
  const trackNames = new Set<string>();
  if (!Array.isArray(s.tracks) || s.tracks.length === 0) {
    errors.push({ path: 'tracks', message: 'Required: non-empty array of tracks' });
  } else {
    for (let i = 0; i < s.tracks.length; i++) {
      validateTrack(s.tracks[i] as Record<string, unknown>, i, trackNames, errors);
    }
  }

  // chapters
  const chapterIds = new Set<string>();
  const chapterBars = new Map<string, number>();
  if (!Array.isArray(s.chapters) || s.chapters.length === 0) {
    errors.push({ path: 'chapters', message: 'Required: non-empty array of chapters' });
  } else {
    for (let i = 0; i < s.chapters.length; i++) {
      validateChapter(s.chapters[i] as Record<string, unknown>, i, chapterIds, chapterBars, errors);
    }
  }

  // patterns
  const patternNames = new Set<string>();
  if (s.patterns !== undefined) {
    if (typeof s.patterns !== 'object' || s.patterns === null) {
      errors.push({ path: 'patterns', message: 'Must be an object' });
    } else {
      const patterns = s.patterns as Record<string, unknown>;
      for (const [name, def] of Object.entries(patterns)) {
        patternNames.add(name);
        validatePatternDef(name, def, trackNames, errors);
      }
    }
  }

  // score bars
  if (!Array.isArray(s.score)) {
    errors.push({ path: 'score', message: 'Required: array of bars' });
  } else {
    for (let i = 0; i < s.score.length; i++) {
      validateBar(
        s.score[i] as Record<string, unknown>,
        i,
        chapterIds,
        chapterBars,
        trackNames,
        patternNames,
        errors,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ------------------------------------------------------------------
// Meta
// ------------------------------------------------------------------

function validateMeta(meta: Record<string, unknown>, errors: ValidationError[]): void {
  // title
  if (typeof meta.title !== 'string' || meta.title.length === 0) {
    errors.push({ path: 'meta.title', message: 'Required: non-empty string' });
  }

  // bpm: 20-300
  if (typeof meta.bpm !== 'number' || meta.bpm < 20 || meta.bpm > 300) {
    errors.push({ path: 'meta.bpm', message: 'Required: number [20, 300]' });
  }

  // timeSignature: [number, number]
  if (!Array.isArray(meta.timeSignature) || meta.timeSignature.length !== 2) {
    errors.push({ path: 'meta.timeSignature', message: 'Required: [number, number]' });
  } else {
    const [num, den] = meta.timeSignature;
    if (
      typeof num !== 'number' ||
      typeof den !== 'number' ||
      !Number.isInteger(num) ||
      !Number.isInteger(den) ||
      num <= 0 ||
      den <= 0
    ) {
      errors.push({ path: 'meta.timeSignature', message: 'Both parts must be positive integers' });
    }
  }

  // timbrePack
  if (typeof meta.timbrePack !== 'string' || meta.timbrePack.length === 0) {
    errors.push({ path: 'meta.timbrePack', message: 'Required: non-empty string' });
  }

  // complexity (optional)
  if (meta.complexity !== undefined) {
    const validComplexities = ['minimal', 'standard', 'extended'];
    if (typeof meta.complexity !== 'string' || !validComplexities.includes(meta.complexity)) {
      errors.push({ path: 'meta.complexity', message: 'Must be one of: minimal, standard, extended' });
    }
  }

  // duration (optional)
  if (meta.duration !== undefined && typeof meta.duration !== 'string') {
    errors.push({ path: 'meta.duration', message: 'Must be string' });
  }
}

// ------------------------------------------------------------------
// Track
// ------------------------------------------------------------------

function validateTrack(
  track: Record<string, unknown>,
  index: number,
  trackNames: Set<string>,
  errors: ValidationError[],
): void {
  const prefix = `tracks[${index}]`;

  // name
  if (typeof track.name !== 'string' || track.name.length === 0) {
    errors.push({ path: `${prefix}.name`, message: 'Required: non-empty string' });
  } else {
    if (trackNames.has(track.name)) {
      errors.push({ path: `${prefix}.name`, message: `Duplicate track name: "${track.name}"` });
    }
    trackNames.add(track.name);
  }

  // timbre
  if (typeof track.timbre !== 'string' || track.timbre.length === 0) {
    errors.push({ path: `${prefix}.timbre`, message: 'Required: non-empty string' });
  }

  // volume (optional)
  if (track.volume !== undefined && (typeof track.volume !== 'number' || track.volume < 0 || track.volume > 1)) {
    errors.push({ path: `${prefix}.volume`, message: 'Must be number [0, 1]' });
  }

  // mute (optional)
  if (track.mute !== undefined && typeof track.mute !== 'boolean') {
    errors.push({ path: `${prefix}.mute`, message: 'Must be boolean' });
  }

  // perf (optional)
  if (track.perf !== undefined) {
    validatePerformance(track.perf, `${prefix}.perf`, errors);
  }
}

// ------------------------------------------------------------------
// Performance
// ------------------------------------------------------------------

function validatePerformance(perf: unknown, prefix: string, errors: ValidationError[]): void {
  if (typeof perf !== 'object' || perf === null) {
    errors.push({ path: prefix, message: 'Must be an object' });
    return;
  }

  const p = perf as Record<string, unknown>;

  if (p.layback !== undefined && typeof p.layback !== 'number') {
    errors.push({ path: `${prefix}.layback`, message: 'Must be number (ms)' });
  }

  if (p.humanize !== undefined && (typeof p.humanize !== 'number' || p.humanize < 0 || p.humanize > 1)) {
    errors.push({ path: `${prefix}.humanize`, message: 'Must be number [0, 1]' });
  }

  if (p.swing !== undefined && (typeof p.swing !== 'number' || p.swing < 0 || p.swing > 1)) {
    errors.push({ path: `${prefix}.swing`, message: 'Must be number [0, 1]' });
  }

  if (p.velocity !== undefined) {
    validateVelocityCurve(p.velocity, `${prefix}.velocity`, errors);
  }
}

function validateVelocityCurve(velocity: unknown, prefix: string, errors: ValidationError[]): void {
  if (typeof velocity !== 'object' || velocity === null) {
    errors.push({ path: prefix, message: 'Must be an object' });
    return;
  }

  const v = velocity as Record<string, unknown>;

  // curve
  if (v.curve !== 'linear' && v.curve !== 'step') {
    errors.push({ path: `${prefix}.curve`, message: 'Must be "linear" or "step"' });
  }

  // points
  if (!Array.isArray(v.points)) {
    errors.push({ path: `${prefix}.points`, message: 'Required: array of [anchor, value] pairs' });
    return;
  }

  for (let i = 0; i < v.points.length; i++) {
    const point = v.points[i];
    const pPrefix = `${prefix}.points[${i}]`;

    if (!Array.isArray(point) || point.length < 2 || point.length > 3) {
      errors.push({ path: pPrefix, message: 'Must be [anchor, value] (2 elements)' });
      continue;
    }

    const [anchor, value] = point;

    // anchor: string or number
    if (typeof anchor === 'string') {
      if (!VELOCITY_ANCHOR_RE.test(anchor)) {
        errors.push({
          path: `${pPrefix}[0]`,
          message: 'Anchor string must be "chapterId:position" (position: start, end, mid, or number)',
        });
      }
    } else if (typeof anchor === 'number') {
      if (anchor < 0 || anchor > 1) {
        errors.push({
          path: `${pPrefix}[0]`,
          message: 'Anchor number must be in range [0, 1] (percentage)',
        });
      }
    } else {
      errors.push({ path: `${pPrefix}[0]`, message: 'Anchor must be string or number' });
    }

    // value: number 0-1
    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push({ path: `${pPrefix}[1]`, message: 'Value must be number [0, 1]' });
    }
  }
}

// ------------------------------------------------------------------
// Chapter
// ------------------------------------------------------------------

function validateChapter(
  chapter: Record<string, unknown>,
  index: number,
  chapterIds: Set<string>,
  chapterBars: Map<string, number>,
  errors: ValidationError[],
): void {
  const prefix = `chapters[${index}]`;

  // id
  if (typeof chapter.id !== 'string' || chapter.id.length === 0) {
    errors.push({ path: `${prefix}.id`, message: 'Required: non-empty string' });
  } else {
    if (chapterIds.has(chapter.id)) {
      errors.push({ path: `${prefix}.id`, message: `Duplicate chapter id: "${chapter.id}"` });
    }
    chapterIds.add(chapter.id);
  }

  // bars
  if (typeof chapter.bars !== 'number' || !Number.isInteger(chapter.bars) || chapter.bars <= 0) {
    errors.push({ path: `${prefix}.bars`, message: 'Required: positive integer' });
  } else if (typeof chapter.id === 'string') {
    chapterBars.set(chapter.id, chapter.bars);
  }

  // transition (optional)
  if (chapter.transition !== undefined) {
    if (
      typeof chapter.transition !== 'number' ||
      !Number.isInteger(chapter.transition) ||
      chapter.transition < 0
    ) {
      errors.push({ path: `${prefix}.transition`, message: 'Must be non-negative integer' });
    }
  }

  // mood (optional)
  if (chapter.mood !== undefined && typeof chapter.mood !== 'string') {
    errors.push({ path: `${prefix}.mood`, message: 'Must be string' });
  }
}

// ------------------------------------------------------------------
// Pattern
// ------------------------------------------------------------------

function validatePatternDef(
  name: string,
  def: unknown,
  trackNames: Set<string>,
  errors: ValidationError[],
): void {
  const prefix = `patterns.${name}`;

  if (typeof def !== 'object' || def === null) {
    errors.push({ path: prefix, message: 'Must be an object' });
    return;
  }

  const d = def as Record<string, unknown>;
  for (const [trackName, notes] of Object.entries(d)) {
    const tPrefix = `${prefix}.${trackName}`;
    if (!Array.isArray(notes)) {
      errors.push({ path: tPrefix, message: 'Must be array of NoteTuple' });
      continue;
    }
    for (let i = 0; i < notes.length; i++) {
      validateNoteTuple(notes[i], `${tPrefix}[${i}]`, errors);
    }
  }
}

// ------------------------------------------------------------------
// Bar
// ------------------------------------------------------------------

function validateBar(
  bar: Record<string, unknown>,
  index: number,
  chapterIds: Set<string>,
  chapterBars: Map<string, number>,
  trackNames: Set<string>,
  patternNames: Set<string>,
  errors: ValidationError[],
): void {
  const prefix = `score[${index}]`;

  // chapter
  if (typeof bar.chapter !== 'string') {
    errors.push({ path: `${prefix}.chapter`, message: 'Required: string (chapter id)' });
  } else if (!chapterIds.has(bar.chapter)) {
    errors.push({
      path: `${prefix}.chapter`,
      message: `Chapter "${bar.chapter}" does not exist`,
    });
  }

  // bar number
  const maxBars = typeof bar.chapter === 'string' ? (chapterBars.get(bar.chapter) ?? Infinity) : Infinity;
  if (typeof bar.bar !== 'number' || !Number.isInteger(bar.bar) || bar.bar < 1 || bar.bar > maxBars) {
    errors.push({
      path: `${prefix}.bar`,
      message: `Must be integer in range [1, ${maxBars === Infinity ? '?' : maxBars}] for chapter "${bar.chapter}"`,
    });
  }

  // ref (optional)
  if (bar.ref !== undefined) {
    if (typeof bar.ref !== 'number' || !Number.isInteger(bar.ref) || bar.ref < 1 || bar.ref > maxBars) {
      errors.push({
        path: `${prefix}.ref`,
        message: `Must be integer in range [1, ${maxBars === Infinity ? '?' : maxBars}] for chapter "${bar.chapter}"`,
      });
    }
  }

  // silence (optional)
  if (bar.silence !== undefined && typeof bar.silence !== 'boolean') {
    errors.push({ path: `${prefix}.silence`, message: 'Must be boolean' });
  }

  // blend (optional)
  if (bar.blend !== undefined) {
    validateBlend(bar.blend, `${prefix}.blend`, chapterIds, errors);
  }

  // t (optional)
  if (bar.t !== undefined) {
    if (typeof bar.t !== 'object' || bar.t === null) {
      errors.push({ path: `${prefix}.t`, message: 'Must be an object' });
    } else {
      for (const [trackName, content] of Object.entries(bar.t as Record<string, unknown>)) {
        if (!trackNames.has(trackName)) {
          errors.push({
            path: `${prefix}.t.${trackName}`,
            message: `Track "${trackName}" is not declared`,
          });
        }
        validateBarTrackContent(content, `${prefix}.t.${trackName}`, trackNames, patternNames, errors);
      }
    }
  }

  // override (optional)
  if (bar.override !== undefined) {
    if (typeof bar.override !== 'object' || bar.override === null) {
      errors.push({ path: `${prefix}.override`, message: 'Must be an object' });
    } else {
      for (const [trackName, content] of Object.entries(bar.override as Record<string, unknown>)) {
        if (!trackNames.has(trackName)) {
          errors.push({
            path: `${prefix}.override.${trackName}`,
            message: `Track "${trackName}" is not declared`,
          });
        }
        validateBarTrackContent(content, `${prefix}.override.${trackName}`, trackNames, patternNames, errors);
      }
    }
  }
}

function validateBlend(
  blend: unknown,
  prefix: string,
  chapterIds: Set<string>,
  errors: ValidationError[],
): void {
  if (typeof blend !== 'object' || blend === null) {
    errors.push({ path: prefix, message: 'Must be an object' });
    return;
  }

  const b = blend as Record<string, unknown>;

  if (typeof b.next !== 'string') {
    errors.push({ path: `${prefix}.next`, message: 'Required: string (chapter id)' });
  } else if (!chapterIds.has(b.next)) {
    errors.push({ path: `${prefix}.next`, message: `Chapter "${b.next}" does not exist` });
  }

  if (typeof b.weight !== 'number' || b.weight < 0 || b.weight > 1) {
    errors.push({ path: `${prefix}.weight`, message: 'Must be number [0, 1]' });
  }
}

// ------------------------------------------------------------------
// Bar Track Content
// ------------------------------------------------------------------

function validateBarTrackContent(
  content: unknown,
  prefix: string,
  trackNames: Set<string>,
  patternNames: Set<string>,
  errors: ValidationError[],
): void {
  if (typeof content === 'string') {
    // 简单 Pattern 引用
    if (!SIMPLE_PATTERN_REF_RE.test(content)) {
      errors.push({
        path: prefix,
        message: 'String pattern ref must be "$patternName.trackName"',
      });
      return;
    }
    // 校验 pattern 和 track 存在性
    const withoutPrefix = content.slice(1);
    const [patternName, trackName] = withoutPrefix.split('.');
    if (!patternNames.has(patternName)) {
      errors.push({
        path: prefix,
        message: `Pattern "${patternName}" does not exist`,
      });
    }
    if (!trackNames.has(trackName)) {
      errors.push({
        path: prefix,
        message: `Track "${trackName}" is not declared`,
      });
    }
    return;
  }

  if (Array.isArray(content)) {
    // NoteTuple[]
    for (let i = 0; i < content.length; i++) {
      validateNoteTuple(content[i], `${prefix}[${i}]`, errors);
    }
    return;
  }

  if (typeof content === 'object' && content !== null) {
    // PatternRef
    validatePatternRef(content as Record<string, unknown>, prefix, trackNames, patternNames, errors);
    return;
  }

  errors.push({
    path: prefix,
    message: 'Must be NoteTuple[], string pattern ref, or PatternRef object',
  });
}

function validatePatternRef(
  ref: Record<string, unknown>,
  prefix: string,
  trackNames: Set<string>,
  patternNames: Set<string>,
  errors: ValidationError[],
): void {
  if (typeof ref.$ref !== 'string') {
    errors.push({ path: `${prefix}.$ref`, message: 'Required: string' });
  } else if (!PATTERN_REF_RE.test(ref.$ref)) {
    errors.push({
      path: `${prefix}.$ref`,
      message: 'Must be "patternName.trackName"',
    });
  } else {
    const [patternName, trackName] = ref.$ref.split('.');
    if (!patternNames.has(patternName)) {
      errors.push({
        path: `${prefix}.$ref`,
        message: `Pattern "${patternName}" does not exist`,
      });
    }
    if (!trackNames.has(trackName)) {
      errors.push({
        path: `${prefix}.$ref`,
        message: `Track "${trackName}" is not declared`,
      });
    }
  }

  if (ref.transpose !== undefined && typeof ref.transpose !== 'number') {
    errors.push({ path: `${prefix}.transpose`, message: 'Must be number' });
  }

  if (ref.velocity !== undefined && (typeof ref.velocity !== 'number' || ref.velocity < 0 || ref.velocity > 1)) {
    errors.push({ path: `${prefix}.velocity`, message: 'Must be number [0, 1]' });
  }
}

// ------------------------------------------------------------------
// NoteTuple
// ------------------------------------------------------------------

function validateNoteTuple(tuple: unknown, prefix: string, errors: ValidationError[]): void {
  if (!Array.isArray(tuple) || tuple.length < 2 || tuple.length > 3) {
    errors.push({
      path: prefix,
      message: 'NoteTuple must be [note, duration, beat?] (2 or 3 elements)',
    });
    return;
  }

  const [note, duration, beat] = tuple;

  // note
  if (typeof note !== 'string') {
    errors.push({ path: `${prefix}[0]`, message: 'Note must be string (e.g. "C4", "R")' });
  } else if (note !== 'R' && !NOTE_RE.test(note)) {
    errors.push({
      path: `${prefix}[0]`,
      message: `Invalid note "${note}". Expected "R" or [A-G][#b]?[0-9]`,
    });
  }

  // duration
  if (typeof duration !== 'string' || !DURATION_SYMBOLS.has(duration)) {
    errors.push({
      path: `${prefix}[1]`,
      message: `Invalid duration "${duration}". Expected one of: w, h, q, e, s, t (optionally dotted)`,
    });
  }

  // beat (optional)
  if (beat !== undefined) {
    if (typeof beat !== 'string' && typeof beat !== 'number') {
      errors.push({ path: `${prefix}[2]`, message: 'Beat must be string or number' });
    }
  }
}
