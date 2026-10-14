import { describe, it, expect } from 'vitest';
import { buildGrid } from './timesheetGrid';
import type { TimeReportRow } from '@/types';

const issue = (key: string) => ({ id: key, workspace_id: 'w1', list_id: 'l1', key, title: key });
const ada = { id: 'u1', display_name: 'Ada Lovelace' };
const grace = { id: 'u2', display_name: 'Grace Hopper' };
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30'];

const ROWS: TimeReportRow[] = [
  { user: ada, issue: issue('PAY-10'), work_date: '2026-09-28', seconds: 3600 },
  { user: grace, issue: issue('PAY-10'), work_date: '2026-09-28', seconds: 1800 },
  { user: ada, issue: issue('PAY-2'), work_date: '2026-09-30', seconds: 600 },
  // A late answer for another week: never summed into this one.
  { user: ada, issue: issue('PAY-2'), work_date: '2026-09-20', seconds: 99_999 },
];

describe('buildGrid', () => {
  it('sums one row per issue, with day and grand totals that agree', () => {
    const grid = buildGrid(ROWS, DAYS, false);
    expect(grid.rows.map((r) => [r.issue.key, r.total, r.user])).toEqual([
      ['PAY-2', 600, null],
      ['PAY-10', 5400, null],
    ]);
    expect(grid.dayTotals).toEqual({ '2026-09-28': 5400, '2026-09-29': 0, '2026-09-30': 600 });
    expect(grid.total).toBe(6000);
  });

  it('splits an issue by person when the sheet shows everyone', () => {
    const grid = buildGrid(ROWS, DAYS, true);
    expect(grid.rows.map((r) => [r.issue.key, r.user?.display_name, r.days['2026-09-28'] ?? 0])).toEqual([
      ['PAY-2', 'Ada Lovelace', 0],
      ['PAY-10', 'Ada Lovelace', 3600],
      ['PAY-10', 'Grace Hopper', 1800],
    ]);
  });

  it('is empty, with zeroed days, when nothing was logged', () => {
    expect(buildGrid([], DAYS, false)).toEqual({
      rows: [],
      dayTotals: { '2026-09-28': 0, '2026-09-29': 0, '2026-09-30': 0 },
      total: 0,
    });
  });
});
