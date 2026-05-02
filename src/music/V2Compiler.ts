import type {
  ScoreV2,
  ScoreV2Track,
  Chapter,
  Bar,
  BarTrackContent,
  NoteTuple,
  PatternDef,
  PatternRef,
  VelocityCurve,
} from '../engine/types-v2.js';
import type { Score, ScoreTrack, ScoreNote, DurationValue, PerformanceExpr } from '../engine/types.js';
import { MusicUtils } from './MusicUtils.js';
import { durationToBeats } from './DurationParser.js';

interface ChapterInfo {
  chapter: Chapter;
  startBar: number; // global bar index (0-based)
}

interface ResolvedBar {
  globalBar: number;
  bars: Bar[];
}

interface CompiledNote {
  note: string | null;
  duration: DurationValue;
  beat: number; // 0-based beat within bar, for velocity interpolation
  velocity?: number;
}

/**
 * Score v2 → v1 编译器。
 *
 * 将 v2 的小节网格、pattern 引用、velocity 曲线展开为 v1 的扁平格式，
 * 供现有 BGMEngine 直接播放。
 */
export class V2Compiler {
  /**
   * 编译 ScoreV2 为 v1 Score。
   */
  static compile(v2: ScoreV2): Score {
    const compiler = new V2Compiler(v2);
    return compiler._compile();
  }

  private v2: ScoreV2;
  private chapterMap: Map<string, ChapterInfo>;
  private totalBars: number;
  private beatsPerBar: number;

  constructor(v2?: ScoreV2) {
    this.v2 = v2 ?? null as any;
    this.chapterMap = v2 ? this.buildChapterMap() : new Map();
    this.totalBars = v2 ? this.computeTotalBars() : 0;
    this.beatsPerBar = v2 ? v2.meta.timeSignature[0] : 4;
  }

  /**
   * 实例方法：编译 ScoreV2 为 v1 Score。
   */
  compile(v2: ScoreV2): Score {
    return V2Compiler.compile(v2);
  }

  private _compile(): Score {
    const resolvedBars = this.resolveBars();
    const trackNotes = this.compileTracks(resolvedBars);
    const tracks: ScoreTrack[] = this.v2.tracks.map((t) => {
      const notes = trackNotes.get(t.name) ?? [];
      const perf = this.buildPerformance(t);
      return {
        timbre: t.timbre,
        volume: t.volume,
        mute: t.mute,
        performance: perf,
        notes,
      };
    });

    return {
      id: this.sanitizeId(this.v2.meta.title),
      name: this.v2.meta.title,
      bpm: this.v2.meta.bpm,
      timbrePack: this.v2.meta.timbrePack,
      tracks,
    };
  }

  // ------------------------------------------------------------------
  // Chapter / global bar layout
  // ------------------------------------------------------------------

  private buildChapterMap(): Map<string, ChapterInfo> {
    const map = new Map<string, ChapterInfo>();
    let startBar = 0;
    for (const ch of this.v2.chapters) {
      map.set(ch.id, { chapter: ch, startBar });
      startBar += Math.max(0, ch.bars - (ch.transition ?? 0));
    }
    return map;
  }

  private computeTotalBars(): number {
    const last = this.v2.chapters[this.v2.chapters.length - 1];
    if (!last) return 0;
    const info = this.chapterMap.get(last.id);
    return (info?.startBar ?? 0) + last.bars;
  }

  private getGlobalBar(chapterId: string, bar: number): number {
    const info = this.chapterMap.get(chapterId);
    if (!info) throw new Error(`Chapter "${chapterId}" not found`);
    return info.startBar + bar - 1;
  }

  // ------------------------------------------------------------------
  // Bar resolution (ref, override, silence, global grouping)
  // ------------------------------------------------------------------

  private resolveBars(): ResolvedBar[] {
    // Group v2 bars by global bar position
    const byGlobal = new Map<number, Bar[]>();
    for (const bar of this.v2.score) {
      const gb = this.getGlobalBar(bar.chapter, bar.bar);
      const list = byGlobal.get(gb) ?? [];
      list.push(bar);
      byGlobal.set(gb, list);
    }

    // Ensure every global bar is represented (fill gaps with silence)
    const result: ResolvedBar[] = [];
    for (let gb = 0; gb < this.totalBars; gb++) {
      const bars = byGlobal.get(gb);
      if (bars && bars.length > 0) {
        result.push({ globalBar: gb, bars });
      } else {
        // Missing global bar → treat as silence for all tracks
        result.push({ globalBar: gb, bars: [{ chapter: this.v2.chapters[0]?.id ?? '', bar: gb + 1, silence: true }] });
      }
    }
    return result;
  }

  // ------------------------------------------------------------------
  // Track compilation
  // ------------------------------------------------------------------

  private compileTracks(resolvedBars: ResolvedBar[]): Map<string, ScoreNote[]> {
    const trackMap = new Map<string, ScoreNote[]>();
    for (const t of this.v2.tracks) {
      trackMap.set(t.name, []);
    }

    for (const rb of resolvedBars) {
      for (const t of this.v2.tracks) {
        const compiled = this.compileTrackBar(t.name, rb);
        const list = trackMap.get(t.name)!;
        list.push(...compiled);
      }
    }

    // Apply velocity curves per track after all notes are laid out
    for (const t of this.v2.tracks) {
      if (t.perf?.velocity) {
        const notes = trackMap.get(t.name)!;
        this.applyVelocityCurve(t, notes);
      }
    }

    return trackMap;
  }

  private compileTrackBar(trackName: string, rb: ResolvedBar): ScoreNote[] {
    const allTuples: NoteTuple[] = [];

    for (const bar of rb.bars) {
      const content = this.resolveTrackContent(trackName, bar);
      if (content) {
        const tuples = this.expandContent(content);
        allTuples.push(...tuples);
      }
    }

    if (allTuples.length === 0) {
      // No content → whole rest for the bar
      return [{ note: null, duration: this.barRestDuration() }];
    }

    return this.tuplesToSequential(allTuples);
  }

  private resolveTrackContent(trackName: string, bar: Bar): BarTrackContent | undefined {
    // silence takes precedence
    if (bar.silence) {
      return undefined; // will be treated as empty → rest
    }

    let content: BarTrackContent | undefined;

    if (bar.ref !== undefined) {
      // Look up referenced bar in the same chapter
      const refBar = this.findBarInChapter(bar.chapter, bar.ref);
      if (refBar) {
        content = this.resolveTrackContentDirect(trackName, refBar);
      }
    }

    if (bar.override && trackName in bar.override) {
      content = bar.override[trackName];
    } else if (bar.t && trackName in bar.t) {
      content = bar.t[trackName];
    }

    return content;
  }

  private resolveTrackContentDirect(trackName: string, bar: Bar): BarTrackContent | undefined {
    if (bar.silence) return undefined;
    if (bar.t && trackName in bar.t) return bar.t[trackName];
    if (bar.ref !== undefined) {
      const refBar = this.findBarInChapter(bar.chapter, bar.ref);
      if (refBar) return this.resolveTrackContentDirect(trackName, refBar);
    }
    return undefined;
  }

  private findBarInChapter(chapterId: string, barNumber: number): Bar | undefined {
    return this.v2.score.find((b) => b.chapter === chapterId && b.bar === barNumber);
  }

  // ------------------------------------------------------------------
  // Pattern expansion
  // ------------------------------------------------------------------

  private expandContent(content: BarTrackContent): NoteTuple[] {
    if (typeof content === 'string') {
      return this.expandStringPattern(content);
    }
    if (Array.isArray(content)) {
      return content;
    }
    // PatternRef object
    return this.expandPatternRef(content);
  }

  private expandStringPattern(ref: string): NoteTuple[] {
    if (!ref.startsWith('$')) {
      throw new Error(`Invalid pattern reference: ${ref}`);
    }
    const path = ref.slice(1); // remove '$'
    return this.lookupPattern(path);
  }

  private expandPatternRef(ref: PatternRef): NoteTuple[] {
    const tuples = this.lookupPattern(ref.$ref);
    return tuples.map((t) => {
      const [note, dur, beat] = t;
      let newNote = note;
      if (ref.transpose && note !== 'R') {
        newNote = MusicUtils.transpose(note, ref.transpose);
      }
      const out: NoteTuple = [newNote, dur, beat];
      return out;
    });
  }

  private lookupPattern(path: string): NoteTuple[] {
    const parts = path.split('.');
    if (parts.length !== 2) {
      throw new Error(`Pattern reference must be "patternName.trackName", got: ${path}`);
    }
    const [patternName, trackName] = parts;
    const pattern = this.v2.patterns?.[patternName];
    if (!pattern) {
      throw new Error(`Pattern "${patternName}" not found`);
    }
    const tuples = pattern[trackName];
    if (!tuples) {
      throw new Error(`Track "${trackName}" not found in pattern "${patternName}"`);
    }
    return tuples;
  }

  // ------------------------------------------------------------------
  // Beat → sequential conversion
  // ------------------------------------------------------------------

  private tuplesToSequential(tuples: NoteTuple[]): ScoreNote[] {
    // Parse and optionally infer beats
    type Item = { note: string; duration: DurationValue; beat?: number };
    const items: Item[] = tuples.map((t) => ({
      note: t[0],
      duration: t[1] as DurationValue,
      beat: t[2] !== undefined ? this.parseBeat(t[2]) : undefined,
    }));

    const hasBeats = items.some((i) => i.beat !== undefined);

    if (hasBeats) {
      // Infer missing beats sequentially
      let currentBeat = 1;
      for (const item of items) {
        if (item.beat === undefined) {
          item.beat = currentBeat;
        }
        currentBeat = item.beat + durationToBeats(item.duration);
      }
      items.sort((a, b) => a.beat! - b.beat!);

      return this.positionedToSequential(items as { note: string; duration: DurationValue; beat: number }[]);
    }

    // Pure sequential: no gaps to fill
    return items.map((i) => ({
      note: i.note === 'R' ? null : i.note,
      duration: i.duration,
    }));
  }

  private parseBeat(beat: string | number): number {
    if (typeof beat === 'number') return beat;
    if (typeof beat === 'string' && beat.includes('-')) {
      const start = beat.split('-')[0];
      return parseFloat(start);
    }
    return parseFloat(beat);
  }

  private positionedToSequential(items: { note: string; duration: DurationValue; beat: number }[]): ScoreNote[] {
    const result: ScoreNote[] = [];
    let currentBeat = 1;
    const barEnd = 1 + this.beatsPerBar;

    for (const item of items) {
      if (item.beat > currentBeat) {
        // Fill gap with rests
        const gapBeats = item.beat - currentBeat;
        result.push(...this.beatsToRests(gapBeats));
        currentBeat = item.beat;
      }
      // If item.beat < currentBeat, overlap or duplicate — just append (sequential engine limitation)
      result.push({
        note: item.note === 'R' ? null : item.note,
        duration: item.duration,
      });
      currentBeat += durationToBeats(item.duration);
    }

    // Fill trailing gap to end of bar
    if (currentBeat < barEnd) {
      const gapBeats = barEnd - currentBeat;
      result.push(...this.beatsToRests(gapBeats));
    }

    return result;
  }

  private beatsToRests(beats: number): ScoreNote[] {
    // Break into standard durations, preferring longer values
    const result: ScoreNote[] = [];
    const symbols: [number, DurationValue][] = [
      [4, 'w'],
      [3, 'h.'],
      [2, 'h'],
      [1.5, 'q.'],
      [1, 'q'],
      [0.75, 'e.'],
      [0.5, 'e'],
      [0.375, 's.'],
      [0.25, 's'],
      [0.125, 't'],
    ];

    let remaining = beats;
    for (const [val, sym] of symbols) {
      while (remaining >= val - 1e-9) {
        result.push({ note: null, duration: sym });
        remaining -= val;
      }
    }

    // If there's a tiny remainder due to float math, absorb with last rest or add a 32nd rest
    if (remaining > 1e-9) {
      result.push({ note: null, duration: 't' });
    }

    return result;
  }

  private barRestDuration(): DurationValue {
    const beats = this.beatsPerBar;
    if (beats === 4) return 'w';
    if (beats === 3) return 'h.';
    if (beats === 2) return 'h';
    if (beats === 1) return 'q';
    // Fallback: return numeric ms
    return MusicUtils.durationToMs('q', this.v2.meta.bpm) * beats;
  }

  // ------------------------------------------------------------------
  // Velocity curve application
  // ------------------------------------------------------------------

  private applyVelocityCurve(track: ScoreV2Track, notes: ScoreNote[]): void {
    const curve = track.perf!.velocity!;
    if (!curve || curve.points.length < 1) return;

    const anchors = this.resolveAnchors(curve);
    if (anchors.length === 0) return;

    // Compute per-note global bar position for interpolation
    let globalBar = 0;
    let barRemaining = this.beatsPerBar;

    for (const note of notes) {
      const noteBeats = durationToBeats(note.duration);
      const noteStartBeat = this.beatsPerBar - barRemaining; // 0-based within current bar
      const normalizedPos = (globalBar + noteStartBeat / this.beatsPerBar) / Math.max(1, this.totalBars);

      const multiplier = this.interpolate(anchors, normalizedPos, curve.curve);
      note.velocity = (note.velocity ?? 1) * multiplier;

      barRemaining -= noteBeats;
      if (barRemaining <= 1e-9) {
        globalBar++;
        barRemaining = this.beatsPerBar;
      }
    }
  }

  private resolveAnchors(curve: VelocityCurve): [number, number][] {
    return curve.points.map(([anchor, value]) => {
      const pos = this.resolveAnchor(anchor);
      return [pos, value] as [number, number];
    }).sort((a, b) => a[0] - b[0]);
  }

  private resolveAnchor(anchor: string | number): number {
    if (typeof anchor === 'number') {
      // Percentage 0-1 across entire score
      return Math.max(0, Math.min(1, anchor));
    }
    const parts = anchor.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid velocity anchor: ${anchor}`);
    }
    const [chapterId, position] = parts;
    const info = this.chapterMap.get(chapterId);
    if (!info) {
      throw new Error(`Velocity anchor references unknown chapter: ${chapterId}`);
    }
    const ch = info.chapter;
    const total = Math.max(1, this.totalBars);

    let barOffset: number;
    switch (position) {
      case 'start':
        barOffset = 0;
        break;
      case 'end':
        barOffset = ch.bars;
        break;
      case 'mid':
        barOffset = ch.bars / 2;
        break;
      default: {
        const n = parseFloat(position);
        if (isNaN(n)) {
          throw new Error(`Invalid velocity anchor position: ${position}`);
        }
        barOffset = n - 1; // 1-based bar number → 0-based offset
        break;
      }
    }

    const globalBar = info.startBar + barOffset;
    return Math.max(0, Math.min(1, globalBar / total));
  }

  private interpolate(anchors: [number, number][], x: number, type: 'linear' | 'step'): number {
    if (anchors.length === 0) return 1;
    if (anchors.length === 1) return anchors[0][1];

    if (x <= anchors[0][0]) return anchors[0][1];
    const last = anchors[anchors.length - 1];
    if (x >= last[0]) return last[1];

    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (x >= a[0] && x <= b[0]) {
        if (type === 'step') return a[1];
        const t = (x - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return last[1];
  }

  // ------------------------------------------------------------------
  // Performance / helpers
  // ------------------------------------------------------------------

  private buildPerformance(track: ScoreV2Track): PerformanceExpr | undefined {
    const perf = track.perf;
    if (!perf) return undefined;
    const out: PerformanceExpr = {};
    if (perf.swing !== undefined) out.swing = perf.swing;
    if (perf.humanize !== undefined) out.humanize = perf.humanize;
    if (perf.layback !== undefined) out.layback = perf.layback;
    // velocity curve is expanded into per-note velocity, not kept here
    return out;
  }

  private sanitizeId(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'score';
  }
}
