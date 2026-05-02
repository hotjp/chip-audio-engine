export type DurationSymbol =
  | 'w' | 'h' | 'q' | 'e' | 's' | 't'
  | 'w.' | 'h.' | 'q.' | 'e.' | 's.';

export type DurationValue = DurationSymbol | number;

const BEAT_MAP: Record<DurationSymbol, number> = {
  'w': 4,
  'w.': 6,
  'h': 2,
  'h.': 3,
  'q': 1,
  'q.': 1.5,
  'e': 0.5,
  'e.': 0.75,
  's': 0.25,
  's.': 0.375,
  't': 0.125,
};

export function durationToMs(duration: DurationValue, bpm: number): number {
  if (typeof duration === 'number') {
    return duration;
  }
  const beats = BEAT_MAP[duration];
  if (beats === undefined) {
    throw new RangeError(`Invalid duration symbol: ${duration}`);
  }
  return beats * bpmToQNoteMs(bpm);
}

export function bpmToQNoteMs(bpm: number): number {
  if (bpm <= 0) {
    throw new RangeError(`BPM must be positive, got: ${bpm}`);
  }
  return 60000 / bpm;
}

export function durationToBeats(duration: DurationValue): number {
  if (typeof duration === 'number') {
    return duration / bpmToQNoteMs(120);
  }
  const beats = BEAT_MAP[duration];
  if (beats === undefined) {
    throw new RangeError(`Invalid duration symbol: ${duration}`);
  }
  return beats;
}

export function isDotted(duration: DurationValue): boolean {
  if (typeof duration === 'number') {
    return false;
  }
  return duration.endsWith('.');
}

export function isEighthOrShorter(duration: DurationValue): boolean {
  if (typeof duration === 'number') {
    return false;
  }
  const beats = BEAT_MAP[duration];
  if (beats === undefined) {
    return false;
  }
  return beats <= 0.75;
}
