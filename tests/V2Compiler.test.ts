import { describe, it, expect } from 'vitest';
import { V2Compiler } from '../src/music/V2Compiler.js';
import type { ScoreV2 } from '../src/engine/types-v2.js';

function createMinimalScore(overrides?: Partial<ScoreV2>): ScoreV2 {
  const base: ScoreV2 = {
    $schema: 'cae-score-v2',
    meta: {
      $schema: 'cae-score-v2',
      title: 'Test',
      bpm: 120,
      timeSignature: [4, 4],
      timbrePack: 'test-pack',
    },
    tracks: [{ name: 'lead', timbre: 'lead' }],
    chapters: [{ id: 'intro', bars: 1 }],
    score: [
      { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1]] } },
    ],
  };
  return { ...base, ...overrides } as ScoreV2;
}

describe('V2Compiler', () => {
  // ============ 基础编译 ============

  it('should compile minimal score to v1 Score', () => {
    const v2 = createMinimalScore();
    const score = V2Compiler.compile(v2);
    expect(score.id).toBe('test');
    expect(score.name).toBe('Test');
    expect(score.bpm).toBe(120);
    expect(score.timbrePack).toBe('test-pack');
    expect(score.tracks).toHaveLength(1);
    expect(score.tracks[0].timbre).toBe('lead');
  });

  it('should compile sequential notes without beat', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q'], ['D4', 'q'], ['E4', 'q'], ['F4', 'q']] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.note)).toEqual(['C4', 'D4', 'E4', 'F4']);
    expect(notes.every((n) => n.duration === 'q')).toBe(true);
  });

  it('should convert beat positions to sequential with rests', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['E4', 'q', 3]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    // C4 q, R q, E4 q, R q (fills 4 beats)
    expect(notes).toHaveLength(4);
    expect(notes[0].note).toBe('C4');
    expect(notes[0].duration).toBe('q');
    expect(notes[1].note).toBeNull();
    expect(notes[1].duration).toBe('q');
    expect(notes[2].note).toBe('E4');
    expect(notes[3].note).toBeNull();
  });

  it('should handle rest notes (R)', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['R', 'q', 2], ['E4', 'q', 3], ['R', 'q', 4]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes[0].note).toBe('C4');
    expect(notes[1].note).toBeNull();
    expect(notes[2].note).toBe('E4');
    expect(notes[3].note).toBeNull();
  });

  it('should fill empty bar with whole rest', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'intro', bar: 2 }, // empty bar
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes).toHaveLength(2);
    expect(notes[0].note).toBe('C4');
    expect(notes[0].duration).toBe('w');
    expect(notes[1].note).toBeNull();
    expect(notes[1].duration).toBe('w');
  });

  // ============ Pattern 展开 ============

  it('should expand string pattern reference', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      tracks: [{ name: 'kick', timbre: 'kick' }],
      patterns: {
        'kick-std': {
          kick: [['C2', 'q', 1], ['R', 'q', 2], ['C2', 'q', 3], ['R', 'q', 4]],
        },
      },
      score: [
        { chapter: 'intro', bar: 1, t: { kick: '$kick-std.kick' } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.note)).toEqual(['C2', null, 'C2', null]);
  });

  it('should expand PatternRef with transpose', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      patterns: {
        motif: {
          lead: [['C4', 'q', 1], ['E4', 'q', 2], ['G4', 'q', 3]],
        },
      },
      score: [
        { chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', transpose: 2 } } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes.map((n) => n.note)).toEqual(['D4', 'F#4', 'A4', null]);
  });

  it('should not transpose rest notes in PatternRef', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      patterns: {
        motif: {
          lead: [['C4', 'q', 1], ['R', 'q', 2]],
        },
      },
      score: [
        { chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', transpose: 3 } } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes[0].note).toBe('D#4');
    expect(notes[1].note).toBeNull();
  });

  // ============ 移调 ============

  it('should apply transpose correctly for positive semitones', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', transpose: 12 } } },
      ],
      patterns: {
        motif: { lead: [['C4', 'q', 1]] },
      },
    });
    const score = V2Compiler.compile(v2);
    expect(score.tracks[0].notes[0].note).toBe('C5');
  });

  it('should apply transpose correctly for negative semitones', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', transpose: -12 } } },
      ],
      patterns: {
        motif: { lead: [['C4', 'q', 1]] },
      },
    });
    const score = V2Compiler.compile(v2);
    expect(score.tracks[0].notes[0].note).toBe('C3');
  });

  // ============ ref + override ============

  it('should expand ref to copy bar content', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q', 2]] } },
        { chapter: 'intro', bar: 2, ref: 1 },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes).toHaveLength(6);
    expect(notes.map((n) => n.note)).toEqual(['C4', 'D4', null, 'C4', 'D4', null]);
  });

  it('should apply override on top of ref', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        { name: 'lead', timbre: 'lead' },
        { name: 'bass', timbre: 'bass' },
      ],
      score: [
        {
          chapter: 'intro',
          bar: 1,
          t: {
            lead: [['C4', 'q', 1]],
            bass: [['C2', 'q', 1]],
          },
        },
        {
          chapter: 'intro',
          bar: 2,
          ref: 1,
          override: {
            bass: [['D2', 'q', 1]],
          },
        },
      ],
    });
    const score = V2Compiler.compile(v2);
    const leadNotes = score.tracks.find((t) => t.timbre === 'lead')!.notes;
    const bassNotes = score.tracks.find((t) => t.timbre === 'bass')!.notes;
    expect(leadNotes.map((n) => n.note)).toEqual(['C4', null, 'C4', null]);
    expect(bassNotes.map((n) => n.note)).toEqual(['C2', null, 'D2', null]);
  });

  // ============ silence ============

  it('should generate whole rests for silence bar', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        { name: 'lead', timbre: 'lead' },
        { name: 'bass', timbre: 'bass' },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]], bass: [['C2', 'w', 1]] } },
        { chapter: 'intro', bar: 2, silence: true },
      ],
    });
    const score = V2Compiler.compile(v2);
    for (const track of score.tracks) {
      expect(track.notes).toHaveLength(2);
      expect(track.notes[1].note).toBeNull();
      expect(track.notes[1].duration).toBe('w');
    }
  });

  // ============ Velocity 曲线 ============

  it('should apply linear velocity curve as per-note velocity', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: {
            velocity: {
              curve: 'linear',
              points: [
                ['intro:start', 0.5],
                ['intro:end', 1.0],
              ],
            },
          },
        },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q', 2], ['E4', 'q', 3], ['F4', 'q', 4]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['G4', 'q', 1], ['A4', 'q', 2], ['B4', 'q', 3], ['C5', 'q', 4]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    // first note at start of bar 0 → near start anchor
    expect(notes[0].velocity!).toBeCloseTo(0.5, 2);
    // velocity should increase across the score
    expect(notes[3].velocity!).toBeGreaterThan(notes[0].velocity!);
    expect(notes[7].velocity!).toBeGreaterThan(notes[3].velocity!);
    // last note should be close to end anchor (slightly before due to start-position sampling)
    expect(notes[7].velocity!).toBeCloseTo(0.9375, 2);
  });

  it('should apply step velocity curve', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: {
            velocity: {
              curve: 'step',
              points: [
                ['intro:start', 0.3],
                ['intro:end', 0.9],
              ],
            },
          },
        },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q', 2], ['E4', 'q', 3], ['F4', 'q', 4]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['G4', 'q', 1], ['A4', 'q', 2], ['B4', 'q', 3], ['C5', 'q', 4]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    // With step curve [intro:start, 0.3] -> [intro:end, 0.9] on 2 bars,
    // all notes are before the end anchor (x=1) so they all get 0.3
    expect(notes[0].velocity!).toBeCloseTo(0.3, 2);
    expect(notes[3].velocity!).toBeCloseTo(0.3, 2);
    expect(notes[4].velocity!).toBeCloseTo(0.3, 2);
    expect(notes[7].velocity!).toBeCloseTo(0.3, 2);
  });

  it('should support percentage velocity anchors', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: {
            velocity: {
              curve: 'linear',
              points: [
                [0, 0.2],
                [1, 1.0],
              ],
            },
          },
        },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['D4', 'w', 1]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    // First note at global position 0/2 = 0
    expect(notes[0].velocity!).toBeCloseTo(0.2, 2);
    // Second note at global position 1/2 = 0.5
    expect(notes[1].velocity!).toBeCloseTo(0.6, 2);
  });

  // ============ Transition / overlap ============

  it('should place overlapping transition bars at same global time', () => {
    const v2: ScoreV2 = {
      $schema: 'cae-score-v2',
      meta: {
        $schema: 'cae-score-v2',
        title: 'Overlap',
        bpm: 120,
        timeSignature: [4, 4],
        timbrePack: 'test',
      },
      tracks: [
        { name: 'lead', timbre: 'lead' },
      ],
      chapters: [
        { id: 'intro', bars: 4, transition: 2 },
        { id: 'dev', bars: 4 },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['D4', 'w', 1]] } },
        { chapter: 'intro', bar: 3, blend: { next: 'dev', weight: 0.3 }, t: { lead: [['E4', 'w', 1]] } },
        { chapter: 'intro', bar: 4, blend: { next: 'dev', weight: 0.7 }, t: { lead: [['F4', 'w', 1]] } },
        { chapter: 'dev', bar: 1, t: { lead: [['G4', 'w', 1]] } },
        { chapter: 'dev', bar: 2, t: { lead: [['A4', 'w', 1]] } },
        { chapter: 'dev', bar: 3, t: { lead: [['B4', 'w', 1]] } },
        { chapter: 'dev', bar: 4, t: { lead: [['C5', 'w', 1]] } },
      ],
    };
    const score = V2Compiler.compile(v2);
    // intro bar 3-4 overlap with dev bar 1-2
    // global bars: intro1=0, intro2=1, intro3+dev1=2, intro4+dev2=3, dev3=4, dev4=5
    const notes = score.tracks[0].notes;
    expect(notes.map((n) => n.note)).toEqual([
      'C4', 'D4', 'E4', 'G4', 'F4', 'A4', 'B4', 'C5',
    ]);
  });

  // ============ Multi-track ============

  it('should compile multiple tracks independently', () => {
    const v2 = createMinimalScore({
      tracks: [
        { name: 'lead', timbre: 'lead', volume: 0.8 },
        { name: 'bass', timbre: 'bass', mute: true },
      ],
      score: [
        {
          chapter: 'intro',
          bar: 1,
          t: {
            lead: [['C4', 'q', 1]],
            bass: [['C2', 'q', 1]],
          },
        },
      ],
    });
    const score = V2Compiler.compile(v2);
    expect(score.tracks).toHaveLength(2);
    expect(score.tracks[0].volume).toBe(0.8);
    expect(score.tracks[0].mute).toBeUndefined();
    expect(score.tracks[1].mute).toBe(true);
    expect(score.tracks[0].notes[0].note).toBe('C4');
    expect(score.tracks[1].notes[0].note).toBe('C2');
  });

  // ============ Performance params ============

  it('should preserve swing, humanize, layback in performance', () => {
    const v2 = createMinimalScore({
      tracks: [
        {
          name: 'lead',
          timbre: 'lead',
          perf: { swing: 0.3, humanize: 0.1, layback: 20 },
        },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const perf = score.tracks[0].performance;
    expect(perf?.swing).toBe(0.3);
    expect(perf?.humanize).toBe(0.1);
    expect(perf?.layback).toBe(20);
    expect(perf?.velocityCurve).toBeUndefined();
  });

  // ============ Time signature variants ============

  it('should handle 3/4 time signature with dotted half rest', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      meta: {
        $schema: 'cae-score-v2',
        title: 'Waltz',
        bpm: 120,
        timeSignature: [3, 4],
        timbrePack: 'test',
      },
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes[0].duration).toBe('q');
    // trailing rest for 2 beats -> h
    expect(notes[1].duration).toBe('h');
  });

  // ============ Full integration ============

  it('should compile full score with patterns, refs, velocity, and transitions', () => {
    const v2: ScoreV2 = {
      $schema: 'cae-score-v2',
      meta: {
        $schema: 'cae-score-v2',
        title: "Hero's March",
        bpm: 130,
        timeSignature: [4, 4],
        timbrePack: '16bit-sfc',
      },
      tracks: [
        { name: 'lead', timbre: 'lead' },
        { name: 'kick', timbre: 'kick' },
      ],
      patterns: {
        'kick-std': {
          kick: [['C2', 'q', 1], ['R', 'q', 2], ['C2', 'q', 3], ['R', 'q', 4]],
        },
      },
      chapters: [
        { id: 'intro', bars: 4, transition: 2 },
        { id: 'dev', bars: 4 },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['G3', 'q', 1], ['G3', 'q', 2], ['D4', 'h', '3-4']] } },
        { chapter: 'intro', bar: 2, t: { kick: '$kick-std.kick' } },
        { chapter: 'intro', bar: 3, blend: { next: 'dev', weight: 0.3 }, t: { lead: [['A3', 'w', 1]] } },
        { chapter: 'intro', bar: 4, ref: 2 },
        { chapter: 'dev', bar: 1, t: { lead: [['B3', 'w', 1]] } },
        { chapter: 'dev', bar: 2, silence: true },
        { chapter: 'dev', bar: 3, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'dev', bar: 4, t: { lead: [['D4', 'w', 1]] } },
      ],
    };
    const score = V2Compiler.compile(v2);
    expect(score.tracks).toHaveLength(2);
    expect(score.bpm).toBe(130);
    // lead notes should be present
    const lead = score.tracks.find((t) => t.timbre === 'lead')!;
    expect(lead.notes.length).toBeGreaterThan(0);
    // kick pattern should be expanded
    const kick = score.tracks.find((t) => t.timbre === 'kick')!;
    expect(kick.notes.some((n) => n.note === 'C2')).toBe(true);
  });

  // ============ Beat string formats ============

  it('should parse beat string "3-4" correctly', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'h', '3-4']] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes[0].note).toBe('C4');
    expect(notes[0].duration).toBe('q');
    expect(notes[1].note).toBeNull(); // rest at beat 2
    expect(notes[1].duration).toBe('q');
    expect(notes[2].note).toBe('D4');
    expect(notes[2].duration).toBe('h');
  });

  it('should infer missing beats sequentially when mixed with explicit beats', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1], ['D4', 'q'], ['E4', 'q', 3], ['F4', 'q']] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes.map((n) => n.note)).toEqual(['C4', 'D4', 'E4', 'F4']);
  });

  // ============ Edge cases ============

  it('should handle track with no notes across entire score', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 2 }],
      tracks: [
        { name: 'lead', timbre: 'lead' },
        { name: 'fx', timbre: 'noise' },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['C4', 'w', 1]] } },
        { chapter: 'intro', bar: 2, t: { lead: [['D4', 'w', 1]] } },
      ],
    });
    const score = V2Compiler.compile(v2);
    const fx = score.tracks.find((t) => t.timbre === 'noise')!;
    expect(fx.notes).toHaveLength(2);
    expect(fx.notes.every((n) => n.note === null)).toBe(true);
  });

  it('should handle empty score array as all silence', () => {
    const v2 = createMinimalScore({
      chapters: [{ id: 'intro', bars: 1 }],
      score: [],
    });
    const score = V2Compiler.compile(v2);
    const notes = score.tracks[0].notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].note).toBeNull();
    expect(notes[0].duration).toBe('w');
  });

  it('should sanitize id from title', () => {
    const v2 = createMinimalScore({
      meta: {
        $schema: 'cae-score-v2',
        title: 'My Cool Track!',
        bpm: 120,
        timeSignature: [4, 4],
        timbrePack: 'test',
      },
    });
    const score = V2Compiler.compile(v2);
    expect(score.id).toBe('my-cool-track');
  });

  it('should throw on invalid pattern reference format', () => {
    const v2 = createMinimalScore({
      score: [
        { chapter: 'intro', bar: 1, t: { lead: '$badformat' } },
      ],
    });
    expect(() => V2Compiler.compile(v2)).toThrow('Pattern reference must be');
  });

  it('should throw on missing pattern', () => {
    const v2 = createMinimalScore({
      score: [
        { chapter: 'intro', bar: 1, t: { lead: '$missing.lead' } },
      ],
    });
    expect(() => V2Compiler.compile(v2)).toThrow('Pattern "missing" not found');
  });
});
