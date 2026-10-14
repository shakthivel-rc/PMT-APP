/*
 * Durations as people read them. The API speaks whole seconds; people speak "1h 30m". Typing
 * them in is `durationParse.ts`, kept apart so the parser stays out of the initial chunk. Hand-written rather than `Intl.DurationFormat`, which is Baseline only since
 * March 2025 — later than the browsers this app still builds for (see client.ts) — and which
 * jsdom happens to have, so a test would never notice it missing in a real browser.
 */

/** The API's ceiling for one entry: a day (`MAX_ENTRY_SECONDS` in pmt-api). */
export const MAX_ENTRY_SECONDS = 24 * 60 * 60;

/**
 * Seconds for reading: `3h 20m`, `45m`, `2h`, and `40s` under a minute so a short timer is not
 * shown as nothing. Hours are not folded into days: "1d" means 8 hours in one workspace and
 * 7.5 in another, and a total should read the same to everyone.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds === 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** A running timer's face: `0:05:09`, `12:00:00`. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/** The text an edit field starts from: `formatDuration`, minus the seconds it rounds away. */
export function durationInput(totalSeconds: number): string {
  return totalSeconds < 60 ? `${Math.max(0, Math.round(totalSeconds))}s` : formatDuration(totalSeconds);
}
