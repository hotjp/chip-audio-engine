import { describe, it, expect } from 'vitest';
import { validateScoreV2 } from '../src/music/ScoreV2Validator.js';
import type { ScoreV2 } from '../src/engine/types-v2.js';

function createMinimalScore(overrides?: Partial<ScoreV2>): Record<string, unknown> {
  const base: ScoreV2 = {
    $schema: 'cae-score-v2',
    meta: {
      $schema: 'cae-score-v2',
      title: 'Test',
      bpm: 120,
      timeSignature: [4, 4],
      timbrePack: 'test-pack',
    },
    tracks: [
      { name: 'lead', timbre: 'lead' },
    ],
    chapters: [
      { id: 'intro', bars: 4 },
    ],
    score: [
      { chapter: 'intro', bar: 1 },
    ],
  };
  return { ...base, ...overrides } as Record<string, unknown>;
}

describe('ScoreV2Validator', () => {
  // ============ 基础结构校验 ============

  it('should accept valid minimal score', () => {
    const result = validateScoreV2(createMinimalScore());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object input', () => {
    const result = validateScoreV2(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Score must be an object');
  });

  it('should reject wrong $schema', () => {
    const score = createMinimalScore();
    score.$schema = 'cae-score-v1';
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === '$schema')).toBe(true);
  });

  // ============ Meta 校验 ============

  it('should reject missing meta.title', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).title = '';
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.title')).toBe(true);
  });

  it('should reject bpm below 20', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).bpm = 10;
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.bpm')).toBe(true);
  });

  it('should reject bpm above 300', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).bpm = 400;
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.bpm')).toBe(true);
  });

  it('should reject invalid timeSignature', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).timeSignature = [4];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.timeSignature')).toBe(true);
  });

  it('should reject non-positive timeSignature parts', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).timeSignature = [0, 4];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.timeSignature')).toBe(true);
  });

  it('should reject invalid complexity', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).complexity = 'extreme';
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'meta.complexity')).toBe(true);
  });

  it('should accept valid complexity', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).complexity = 'extended';
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  // ============ Tracks 校验 ============

  it('should reject duplicate track names', () => {
    const score = createMinimalScore();
    score.tracks = [
      { name: 'lead', timbre: 'lead' },
      { name: 'lead', timbre: 'bass' },
    ];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate track name'))).toBe(true);
  });

  it('should reject empty timbre', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: '' }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].timbre')).toBe(true);
  });

  it('should reject track volume out of range', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: 'lead', volume: 1.5 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].volume')).toBe(true);
  });

  it('should reject non-boolean mute', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: 'lead', mute: 'yes' }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].mute')).toBe(true);
  });

  // ============ Performance / Velocity 校验 ============

  it('should reject invalid humanize range', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: 'lead', perf: { humanize: 1.5 } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].perf.humanize')).toBe(true);
  });

  it('should reject invalid velocity curve type', () => {
    const score = createMinimalScore();
    score.tracks = [{
      name: 'lead',
      timbre: 'lead',
      perf: { velocity: { curve: 'bezier', points: [['intro:start', 0.5]] } },
    }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].perf.velocity.curve')).toBe(true);
  });

  it('should reject invalid velocity anchor string', () => {
    const score = createMinimalScore();
    score.tracks = [{
      name: 'lead',
      timbre: 'lead',
      perf: { velocity: { curve: 'linear', points: [['bad-anchor', 0.5]] } },
    }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].perf.velocity.points[0][0]')).toBe(true);
  });

  it('should reject velocity value out of range', () => {
    const score = createMinimalScore();
    score.tracks = [{
      name: 'lead',
      timbre: 'lead',
      perf: { velocity: { curve: 'linear', points: [['intro:start', 1.5]] } },
    }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks[0].perf.velocity.points[0][1]')).toBe(true);
  });

  it('should accept valid percentage anchor', () => {
    const score = createMinimalScore();
    score.tracks = [{
      name: 'lead',
      timbre: 'lead',
      perf: { velocity: { curve: 'linear', points: [[0, 0.3], [0.5, 0.8], [1, 0.2]] } },
    }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  it('should accept valid chapter:position anchor', () => {
    const score = createMinimalScore();
    score.tracks = [{
      name: 'lead',
      timbre: 'lead',
      perf: { velocity: { curve: 'step', points: [['intro:start', 0.3], ['intro:mid', 0.6], ['intro:end', 0.2], ['intro:2', 0.5]] } },
    }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  // ============ Chapters 校验 ============

  it('should reject duplicate chapter ids', () => {
    const score = createMinimalScore();
    score.chapters = [
      { id: 'intro', bars: 4 },
      { id: 'intro', bars: 8 },
    ];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate chapter id'))).toBe(true);
  });

  it('should reject non-positive bars', () => {
    const score = createMinimalScore();
    score.chapters = [{ id: 'intro', bars: 0 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'chapters[0].bars')).toBe(true);
  });

  it('should reject negative transition', () => {
    const score = createMinimalScore();
    score.chapters = [{ id: 'intro', bars: 4, transition: -1 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'chapters[0].transition')).toBe(true);
  });

  // ============ Score Bars 校验 ============

  it('should reject bar referencing non-existent chapter', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'missing', bar: 1 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
  });

  it('should reject bar number out of chapter range', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 5 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].bar')).toBe(true);
  });

  it('should reject ref out of chapter range', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, ref: 5 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].ref')).toBe(true);
  });

  it('should accept valid ref within chapter', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 2, ref: 1 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  // ============ Blend 校验 ============

  it('should reject blend referencing non-existent chapter', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, blend: { next: 'missing', weight: 0.3 } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].blend.next')).toBe(true);
  });

  it('should reject blend weight out of range', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, blend: { next: 'intro', weight: 1.5 } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].blend.weight')).toBe(true);
  });

  // ============ Pattern 校验 ============

  it('should reject pattern reference to non-existent pattern', () => {
    const score = createMinimalScore();
    score.patterns = {};
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: '$missing.lead' } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Pattern "missing" does not exist'))).toBe(true);
  });

  it('should accept valid string pattern reference', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: 'lead' }];
    score.patterns = { motif: { lead: [['C4', 'q', 1]] } };
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: '$motif.lead' } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  it('should accept valid PatternRef object', () => {
    const score = createMinimalScore();
    score.tracks = [{ name: 'lead', timbre: 'lead' }];
    score.patterns = { motif: { lead: [['C4', 'q', 1]] } };
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', transpose: 5, velocity: 0.8 } } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid PatternRef $ref format', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: { $ref: 'badref' } } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].t.lead.$ref')).toBe(true);
  });

  it('should reject PatternRef velocity out of range', () => {
    const score = createMinimalScore();
    score.patterns = { motif: { lead: [['C4', 'q', 1]] } };
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: { $ref: 'motif.lead', velocity: 2 } } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].t.lead.velocity')).toBe(true);
  });

  // ============ NoteTuple 校验 ============

  it('should reject invalid note format', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: [['H3', 'q', 1]] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].t.lead[0][0]')).toBe(true);
  });

  it('should accept rest note "R"', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: [['R', 'q', 2]] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid duration symbol', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: [['C4', 'x', 1]] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].t.lead[0][1]')).toBe(true);
  });

  it('should reject NoteTuple with too many elements', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: [['C4', 'q', 1, 'extra']] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'score[0].t.lead[0]')).toBe(true);
  });

  it('should accept NoteTuple without beat', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { lead: [['C4', 'q']] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
  });

  // ============ Track 声明校验 ============

  it('should reject undeclared track in bar', () => {
    const score = createMinimalScore();
    score.score = [{ chapter: 'intro', bar: 1, t: { bass: [['C2', 'w', 1]] } }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Track "bass" is not declared'))).toBe(true);
  });

  // ============ 综合场景 ============

  it('should validate full score with multiple tracks, chapters, patterns', () => {
    const score: ScoreV2 = {
      $schema: 'cae-score-v2',
      meta: {
        $schema: 'cae-score-v2',
        title: 'Hero\'s March',
        bpm: 130,
        timeSignature: [4, 4],
        timbrePack: '16bit-sfc',
        complexity: 'standard',
        duration: '2:00',
      },
      tracks: [
        { name: 'lead', timbre: 'lead', volume: 0.8 },
        { name: 'bass', timbre: 'bass', perf: { swing: 0.2 } },
        { name: 'kick', timbre: 'kick', mute: false },
      ],
      patterns: {
        'kick-std': {
          kick: [['C2', 'q', 1], ['R', 'q', 2], ['C2', 'q', 3], ['R', 'q', 4]],
        },
      },
      chapters: [
        { id: 'intro', bars: 6, transition: 2, mood: 'march' },
        { id: 'dev', bars: 8, transition: 2 },
      ],
      score: [
        { chapter: 'intro', bar: 1, t: { lead: [['G3', 'q', 1], ['G3', 'q', 2]] } },
        { chapter: 'intro', bar: 2, t: { kick: '$kick-std.kick' } },
        { chapter: 'intro', bar: 5, blend: { next: 'dev', weight: 0.3 }, t: { lead: [['G4', 'q', 1]] } },
        { chapter: 'dev', bar: 1, t: { lead: { $ref: 'kick-std.kick', transpose: 0 } } },
        { chapter: 'dev', bar: 2, ref: 1 },
        { chapter: 'dev', bar: 3, silence: true },
      ],
    };
    const result = validateScoreV2(score);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect multiple errors at once', () => {
    const score = createMinimalScore();
    (score.meta as Record<string, unknown>).bpm = 500;
    score.tracks = [
      { name: 'lead', timbre: '' },
      { name: 'lead', timbre: 'bass', volume: -1 },
    ];
    score.chapters = [{ id: 'intro', bars: -1 }];
    score.score = [{ chapter: 'intro', bar: 99 }];
    const result = validateScoreV2(score);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
