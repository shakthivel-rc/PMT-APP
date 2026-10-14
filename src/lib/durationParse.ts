/*
 * Durations as people type them, read into the API's whole seconds. Apart from the formatters
 * in `duration.ts` because those ride in the initial chunk (the header's timer shows a clock),
 * and this parser — aliases, patterns and all — is only ever needed by lazy screens. A module
 * shared with the initial chunk is bundled into it whole, so keeping them in one file put the
 * parser on every first paint (measured 2026-10-05).
 */
import { formatDuration, MAX_ENTRY_SECONDS } from './duration';

export interface DurationUnits {
  /** What `1d` means. The workspace's setting; Jira's default is 8. */
  hoursPerDay?: number;
  /** What `1w` means, in days. Jira's default is 5. */
  daysPerWeek?: number;
}

const UNIT_SECONDS: Record<string, (u: Required<DurationUnits>) => number> = {
  w: (u) => u.daysPerWeek * u.hoursPerDay * 3600,
  d: (u) => u.hoursPerDay * 3600,
  h: () => 3600,
  m: () => 60,
  s: () => 1,
};

/** Spellings people actually type, folded to one letter. */
const ALIASES: Record<string, string> = {
  w: 'w', wk: 'w', wks: 'w', week: 'w', weeks: 'w',
  d: 'd', day: 'd', days: 'd',
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const CLOCK = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/;
const BARE = new RegExp(`^${NUMBER}$`);
const PART = new RegExp(`(${NUMBER})\\s*([a-z]+)`, 'g');

const toNumber = (text: string) => Number(text.replace(',', '.'));

/**
 * `text` as seconds, or null when it is not a duration.
 *
 * Accepts Jira's `1w 2d 3h 30m` (and `1.5h`, `90m`, `2 hours`), a clock-style `1:30` or
 * `1:30:15`, and a bare number, which is **hours** — `1.5` is an hour and a half, the way
 * Harvest and every spreadsheet timesheet read it. A bare number is only accepted on its own:
 * `1h 30` is refused rather than guessed at, because it is half-typed `1h 30m` far more often
 * than it is 31 hours.
 */
export function parseDuration(text: string, units: DurationUnits = {}): number | null {
  const u = { hoursPerDay: units.hoursPerDay ?? 8, daysPerWeek: units.daysPerWeek ?? 5 };
  const input = text.trim().toLowerCase();
  if (!input) return null;

  const clock = CLOCK.exec(input);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
  if (BARE.test(input)) return Math.round(toNumber(input) * 3600);

  let seconds = 0;
  let consumed = '';
  for (const [whole, amount, word] of input.matchAll(PART)) {
    const unit = ALIASES[word];
    if (!unit) return null;
    seconds += toNumber(amount) * UNIT_SECONDS[unit](u);
    consumed += whole;
  }
  // Everything that is not whitespace must have been part of an amount-and-unit pair, so
  // `1h abc` or `1h 30` does not quietly parse as its recognisable half.
  if (consumed.replace(/\s/g, '') !== input.replace(/\s/g, '')) return null;
  return Math.round(seconds);
}

export interface DurationProblem {
  message: string;
  /** More typing could still fix it — wait until the field is left before saying so. */
  incomplete: boolean;
}

/** Why `text` cannot be logged as one entry, or null if it can (or is still empty). */
export function durationProblem(
  text: string,
  units: DurationUnits = {},
  max: number = MAX_ENTRY_SECONDS,
): DurationProblem | null {
  if (!text.trim()) return null;
  const seconds = parseDuration(text, units);
  if (seconds === null) {
    // Ends in a digit: probably a unit still to come (`1h 3` on the way to `1h 30m`).
    const incomplete = /\d\s*$/.test(text);
    return { message: 'Use h and m, for example 1h 30m, 45m or 1.5 (hours).', incomplete };
  }
  if (seconds <= 0) return { message: 'Enter a duration longer than zero.', incomplete: false };
  if (seconds > max) {
    return { message: `One entry can be at most ${formatDuration(max)}. Split longer work across days.`, incomplete: false };
  }
  return null;
}
