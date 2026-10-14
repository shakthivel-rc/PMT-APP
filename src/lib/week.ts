/*
 * Calendar days and weeks in the viewer's own time zone — what a timesheet is drawn in.
 *
 * Two rules every function here keeps:
 *
 * * **A day key is built from local parts** (`getFullYear`/`getMonth`/`getDate`), never from
 *   `toISOString().slice(0, 10)`, which is the UTC date: on a UTC+05:30 machine that is
 *   yesterday for the first five and a half hours of every day.
 * * **Days are stepped with `setDate`**, never by adding 86,400,000 ms, so a week that
 *   contains a daylight-saving change still has seven distinct days.
 */
import type { WeekStart } from '@/types';
import { toDateKey } from './dateKey';

export { toDateKey };

/** Local midnight of a `YYYY-MM-DD` key, or null when it is not a real day. */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // `new Date(2026, 1, 31)` is 3 March; a key that does not round-trip is not a day.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Local midnight of the first day of `date`'s week. */
export function startOfWeek(date: Date, weekStart: WeekStart = 'monday'): Date {
  const first = weekStart === 'monday' ? 1 : 0;
  return addDays(date, -((date.getDay() - first + 7) % 7));
}

/** The seven days of the week starting `start`. */
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** `Mon 5`, in the viewer's language. */
export function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/** A `work_date` for reading — `5 Oct 2026` — without ever treating it as an instant. */
export function formatDateKey(key: string): string {
  const date = parseDateKey(key);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : key;
}
