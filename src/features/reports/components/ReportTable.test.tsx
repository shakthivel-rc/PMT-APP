import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import { makeReportResult } from '@/test/fixtures';
import { groupIndexes, ReportTable, visibleRows } from './ReportTable';

/** Grouped rows collapse, totals sit in the footer, and a group's total opens its entries. */

const result = makeReportResult();

describe('grouping', () => {
  it('finds the groups and hides a closed group’s rows', () => {
    expect([...groupIndexes(result.rows)]).toEqual([0]);
    expect(visibleRows(result.rows, new Set()).map((r) => r.index)).toEqual([0, 1, 2]);
    expect(visibleRows(result.rows, new Set([0])).map((r) => r.index)).toEqual([0]);
  });

  it('reopens at the next row of the same depth', () => {
    const rows = [...result.rows, { label: 'Grace', _depth: 0 }, { label: 'Docs', _depth: 1 }];
    expect(visibleRows(rows, new Set([0])).map((r) => r.index)).toEqual([0, 3, 4]);
  });
});

describe('<ReportTable>', () => {
  const render = () =>
    renderWithProviders(
      <ReportTable columns={result.columns} rows={result.rows} totals={result.totals} caption="Time by group" workspaceId="w1" />,
    );

  it('draws the rows, the totals and collapses a group', async () => {
    render();
    const table = screen.getByRole('table', { name: 'Time by group' });
    expect(within(table).getByText('Payments')).toBeInTheDocument();
    expect(within(table).getByText('Total')).toBeInTheDocument();
    expect(within(table).getAllByText('2h 30m').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Ada Lovelace' }));
    expect(within(table).queryByText('Payments')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Ada Lovelace' }));
    expect(within(table).getByText('Payments')).toBeInTheDocument();
  });

  it('links a group to the time entries behind it', () => {
    render();
    const link = screen.getByRole('link', { name: 'Time entries for Ada Lovelace' });
    const href = new URL(link.getAttribute('href') as string, 'http://x');
    expect(href.pathname).toBe('/reports/time_entries');
    expect(href.searchParams.getAll('user_ids')).toEqual(['u1']);
    expect(href.searchParams.get('workspace')).toBe('w1');
  });

  it('pages long tables', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ label: `Row ${i}`, seconds: i }));
    renderWithProviders(<ReportTable columns={result.columns} rows={rows} caption="Long" pageSize={2} />);
    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.queryByText('Row 2')).toBeNull();
  });
});
