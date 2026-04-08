/** Filler / hedge words for technical interview coaching */
const FILLER_PATTERNS: RegExp[] = [
  /\b(uh|um|er|erm)\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
];

export interface VocalMetrics {
  filler_count_session: number;
  filler_count_segment: number;
  words_per_minute: number;
  wpm_status: 'slow' | 'ideal' | 'fast';
  silence_seconds: number;
}

export function countFillerInText(text: string): number {
  let n = 0;
  const seen = new Set<string>();
  for (const p of FILLER_PATTERNS) {
    p.lastIndex = 0;
    let m: RegExpExecArray | null;
    const pat = new RegExp(p.source, p.flags);
    while ((m = pat.exec(text)) !== null) {
      const key = `${m.index}:${m[0]}`;
      if (!seen.has(key)) {
        seen.add(key);
        n += 1;
      }
    }
  }
  return n;
}

/** Rolling WPM from user segments in the last 60s */
export function computeRollingWpm(
  window: Array<{ at: number; words: number }>,
  now: number,
): number {
  const cutoff = now - 60_000;
  const slice = window.filter((x) => x.at >= cutoff);
  if (slice.length === 0) return 0;
  const totalWords = slice.reduce((s, x) => s + x.words, 0);
  const oldest = Math.min(...slice.map((x) => x.at));
  const spanMin = Math.max((now - oldest) / 60_000, 0.25);
  return totalWords / spanMin;
}

export function wpmStatus(wpm: number): 'slow' | 'ideal' | 'fast' {
  if (wpm <= 0) return 'ideal';
  if (wpm < 120) return 'slow';
  if (wpm > 160) return 'fast';
  return 'ideal';
}
