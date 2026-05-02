import { describe, it, expect } from 'vitest';
import { MusicUtils } from '../src/music/MusicUtils.js';

describe('MusicUtils', () => {
  describe('noteToFreq', () => {
    it('should return 440 for A4', () => {
      expect(MusicUtils.noteToFreq('A4')).toBe(440);
    });

    it('should return approximately 261.63 for C4', () => {
      const freq = MusicUtils.noteToFreq('C4');
      expect(freq).toBeCloseTo(261.63, 1);
    });

    it('should return approximately 523.25 for C5', () => {
      const freq = MusicUtils.noteToFreq('C5');
      expect(freq).toBeCloseTo(523.25, 1);
    });

    it('should throw for empty string', () => {
      expect(() => MusicUtils.noteToFreq('')).toThrow();
    });

    it('should throw for invalid note format', () => {
      expect(() => MusicUtils.noteToFreq('H4')).toThrow();
      expect(() => MusicUtils.noteToFreq('C')).toThrow();
      expect(() => MusicUtils.noteToFreq('C10')).toThrow();
    });
  });

  describe('freqToNote', () => {
    it('should return A4 for 440 Hz', () => {
      expect(MusicUtils.freqToNote(440)).toBe('A4');
    });

    it('should return C4 for approximately 261 Hz', () => {
      expect(MusicUtils.freqToNote(261)).toBe('C4');
    });

    it('should return C4 for approximately 261.63 Hz', () => {
      expect(MusicUtils.freqToNote(261.63)).toBe('C4');
    });
  });

  describe('durationToMs', () => {
    it('should return 500 for quarter note at 120 BPM', () => {
      expect(MusicUtils.durationToMs('q', 120)).toBe(500);
    });

    it('should return 250 for eighth note at 120 BPM', () => {
      expect(MusicUtils.durationToMs('e', 120)).toBe(250);
    });

    it('should return 750 for dotted quarter note at 120 BPM', () => {
      expect(MusicUtils.durationToMs('q.', 120)).toBe(750);
    });

    it('should return raw number for numeric duration', () => {
      expect(MusicUtils.durationToMs(250, 120)).toBe(250);
    });

    it('should throw for invalid duration symbol', () => {
      expect(() => MusicUtils.durationToMs('x' as 'w', 120)).toThrow();
    });

    it('should throw for non-positive BPM', () => {
      expect(() => MusicUtils.durationToMs('q', 0)).toThrow();
      expect(() => MusicUtils.durationToMs('q', -10)).toThrow();
    });
  });

  describe('bpmToQNoteMs', () => {
    it('should return 500 for 120 BPM', () => {
      expect(MusicUtils.bpmToQNoteMs(120)).toBe(500);
    });

    it('should return 60000 for 1 BPM', () => {
      expect(MusicUtils.bpmToQNoteMs(1)).toBe(60000);
    });

    it('should throw for zero BPM', () => {
      expect(() => MusicUtils.bpmToQNoteMs(0)).toThrow();
    });
  });

  describe('scale', () => {
    it('should return 7 notes for C major', () => {
      const scale = MusicUtils.scale('C', 'major', 4);
      expect(scale).toHaveLength(7);
      expect(scale).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
    });

    it('should return 7 notes for A minor', () => {
      const scale = MusicUtils.scale('A', 'minor', 4);
      expect(scale).toHaveLength(7);
      expect(scale).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']);
    });

    it('should return 5 notes for C pentatonic', () => {
      const scale = MusicUtils.scale('C', 'pentatonic', 4);
      expect(scale).toHaveLength(5);
      expect(scale).toEqual(['C4', 'D4', 'E4', 'G4', 'A4']);
    });

    it('should default to octave 4 when not specified', () => {
      const scale = MusicUtils.scale('C', 'major');
      expect(scale[0]).toBe('C4');
    });
  });

  describe('chord', () => {
    it('should return A minor chord', () => {
      const chord = MusicUtils.chord('A', 'minor', 3);
      expect(chord).toEqual(['A3', 'C4', 'E4']);
    });

    it('should return C major chord', () => {
      const chord = MusicUtils.chord('C', 'major', 4);
      expect(chord).toEqual(['C4', 'E4', 'G4']);
    });

    it('should default to octave 4 when not specified', () => {
      const chord = MusicUtils.chord('C', 'major');
      expect(chord).toEqual(['C4', 'E4', 'G4']);
    });
  });

  describe('transpose', () => {
    it('should transpose C4 up by 2 semitones to D4', () => {
      expect(MusicUtils.transpose('C4', 2)).toBe('D4');
    });

    it('should transpose A4 up by 12 semitones to A5', () => {
      expect(MusicUtils.transpose('A4', 12)).toBe('A5');
    });

    it('should transpose down by negative semitones', () => {
      expect(MusicUtils.transpose('D4', -2)).toBe('C4');
    });

    it('should throw for invalid note', () => {
      expect(() => MusicUtils.transpose('H4', 2)).toThrow();
    });
  });

  describe('setOctave', () => {
    it('should change C4 to C5', () => {
      expect(MusicUtils.setOctave('C4', 5)).toBe('C5');
    });

    it('should change A3 to A2', () => {
      expect(MusicUtils.setOctave('A3', 2)).toBe('A2');
    });

    it('should preserve accidentals', () => {
      expect(MusicUtils.setOctave('C#4', 6)).toBe('C#6');
      expect(MusicUtils.setOctave('Bb3', 5)).toBe('Bb5');
    });

    it('should throw for invalid note', () => {
      expect(() => MusicUtils.setOctave('', 4)).toThrow();
    });
  });
});
