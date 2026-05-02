const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface ParsedNote {
  name: string;
  accidental: '#' | 'b' | '';
  octave: number;
  midi: number;
}

export function parseNote(note: string): ParsedNote {
  const match = note.match(/^([A-Ga-g])([#b]?)([0-9])$/);
  if (!match) {
    throw new RangeError(`Invalid note: ${note}`);
  }

  const name = match[1].toUpperCase();
  const accidental = match[2] as '#' | 'b' | '';
  const octave = parseInt(match[3], 10);

  const baseIndex = NOTE_NAMES.indexOf(name);
  let semitone = baseIndex;
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;

  const midi = semitone + (octave + 1) * 12;

  return { name, accidental, octave, midi };
}

export function noteToFreq(parsed: ParsedNote): number {
  return midiToFreq(parsed.midi);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = ((midi % 12) + 12) % 12;
  return NOTE_NAMES[semitone] + octave;
}

export function transposeNote(note: string, semitones: number): string {
  const parsed = parseNote(note);
  const newMidi = parsed.midi + semitones;
  return midiToNote(newMidi);
}
