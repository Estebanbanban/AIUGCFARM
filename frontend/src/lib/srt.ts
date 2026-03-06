/**
 * SRT subtitle file generator + word-level caption utilities.
 * Converts a sequence of text segments with durations into a valid .srt string
 * or an array of word cues for real-time overlay rendering.
 */

export interface WordCue {
  word: string;
  /** Absolute start time in seconds */
  start: number;
  /** Absolute end time in seconds */
  end: number;
}

/**
 * Split a text segment into per-word cues by distributing the total duration
 * evenly across all words. No AI or ASR required — timing is estimated.
 *
 * @param text        The caption text (one sentence / segment)
 * @param durationS   How long the segment plays, in seconds
 * @param offsetS     When the segment starts in global time (default 0)
 */
export function buildWordCues(
  text: string,
  durationS: number,
  offsetS = 0,
): WordCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const timePerWord = durationS / words.length;
  return words.map((word, i) => ({
    word,
    start: offsetS + i * timePerWord,
    end: offsetS + (i + 1) * timePerWord,
  }));
}

function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const msRem = ms % 1_000;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "," +
    String(msRem).padStart(3, "0")
  );
}

export interface SrtSegment {
  text: string;
  /** Duration of this segment in seconds (fractional allowed) */
  durationS: number;
}

/**
 * Generate a valid .srt string from an ordered list of text segments.
 * Segments with empty text are still timed but produce no cue.
 */
export function generateSrt(segments: SrtSegment[]): string {
  const cues: string[] = [];
  let cursorMs = 0;
  let cueIndex = 1;

  for (const { text, durationS } of segments) {
    const startMs = cursorMs;
    const endMs = cursorMs + Math.round(durationS * 1_000);
    cursorMs = endMs;

    const trimmed = text.trim();
    if (!trimmed) continue;

    cues.push(
      `${cueIndex}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n${trimmed}`,
    );
    cueIndex++;
  }

  return cues.join("\n\n") + "\n";
}
