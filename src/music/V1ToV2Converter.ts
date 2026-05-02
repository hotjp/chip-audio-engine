import type { Score, ScoreTrack, ScoreNote, PerformanceExpr } from '../engine/types.js';
import type {
  ScoreV2,
  ScoreV2Track,
  Chapter,
  Bar,
  PatternDef,
  NoteTuple,
  Performance,
} from '../engine/types-v2.js';

export interface ConvertOptions {
  beatsPerBar?: number;
  timeSignature?: [number, number];
  chapters?: Chapter[];
  complexity?: 'minimal' | 'standard' | 'extended';
  duration?: string;
  minPatternRepeats?: number;
}

interface TrackBar {
  notes: ScoreNote[];
  beats: number;
}

interface PatternInfo {
  name: string;
  tuples: NoteTuple[];
  count: number;
}

/**
 * v1 Score → v2 ScoreV2 转换器。
 *
 * 将扁平的 v1 音符序列转换为 v2 的小节网格、pattern 引用和 velocity 曲线。
 */
export class V1ToV2Converter {
  /**
   * 转换 v1 Score 为 v2 ScoreV2。
   */
  static convert(score: Score, options: ConvertOptions = {}): ScoreV2 {
    const beatsPerBar = options.beatsPerBar ?? 4;
    const timeSignature = options.timeSignature ?? [beatsPerBar, 4];
    const minPatternRepeats = options.minPatternRepeats ?? 3;

    // 1. 分配 track 名称
    const trackNames = this.assignTrackNames(score.tracks);

    // 2. 切分小节
    const trackBars: TrackBar[][] = score.tracks.map((t) =>
      this.splitIntoBars(t.notes, beatsPerBar),
    );

    // 3. 统一小节数
    const maxBars = Math.max(...trackBars.map((b) => b.length));
    this.equalizeBarCounts(trackBars, maxBars);

    // 4. 检测重复 pattern
    const { patterns, patternMap } = this.detectPatterns(trackBars, trackNames, minPatternRepeats);

    // 5. 自动检测章节（如果未手动指定）
    const chapters = options.chapters ?? this.autoDetectChapters(trackBars, maxBars);

    // 6. 构建 v2 score bars
    const scoreBars = this.buildScoreBars(trackBars, trackNames, patternMap, chapters);

    // 7. 转换 track 声明
    const v2Tracks = this.convertTracks(score.tracks, trackNames);

    return {
      $schema: 'cae-score-v2',
      meta: {
        $schema: 'cae-score-v2',
        title: score.name,
        bpm: score.bpm,
        timeSignature,
        timbrePack: score.timbrePack,
        complexity: options.complexity,
        duration: options.duration,
      },
      tracks: v2Tracks,
      patterns: Object.keys(patterns).length > 0 ? patterns : undefined,
      chapters,
      score: scoreBars,
    };
  }

  // ------------------------------------------------------------------
  // Track naming
  // ------------------------------------------------------------------

  private static assignTrackNames(tracks: ScoreTrack[]): string[] {
    const counts = new Map<string, number>();
    return tracks.map((t) => {
      const base = t.timbre;
      const count = (counts.get(base) ?? 0) + 1;
      counts.set(base, count);
      return count === 1 ? base : `${base}_${count}`;
    });
  }

  // ------------------------------------------------------------------
  // Bar splitting
  // ------------------------------------------------------------------

  private static splitIntoBars(notes: ScoreNote[], beatsPerBar: number): TrackBar[] {
    const bars: TrackBar[] = [];
    let currentNotes: ScoreNote[] = [];
    let currentBeats = 0;

    for (const note of notes) {
      const beats = this.durationToBeats(note.duration);

      if (currentBeats + beats > beatsPerBar + 1e-9 && currentNotes.length > 0) {
        // 当前 note 会溢出，先结束当前 bar
        bars.push({ notes: currentNotes, beats: currentBeats });
        currentNotes = [note];
        currentBeats = beats;
      } else {
        currentNotes.push(note);
        currentBeats += beats;
      }

      if (Math.abs(currentBeats - beatsPerBar) < 1e-9) {
        bars.push({ notes: currentNotes, beats: currentBeats });
        currentNotes = [];
        currentBeats = 0;
      }
    }

    if (currentNotes.length > 0) {
      bars.push({ notes: currentNotes, beats: currentBeats });
    }

    return bars;
  }

  private static durationToBeats(duration: string | number): number {
    if (typeof duration === 'number') {
      // 数值时长（毫秒），无法精确映射到拍数，按 120 BPM 近似
      return duration / 500;
    }
    const map: Record<string, number> = {
      w: 4,
      'w.': 6,
      h: 2,
      'h.': 3,
      q: 1,
      'q.': 1.5,
      e: 0.5,
      'e.': 0.75,
      s: 0.25,
      's.': 0.375,
      t: 0.125,
    };
    return map[duration] ?? 0;
  }

  // ------------------------------------------------------------------
  // Equalize bar counts
  // ------------------------------------------------------------------

  private static equalizeBarCounts(trackBars: TrackBar[][], maxBars: number): void {
    for (const bars of trackBars) {
      while (bars.length < maxBars) {
        const last = bars[bars.length - 1];
        if (last && last.beats < 4) {
          // 把最后一 bar 拆出一个全休止符来填充
          // 但为了保持总拍数不变，我们只添加一个空 bar 会让 V2Compiler 自动填充全休止符，
          // 这会改变总拍数。因此这里不自动填充，而是要求输入 score 已经对齐。
          // 对于 hero-march，splitIntoBars 已经让所有 track 得到相同的 bar 数。
          break;
        }
        bars.push({ notes: [{ note: null, duration: 'w' }], beats: 4 });
      }
    }
  }

  // ------------------------------------------------------------------
  // Pattern detection
  // ------------------------------------------------------------------

  private static detectPatterns(
    trackBars: TrackBar[][],
    trackNames: string[],
    minRepeats: number,
  ): {
    patterns: Record<string, PatternDef>;
    patternMap: Map<string, Map<string, string>>;
  } {
    const patterns: Record<string, PatternDef> = {};
    const patternMap = new Map<string, Map<string, string>>();

    trackBars.forEach((bars, trackIdx) => {
      const trackName = trackNames[trackIdx];
      const hashMap = new Map<string, PatternInfo>();

      bars.forEach((bar) => {
        const tuples = this.notesToTuples(bar.notes);
        const hash = JSON.stringify(tuples);
        const existing = hashMap.get(hash);
        if (existing) {
          existing.count++;
        } else {
          hashMap.set(hash, { name: '', tuples, count: 1 });
        }
      });

      const trackPatterns = new Map<string, string>();
      let patternIdx = 0;

      for (const [hash, info] of hashMap) {
        if (info.count >= minRepeats) {
          const patternName = `${trackName}_${patternIdx}`;
          patternIdx++;
          patterns[patternName] = { [trackName]: info.tuples };
          info.name = patternName;
          trackPatterns.set(hash, patternName);
        }
      }

      if (trackPatterns.size > 0) {
        patternMap.set(trackName, trackPatterns);
      }
    });

    return { patterns, patternMap };
  }

  private static notesToTuples(notes: ScoreNote[]): NoteTuple[] {
    return notes.map((n) => [n.note ?? 'R', n.duration as string] as NoteTuple);
  }

  // ------------------------------------------------------------------
  // Build score bars
  // ------------------------------------------------------------------

  private static buildScoreBars(
    trackBars: TrackBar[][],
    trackNames: string[],
    patternMap: Map<string, Map<string, string>>,
    chapters: Chapter[],
  ): Bar[] {
    const maxBars = trackBars[0]?.length ?? 0;
    const scoreBars: Bar[] = [];

    // 构建 chapter 到全局 bar 的映射
    const chapterStarts = new Map<string, number>();
    let globalIdx = 0;
    for (const ch of chapters) {
      chapterStarts.set(ch.id, globalIdx);
      globalIdx += ch.bars;
    }

    for (let g = 0; g < maxBars; g++) {
      // 找到该全局 bar 属于哪个 chapter
      let chapterId = '';
      let barInChapter = 0;
      let accumulated = 0;
      for (const ch of chapters) {
        if (g < accumulated + ch.bars) {
          chapterId = ch.id;
          barInChapter = g - accumulated + 1;
          break;
        }
        accumulated += ch.bars;
      }

      if (!chapterId) {
        chapterId = chapters[chapters.length - 1]?.id ?? 'main';
        barInChapter = g - accumulated + 1;
      }

      const t: Record<string, NoteTuple[] | string> = {};
      let allWholeRest = true;
      let hasAnyContent = false;

      for (let ti = 0; ti < trackNames.length; ti++) {
        const trackName = trackNames[ti];
        const bar = trackBars[ti][g];
        if (!bar || bar.notes.length === 0) {
          continue;
        }
        hasAnyContent = true;
        const tuples = this.notesToTuples(bar.notes);

        const isWholeRest = tuples.length === 1 && tuples[0][0] === 'R' && tuples[0][1] === 'w';
        if (!isWholeRest) {
          allWholeRest = false;
        }

        const trackPatterns = patternMap.get(trackName);
        const hash = JSON.stringify(tuples);
        const patternName = trackPatterns?.get(hash);

        if (patternName) {
          t[trackName] = `$${patternName}.${trackName}`;
        } else {
          t[trackName] = tuples;
        }
      }

      if (allWholeRest && hasAnyContent) {
        scoreBars.push({ chapter: chapterId, bar: barInChapter, silence: true });
      } else {
        scoreBars.push({ chapter: chapterId, bar: barInChapter, t });
      }
    }

    return scoreBars;
  }

  // ------------------------------------------------------------------
  // Chapter auto-detection
  // ------------------------------------------------------------------

  private static autoDetectChapters(trackBars: TrackBar[][], maxBars: number): Chapter[] {
    const densities: number[] = [];

    for (let i = 0; i < maxBars; i++) {
      let active = 0;
      for (const bars of trackBars) {
        const bar = bars[i];
        if (bar) {
          active += bar.notes.filter((n) => n.note !== null).length;
        }
      }
      densities.push(active);
    }

    // 4-bar 移动平均平滑
    const smoothed: number[] = [];
    for (let i = 0; i < densities.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(densities.length - 1, i + 1); j++) {
        sum += densities[j];
        count++;
      }
      smoothed.push(sum / count);
    }

    // 寻找显著变化点
    const breakpoints: number[] = [0];
    const threshold = 4;
    const minBars = 4;

    for (let i = 1; i < smoothed.length - 1; i++) {
      const diff = smoothed[i] - smoothed[i - 1];
      const nextDiff = smoothed[i + 1] - smoothed[i];

      const isSignificant =
        Math.abs(diff) > threshold ||
        (diff > 2 && nextDiff < -2) ||
        (diff < -2 && nextDiff > 2);

      if (isSignificant && i - breakpoints[breakpoints.length - 1] >= minBars) {
        breakpoints.push(i);
      }
    }
    breakpoints.push(maxBars);

    const moods = ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'outro'];

    return breakpoints.slice(0, -1).map((start, i) => ({
      id: moods[i] || `section${i}`,
      bars: breakpoints[i + 1] - start,
      transition: 0,
    }));
  }

  // ------------------------------------------------------------------
  // Track conversion
  // ------------------------------------------------------------------

  private static convertTracks(v1Tracks: ScoreTrack[], trackNames: string[]): ScoreV2Track[] {
    return v1Tracks.map((t, i) => {
      const perf = this.convertPerformance(t.performance);
      const track: ScoreV2Track = {
        name: trackNames[i],
        timbre: t.timbre,
      };
      if (t.volume !== undefined) track.volume = t.volume;
      if (t.mute !== undefined) track.mute = t.mute;
      if (perf) track.perf = perf;
      return track;
    });
  }

  private static convertPerformance(v1Perf?: PerformanceExpr): Performance | undefined {
    if (!v1Perf) return undefined;

    const perf: Performance = {};
    if (v1Perf.swing !== undefined) perf.swing = v1Perf.swing;
    if (v1Perf.humanize !== undefined) perf.humanize = v1Perf.humanize;
    if (v1Perf.layback !== undefined) perf.layback = v1Perf.layback;

    if (v1Perf.velocityCurve && v1Perf.velocityCurve.length > 0) {
      const maxIndex = Math.max(...v1Perf.velocityCurve.map((p) => p[0]));
      const points: [number | string, number][] = v1Perf.velocityCurve.map(([idx, val]) => [
        maxIndex > 0 ? idx / maxIndex : 0,
        val,
      ]);
      perf.velocity = {
        curve: 'linear',
        points,
      };
    }

    return Object.keys(perf).length > 0 ? perf : undefined;
  }
}
