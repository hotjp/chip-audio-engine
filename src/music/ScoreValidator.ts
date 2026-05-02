import type { Score, ScoreTrack, ScoreNote, PerformanceExpr } from '../engine/types.js';

/** 音名正则：[A-G][#b][0-9] 或 null */
const NOTE_RE = /^[A-Ga-g][#b]?[0-9]$/;

/** 合法时值符号集合 */
const DURATION_SYMBOLS = new Set([
  'w', 'h', 'q', 'e', 's', 't',
  'w.', 'h.', 'q.', 'e.', 's.',
]);

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
 * 校验一个 Score JSON 对象是否语法正确。
 *
 * @param score - 待校验的 Score 对象
 * @returns 校验结果，包含所有发现的错误
 *
 * @example
 * ```ts
 * const result = validateScore(json);
 * if (!result.valid) {
 *   for (const err of result.errors) {
 *     console.error(`${err.path}: ${err.message}`);
 *   }
 * }
 * ```
 */
export function validateScore(score: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof score !== 'object' || score === null) {
    return { valid: false, errors: [{ path: '', message: 'Score must be an object' }] };
  }

  const s = score as Record<string, unknown>;

  // 必填字段
  if (typeof s.id !== 'string' || s.id.length === 0) {
    errors.push({ path: 'id', message: 'Required: non-empty string' });
  }
  if (typeof s.name !== 'string' || s.name.length === 0) {
    errors.push({ path: 'name', message: 'Required: non-empty string' });
  }
  if (typeof s.bpm !== 'number' || s.bpm <= 0 || s.bpm > 300) {
    errors.push({ path: 'bpm', message: 'Required: number (0, 300]' });
  }
  if (typeof s.timbrePack !== 'string' || s.timbrePack.length === 0) {
    errors.push({ path: 'timbrePack', message: 'Required: non-empty string (Timbre Pack name)' });
  }

  // config（可选）
  if (s.config !== undefined) {
    validateConfig(s.config, errors);
  }

  // tracks
  if (!Array.isArray(s.tracks) || s.tracks.length === 0) {
    errors.push({ path: 'tracks', message: 'Required: non-empty array of tracks' });
  } else {
    for (let i = 0; i < s.tracks.length; i++) {
      validateTrack(s.tracks[i] as Record<string, unknown>, i, errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateConfig(config: unknown, errors: ValidationError[]): void {
  if (typeof config !== 'object' || config === null) {
    errors.push({ path: 'config', message: 'Must be an object' });
    return;
  }
  const c = config as Record<string, unknown>;

  if (c.loop !== undefined && typeof c.loop !== 'boolean') {
    errors.push({ path: 'config.loop', message: 'Must be boolean' });
  }
  if (c.volume !== undefined && (typeof c.volume !== 'number' || c.volume < 0 || c.volume > 1)) {
    errors.push({ path: 'config.volume', message: 'Must be number [0, 1]' });
  }
  if (c.reverb !== undefined && typeof c.reverb !== 'string') {
    errors.push({ path: 'config.reverb', message: 'Must be string (reverb preset name)' });
  }
}

function validateTrack(track: Record<string, unknown>, index: number, errors: ValidationError[]): void {
  const prefix = `tracks[${index}]`;

  // timbre
  if (typeof track.timbre !== 'string' || track.timbre.length === 0) {
    errors.push({ path: `${prefix}.timbre`, message: 'Required: non-empty string (timbre name)' });
  }

  // volume
  if (track.volume !== undefined && (typeof track.volume !== 'number' || track.volume < 0 || track.volume > 1)) {
    errors.push({ path: `${prefix}.volume`, message: 'Must be number [0, 1]' });
  }

  // mute
  if (track.mute !== undefined && typeof track.mute !== 'boolean') {
    errors.push({ path: `${prefix}.mute`, message: 'Must be boolean' });
  }

  // loopStart
  if (track.loopStart !== undefined && (typeof track.loopStart !== 'number' || track.loopStart < 0)) {
    errors.push({ path: `${prefix}.loopStart`, message: 'Must be non-negative number' });
  }

  // transpose
  if (track.transpose !== undefined && (typeof track.transpose !== 'number' || track.transpose < -24 || track.transpose > 24)) {
    errors.push({ path: `${prefix}.transpose`, message: 'Must be number [-24, 24]' });
  }

  // performance
  if (track.performance !== undefined) {
    validatePerformance(track.performance, `${prefix}.performance`, errors);
  }

  // notes
  if (!Array.isArray(track.notes) || track.notes.length === 0) {
    errors.push({ path: `${prefix}.notes`, message: 'Required: non-empty array of notes' });
  } else {
    for (let i = 0; i < track.notes.length; i++) {
      validateNote(track.notes[i] as Record<string, unknown>, `${prefix}.notes[${i}]`, errors);
    }
  }
}

function validatePerformance(perf: unknown, prefix: string, errors: ValidationError[]): void {
  if (typeof perf !== 'object' || perf === null) {
    errors.push({ path: prefix, message: 'Must be an object' });
    return;
  }
  const p = perf as Record<string, unknown>;

  if (p.swing !== undefined && (typeof p.swing !== 'number' || p.swing < 0 || p.swing > 1)) {
    errors.push({ path: `${prefix}.swing`, message: 'Must be number [0, 1]' });
  }
  if (p.humanize !== undefined && (typeof p.humanize !== 'number' || p.humanize < 0 || p.humanize > 1)) {
    errors.push({ path: `${prefix}.humanize`, message: 'Must be number [0, 1]' });
  }
  if (p.layback !== undefined && (typeof p.layback !== 'number' || p.layback < -100 || p.layback > 100)) {
    errors.push({ path: `${prefix}.layback`, message: 'Must be number [-100, 100] (ms)' });
  }
  if (p.velocityCurve !== undefined) {
    if (!Array.isArray(p.velocityCurve) || p.velocityCurve.length < 2) {
      errors.push({ path: `${prefix}.velocityCurve`, message: 'Must be array of [index, multiplier] pairs (min 2)' });
    } else {
      for (let i = 0; i < p.velocityCurve.length; i++) {
        const point = p.velocityCurve[i];
        if (!Array.isArray(point) || point.length !== 2 ||
            typeof point[0] !== 'number' || typeof point[1] !== 'number' ||
            point[0] < 0 || point[1] < 0 || point[1] > 1) {
          errors.push({
            path: `${prefix}.velocityCurve[${i}]`,
            message: 'Must be [noteIndex: number >=0, multiplier: number 0-1]',
          });
        }
      }
    }
  }
}

function validateNote(note: Record<string, unknown>, prefix: string, errors: ValidationError[]): void {
  // note（音名或 null）
  if (note.note === null || note.note === undefined) {
    // null/undefined = rest, but must be explicitly null if no sound
    // undefined is not valid for the note field
    if (note.note === undefined) {
      errors.push({ path: `${prefix}.note`, message: 'Required: note name string or null (rest)' });
    }
  } else if (typeof note.note !== 'string') {
    errors.push({ path: `${prefix}.note`, message: 'Must be string (e.g. "C4", "A#3") or null' });
  } else if (!NOTE_RE.test(note.note)) {
    errors.push({ path: `${prefix}.note`, message: `Invalid note format: "${note.note}". Expected [A-G][#b][0-9] (e.g. "C4", "A#3", "Bb5")` });
  }

  // duration
  if (note.duration === undefined) {
    errors.push({ path: `${prefix}.duration`, message: 'Required: duration symbol (w/h/q/e/s/t) or number (ms)' });
  } else if (typeof note.duration === 'string') {
    if (!DURATION_SYMBOLS.has(note.duration)) {
      errors.push({ path: `${prefix}.duration`, message: `Invalid duration symbol: "${note.duration}". Expected one of: w, h, q, e, s, t (optionally dotted with .)` });
    }
  } else if (typeof note.duration === 'number') {
    if (note.duration <= 0) {
      errors.push({ path: `${prefix}.duration`, message: 'Custom duration must be > 0 (ms)' });
    }
  } else {
    errors.push({ path: `${prefix}.duration`, message: 'Must be string (duration symbol) or number (ms)' });
  }

  // velocity
  if (note.velocity !== undefined && (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 1)) {
    errors.push({ path: `${prefix}.velocity`, message: 'Must be number [0, 1]' });
  }

  // offset
  if (note.offset !== undefined && (typeof note.offset !== 'number' || note.offset < -100 || note.offset > 100)) {
    errors.push({ path: `${prefix}.offset`, message: 'Must be number [-100, 100] (ms)' });
  }
}
