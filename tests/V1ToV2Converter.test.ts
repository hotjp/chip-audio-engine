import { describe, it, expect } from 'vitest';
import { V1ToV2Converter } from '../src/music/V1ToV2Converter.js';
import { V2Compiler } from '../src/music/V2Compiler.js';
import { validateScoreV2 } from '../src/music/ScoreV2Validator.js';
import type { Score } from '../src/engine/types.js';
import type { ScoreV2, Chapter } from '../src/engine/types-v2.js';

function createV1Score(overrides?: Partial<Score>): Score {
  const base: Score = {
    id: 'test',
    name: 'Test Score',
    bpm: 120,
    timbrePack: 'test-pack',
    tracks: [
      {
        timbre: 'lead',
        notes: [
          { note: 'C4', duration: 'q' },
          { note: 'D4', duration: 'q' },
          { note: 'E4', duration: 'q' },
          { note: 'F4', duration: 'q' },
        ],
      },
    ],
  };
  return { ...base, ...overrides } as Score;
}

describe('V1ToV2Converter', () => {
  // ============ 基础转换 ============

  it('should convert minimal score to valid v2', () => {
    const v1 = createV1Score();
    const v2 = V1ToV2Converter.convert(v1);

    expect(v2.$schema).toBe('cae-score-v2');
    expect(v2.meta.title).toBe('Test Score');
    expect(v2.meta.bpm).toBe(120);
    expect(v2.meta.timbrePack).toBe('test-pack');
    expect(v2.tracks).toHaveLength(1);
    expect(v2.tracks[0].name).toBe('lead');
    expect(v2.tracks[0].timbre).toBe('lead');
  });

  it('should split notes into correct number of bars', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: 'D4', duration: 'q' },
            { note: 'E4', duration: 'q' },
            { note: 'F4', duration: 'q' },
            { note: 'G4', duration: 'q' },
            { note: 'A4', duration: 'q' },
            { note: 'B4', duration: 'q' },
            { note: 'C5', duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    expect(v2.score).toHaveLength(2);
    expect(v2.score[0].t?.lead).toBeDefined();
    expect(v2.score[1].t?.lead).toBeDefined();
  });

  it('should handle partial last bar', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: 'D4', duration: 'q' },
            { note: 'E4', duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    expect(v2.score).toHaveLength(1);
    const notes = (v2.score[0].t?.lead as [string, string][]);
    expect(notes).toHaveLength(3);
  });

  // ============ Pattern 检测 ============

  it('should detect repeating drum patterns', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'kick',
          notes: [
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            // Repeat 3x
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    expect(v2.patterns).toBeDefined();
    expect(Object.keys(v2.patterns!)).toHaveLength(1);

    const patternName = Object.keys(v2.patterns!)[0];
    expect(v2.patterns![patternName]).toEqual({
      kick: [['C2', 'q'], ['R', 'q'], ['C2', 'q'], ['R', 'q']],
    });

    // Score should use pattern reference
    const barContent = v2.score[0].t?.kick;
    expect(typeof barContent).toBe('string');
    expect(barContent).toBe(`\$${patternName}.kick`);
  });

  it('should not extract patterns with fewer than 3 repeats', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'kick',
          notes: [
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            // Different
            { note: 'D2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'D2', duration: 'q' },
            { note: null, duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1, { minPatternRepeats: 3 });
    // Only 2 repeats of each pattern, so no patterns extracted
    expect(v2.patterns).toBeUndefined();
  });

  // ============ Round-trip ============

  it('should compile back to identical v1 notes for simple score', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: 'D4', duration: 'q' },
            { note: 'E4', duration: 'h' },
          ],
        },
        {
          timbre: 'bass',
          notes: [
            { note: 'C2', duration: 'w' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    const compiled = V2Compiler.compile(v2);

    expect(compiled.tracks).toHaveLength(2);
    expect(compiled.tracks[0].notes.map((n) => n.note)).toEqual(['C4', 'D4', 'E4']);
    expect(compiled.tracks[0].notes.map((n) => n.duration)).toEqual(['q', 'q', 'h']);
    expect(compiled.tracks[1].notes.map((n) => n.note)).toEqual(['C2']);
  });

  it('should compile back to identical v1 notes for score with rests', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: null, duration: 'q' },
            { note: 'E4', duration: 'q' },
            { note: null, duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    const compiled = V2Compiler.compile(v2);

    expect(compiled.tracks[0].notes.map((n) => n.note)).toEqual(['C4', null, 'E4', null]);
  });

  // ============ Validation ============

  it('should produce a score that passes ScoreV2Validator', () => {
    const v1 = createV1Score({
      tracks: [
        { timbre: 'lead', notes: [{ note: 'C4', duration: 'q' }] },
        { timbre: 'bass', notes: [{ note: 'C2', duration: 'w' }] },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    const result = validateScoreV2(v2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ============ Hero's March 迁移 ============

  it('should convert hero-march.json to valid v2', () => {
    const fs = require('fs');
    const v1 = JSON.parse(fs.readFileSync('scores/hero-march.json', 'utf8'));
    const v2 = V1ToV2Converter.convert(v1);
    const result = validateScoreV2(v2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should round-trip hero-march with identical notes', () => {
    const fs = require('fs');
    const v1: Score = JSON.parse(fs.readFileSync('scores/hero-march.json', 'utf8'));
    const v2 = V1ToV2Converter.convert(v1);
    const compiled = V2Compiler.compile(v2);

    expect(compiled.tracks).toHaveLength(v1.tracks.length);

    for (let i = 0; i < v1.tracks.length; i++) {
      const orig = v1.tracks[i];
      const comp = compiled.tracks[i];

      expect(comp.notes).toHaveLength(orig.notes.length);
      expect(comp.notes.map((n) => n.note)).toEqual(orig.notes.map((n) => n.note));
      expect(comp.notes.map((n) => n.duration)).toEqual(orig.notes.map((n) => n.duration));
    }
  });

  it('should compress hero-march to under 60% of v1 size', () => {
    const fs = require('fs');
    const v1 = JSON.parse(fs.readFileSync('scores/hero-march.json', 'utf8'));
    const v2 = V1ToV2Converter.convert(v1);

    const v1Size = JSON.stringify(v1).length;
    const v2Size = JSON.stringify(v2).length;

    expect(v2Size / v1Size).toBeLessThan(0.6);
  });

  it('should detect drum patterns in hero-march', () => {
    const fs = require('fs');
    const v1 = JSON.parse(fs.readFileSync('scores/hero-march.json', 'utf8'));
    const v2 = V1ToV2Converter.convert(v1);

    expect(v2.patterns).toBeDefined();
    const patternNames = Object.keys(v2.patterns!);

    // Should have patterns for kick, snare, hihat
    const hasKickPattern = patternNames.some((n) => n.startsWith('kick_'));
    const hasSnarePattern = patternNames.some((n) => n.startsWith('snare_'));
    const hasHihatPattern = patternNames.some((n) => n.startsWith('hihat_'));

    expect(hasKickPattern).toBe(true);
    expect(hasSnarePattern).toBe(true);
    expect(hasHihatPattern).toBe(true);
  });

  // ============ Track / Performance 转换 ============

  it('should assign unique names to tracks with duplicate timbres', () => {
    const v1 = createV1Score({
      tracks: [
        { timbre: 'lead', notes: [] },
        { timbre: 'lead', notes: [] },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    expect(v2.tracks[0].name).toBe('lead');
    expect(v2.tracks[1].name).toBe('lead_2');
  });

  it('should convert performance parameters', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          performance: {
            swing: 0.3,
            humanize: 0.1,
            layback: 20,
            velocityCurve: [
              [0, 0.5],
              [10, 0.8],
              [20, 0.5],
            ],
          },
          notes: [
            { note: 'C4', duration: 'q' },
            { note: 'D4', duration: 'q' },
            { note: 'E4', duration: 'q' },
            { note: 'F4', duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    const perf = v2.tracks[0].perf;

    expect(perf?.swing).toBe(0.3);
    expect(perf?.humanize).toBe(0.1);
    expect(perf?.layback).toBe(20);
    expect(perf?.velocity).toBeDefined();
    expect(perf?.velocity?.curve).toBe('linear');
    expect(perf?.velocity?.points).toEqual([
      [0, 0.5],
      [0.5, 0.8],
      [1, 0.5],
    ]);
  });

  it('should detect all-silence bars and use silence flag', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: null, duration: 'q' },
            { note: null, duration: 'h' },
          ],
        },
        {
          timbre: 'bass',
          notes: [
            { note: null, duration: 'w' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    // Bar 1: lead has C4 q + R q + R h = 4 beats, bass has R w = 4 beats
    // Not all silence because lead has C4
    // Bar 2: would only exist if there are more notes
    expect(v2.score.every((bar) => !bar.silence)).toBe(true);

    // Now create a score where a bar is all rests
    const v1AllRest = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: null, duration: 'q' },
            { note: null, duration: 'h' },
            { note: null, duration: 'w' },
          ],
        },
        {
          timbre: 'bass',
          notes: [
            { note: 'C2', duration: 'q' },
            { note: null, duration: 'q' },
            { note: null, duration: 'h' },
            { note: null, duration: 'w' },
          ],
        },
      ],
    });
    const v2AllRest = V1ToV2Converter.convert(v1AllRest);
    const silenceBar = v2AllRest.score.find((bar) => bar.silence);
    expect(silenceBar).toBeDefined();
  });

  it('should auto-detect chapters based on density', () => {
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            // High density section (8 bars)
            ...Array.from({ length: 8 * 4 }, (_, i) => ({ note: 'C4', duration: 'q' as const })),
            // Low density section (8 bars)
            ...Array.from({ length: 8 }, () => ({ note: 'C4', duration: 'w' as const })),
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1);
    expect(v2.chapters.length).toBeGreaterThanOrEqual(1);
    const totalBars = v2.chapters.reduce((sum, ch) => sum + ch.bars, 0);
    expect(totalBars).toBe(16);
  });

  it('should handle manual chapter override', () => {
    const chapters: Chapter[] = [
      { id: 'intro', bars: 1 },
      { id: 'main', bars: 1 },
    ];
    const v1 = createV1Score({
      tracks: [
        {
          timbre: 'lead',
          notes: [
            { note: 'C4', duration: 'q' },
            { note: 'D4', duration: 'q' },
            { note: 'E4', duration: 'q' },
            { note: 'F4', duration: 'q' },
            { note: 'G4', duration: 'q' },
            { note: 'A4', duration: 'q' },
            { note: 'B4', duration: 'q' },
            { note: 'C5', duration: 'q' },
          ],
        },
      ],
    });
    const v2 = V1ToV2Converter.convert(v1, { chapters });
    expect(v2.chapters).toEqual(chapters);
    expect(v2.score).toHaveLength(2);
    expect(v2.score[0].chapter).toBe('intro');
    expect(v2.score[0].bar).toBe(1);
    expect(v2.score[1].chapter).toBe('main');
    expect(v2.score[1].bar).toBe(1);
  });
});
