import { describe, expect, it } from 'vitest';
import type { ReportType } from '@/types/reports';
import { makeReportType } from '@/test/fixtures';
import { defaultPreset, paramsFromSearch, pickParams, presetRange, requestKey, searchFromParams } from './params';

/**
 * A report is its URL. What is pinned: the query string and the parameters round-trip; only a
 * report's own parameters travel; and the preset arithmetic is the API's (utils/report_math.py).
 */

const report = (overrides: Partial<ReportType> = {}) =>
  makeReportType({ params: ['scope', 'preset', 'date_from', 'date_to', 'user_ids', 'billable'], ...overrides });

describe('the URL and the parameters', () => {
  it('reads strings, lists (repeated or comma-separated), numbers and booleans', () => {
    const params = paramsFromSearch(
      new URLSearchParams('scope=space:s1&preset=last_week&user_ids=u1&user_ids=u2&group_by=user,project&rounding_minutes=15&cumulative=true&nonsense=1'),
    );
    expect(params).toEqual({
      scope: 'space:s1',
      preset: 'last_week',
      user_ids: ['u1', 'u2'],
      group_by: ['user', 'project'],
      rounding_minutes: 15,
      cumulative: true,
    });
  });

  it('ignores numbers and booleans that are not', () => {
    expect(paramsFromSearch(new URLSearchParams('sprint_count=abc&cumulative=yes'))).toEqual({});
  });

  it('round-trips, keeping the page keys and dropping empty values', () => {
    const params = { scope: 'workspace', preset: 'custom' as const, date_from: '2026-09-01', date_to: '2026-09-30', user_ids: ['u1', 'u2'], epic_id: '' };
    const search = searchFromParams(params, new URLSearchParams('workspace=w1&saved=r1&view=table&preset=today'));
    expect(search.get('workspace')).toBe('w1');
    expect(search.get('saved')).toBe('r1');
    expect(search.get('view')).toBe('table');
    expect(search.has('epic_id')).toBe(false);
    const { epic_id: _dropped, ...rest } = params;
    expect(paramsFromSearch(search)).toEqual(rest);
  });

  it('keeps only the parameters a report reads', () => {
    expect(pickParams(report(), { scope: 'workspace', user_ids: ['u1'], unit: 'points', bucket: 'day' })).toEqual({
      scope: 'workspace',
      user_ids: ['u1'],
    });
    expect(pickParams(undefined, { unit: 'points' })).toEqual({ unit: 'points' });
  });

  it('gives the same request the same key whatever the order', () => {
    expect(requestKey('w1', 'timesheet', { preset: 'today', scope: 'workspace' })).toBe(
      requestKey('w1', 'timesheet', { scope: 'workspace', preset: 'today' }),
    );
    expect(requestKey('w1', 'timesheet', { preset: 'today' })).not.toBe(requestKey('w2', 'timesheet', { preset: 'today' }));
  });
});

describe('presets', () => {
  const monday = new Date(2026, 9, 5); // Mon 5 Oct 2026
  const sunday = new Date(2026, 9, 4);

  it('defaults to the API defaults', () => {
    expect(defaultPreset(report())).toBe('this_week');
    expect(defaultPreset(report({ dates: 'week' }))).toBe('this_week');
    expect(defaultPreset(report({ dates: 'range' }))).toBe('last_30_days');
    expect(defaultPreset(report({ dates: 'sprint' }))).toBeNull();
    expect(defaultPreset(undefined)).toBeNull();
  });

  it('counts weeks from the workspace week start', () => {
    expect(presetRange('this_week', monday, 'monday')).toEqual(['2026-10-05', '2026-10-11']);
    expect(presetRange('last_week', monday, 'monday')).toEqual(['2026-09-28', '2026-10-04']);
    expect(presetRange('this_week', monday, 'sunday')).toEqual(['2026-10-04', '2026-10-10']);
    expect(presetRange('this_week', sunday, 'monday')).toEqual(['2026-09-28', '2026-10-04']);
    expect(presetRange('this_week', sunday, 'sunday')).toEqual(['2026-10-04', '2026-10-10']);
  });

  it('runs "this" periods to their end, and days to today', () => {
    expect(presetRange('today', monday)).toEqual(['2026-10-05', '2026-10-05']);
    expect(presetRange('yesterday', monday)).toEqual(['2026-10-04', '2026-10-04']);
    expect(presetRange('this_month', monday)).toEqual(['2026-10-01', '2026-10-31']);
    expect(presetRange('last_month', monday)).toEqual(['2026-09-01', '2026-09-30']);
    expect(presetRange('last_30_days', monday)).toEqual(['2026-09-06', '2026-10-05']);
    expect(presetRange('this_quarter', monday)).toEqual(['2026-10-01', '2026-12-31']);
    expect(presetRange('last_quarter', monday)).toEqual(['2026-07-01', '2026-09-30']);
    expect(presetRange('this_year', monday)).toEqual(['2026-01-01', '2026-12-31']);
    expect(presetRange('custom', monday)).toBeNull();
  });

  it('crosses year and leap-year boundaries', () => {
    expect(presetRange('last_month', new Date(2027, 0, 15))).toEqual(['2026-12-01', '2026-12-31']);
    expect(presetRange('last_quarter', new Date(2027, 1, 1))).toEqual(['2026-10-01', '2026-12-31']);
    expect(presetRange('this_month', new Date(2028, 1, 10))).toEqual(['2028-02-01', '2028-02-29']);
  });
});
