import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import { makeReportCatalog, makeReportType } from '@/test/fixtures';
import type { ReportParams } from '@/types/reports';
import { FilterBar } from './FilterBar';

/**
 * The filter bar draws only the controls a report reads, labels a preset with the dates it
 * means under the workspace's week start, and reports every change as a parameter patch.
 */

const presets = makeReportCatalog().presets;
const today = new Date(2026, 9, 4); // Sunday 4 Oct 2026

const render = (params: ReportParams, weekStart: 'monday' | 'sunday' = 'monday', report = makeReportType()) => {
  const onChange = vi.fn();
  renderWithProviders(<FilterBar report={report} params={params} onChange={onChange} presets={presets} weekStart={weekStart} today={today} />);
  return onChange;
};

describe('<FilterBar>', () => {
  it('labels "this week" by the workspace week start', () => {
    const { unmount } = renderWithProviders(
      <FilterBar report={makeReportType()} params={{ preset: 'this_week' }} onChange={vi.fn()} presets={presets} weekStart="monday" today={today} />,
    );
    const monday = screen.getByTestId('preset-range').textContent;
    unmount();
    render({ preset: 'this_week' }, 'sunday');
    const sunday = screen.getByTestId('preset-range').textContent;
    expect(monday).toMatch(/28/);
    expect(sunday).toMatch(/4/);
    expect(sunday).toMatch(/10/);
    expect(monday).not.toBe(sunday);
  });

  it('draws only the controls the report reads', () => {
    render({}, 'monday', makeReportType({ params: ['scope', 'unit', 'sprint_count'], dates: 'none' }));
    expect(screen.queryByRole('combobox', { name: 'Dates' })).toBeNull();
    expect(screen.queryByTestId('preset-range')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Group by' })).toBeNull();
  });

  it('turns "custom" into explicit dates, starting from the preset’s', async () => {
    const onChange = render({ preset: 'last_week' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Dates' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Custom range' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', date_from: '2026-09-21', date_to: '2026-09-27' });
  });

  it('clears explicit dates when a preset is chosen', async () => {
    const onChange = render({ preset: 'custom', date_from: '2026-09-01', date_to: '2026-09-10' });
    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    await userEvent.click(screen.getByRole('combobox', { name: 'Dates' }));
    await userEvent.click(await screen.findByRole('option', { name: 'This month' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'this_month', date_from: undefined, date_to: undefined });
  });
});
