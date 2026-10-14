import type { TimeIssueRef, TimeReportRow, UserRef } from '@/types';

/*
 * The timesheet grid, as data: one row per issue (per person, when the sheet shows everyone),
 * one column per day, and the totals both ways. Pure, so the arithmetic a person will check
 * against their own memory of the week is tested apart from the screen that draws it.
 */

export interface GridRow {
  key: string;
  issue: TimeIssueRef;
  /** Present when the sheet shows more than one person. */
  user: UserRef | null;
  /** Seconds by `YYYY-MM-DD`. */
  days: Record<string, number>;
  total: number;
}

export interface Grid {
  rows: GridRow[];
  /** Seconds by `YYYY-MM-DD`, across every row. */
  dayTotals: Record<string, number>;
  total: number;
}

export function buildGrid(report: readonly TimeReportRow[], dayKeys: readonly string[], byPerson: boolean): Grid {
  const inWeek = new Set(dayKeys);
  const rows = new Map<string, GridRow>();
  const dayTotals: Record<string, number> = Object.fromEntries(dayKeys.map((day) => [day, 0]));
  let total = 0;

  for (const entry of report) {
    // The API answers for the range asked; a day outside it would mean a stale answer for the
    // previous week arriving late, and must not be summed into this one.
    if (!inWeek.has(entry.work_date)) continue;
    const key = byPerson ? `${entry.issue.id}|${entry.user.id}` : entry.issue.id;
    let row = rows.get(key);
    if (!row) {
      row = { key, issue: entry.issue, user: byPerson ? entry.user : null, days: {}, total: 0 };
      rows.set(key, row);
    }
    row.days[entry.work_date] = (row.days[entry.work_date] ?? 0) + entry.seconds;
    row.total += entry.seconds;
    dayTotals[entry.work_date] += entry.seconds;
    total += entry.seconds;
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      a.issue.key.localeCompare(b.issue.key, undefined, { numeric: true }) ||
      (a.user?.display_name ?? '').localeCompare(b.user?.display_name ?? ''),
  );
  return { rows: sorted, dayTotals, total };
}
