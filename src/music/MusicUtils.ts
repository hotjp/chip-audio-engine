import {
  parseNote,
  noteToFreq as npNoteToFreq,
  midiToFreq,
  freqToMidi,
  midiToNote,
  transposeNote,
} from './NoteParser.js';
import {
  DurationValue,
  durationToMs as dpDurationToMs,
  bpmToQNoteMs as dpBpmToQNoteMs,
} from './DurationParser.js';

export type ScaleType =
  | 'major' | 'minor' | 'pentatonic' | 'blues'
  | 'dorian' | 'mixolydian' | 'phrygian' | 'lydian';

export type ChordType =
  | 'major' | 'minor' | 'dim' | 'aug'
  | 'maj7' | 'min7' | 'dom7' | 'sus2' | 'sus4';

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

const CHORD_INTERVALS: Record<ChordType, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

export class MusicUtils {
  static noteToFreq(note: string): number {
    const parsed = parseNote(note);
    return npNoteToFreq(parsed);
  }

  static freqToNote(freq: number): string {
    const midi = freqToMidi(freq);
    return midiToNote(midi);
  }

  static durationToMs(duration: DurationValue, bpm: number): number {
    return dpDurationToMs(duration, bpm);
  }

  static bpmToQNoteMs(bpm: number): number {
    return dpBpmToQNoteMs(bpm);
  }

  static scale(root: string, type: ScaleType, octave = 4): string[] {
    const intervals = SCALE_INTERVALS[type];
    const rootMidi = parseNote(root + octave).midi;
    return intervals.map(semitone => midiToNote(rootMidi + semitone));
  }

  static chord(root: string, type: ChordType, octave = 4): string[] {
    const intervals = CHORD_INTERVALS[type];
    const rootMidi = parseNote(root + octave).midi;
    return intervals.map(semitone => midiToNote(rootMidi + semitone));
  }

  static transpose(note: string, semitones: number): string {
    return transposeNote(note, semitones);
  }

  static setOctave(note: string, octave: number): string {
    const parsed = parseNote(note);
    return parsed.name + parsed.accidental + octave;
  }
}
