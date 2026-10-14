/*
 * The one date helper the initial chunk needs: today's local `YYYY-MM-DD`, which the timer
 * sends as its work date. Apart from `week.ts`, which re-exports it, so starting a timer from
 * the header does not put week arithmetic on every first paint. Why local parts and never
 * `toISOString()` is explained at the top of `week.ts`.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for the local calendar day of `date` — the API's `work_date`. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
