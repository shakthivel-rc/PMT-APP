import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import type { ReportChart as Chart } from '@/types/reports';
import { ReportChart } from './ReportChart';

/** Every chart kind draws, labels itself for a screen reader, and has a table view. */

const x = ['2026-10-05', '2026-10-06', '2026-10-07'];
const charts: Chart[] = [
  { kind: 'bar', x: ['Ada', 'Grace'], series: [{ key: 's', label: 'Time', values: [3600, 7200] }], unit: 'duration' },
  { kind: 'stacked_bar', x, series: [{ key: 'a', label: 'Ada', values: [1, 2, 3] }, { key: 'g', label: 'Grace', values: [1, null, 1] }] },
  { kind: 'grouped_bar', x: ['S1', 'S2'], series: [{ key: 'c', label: 'Committed', values: [10, 8] }, { key: 'd', label: 'Completed', values: [8, 8] }], reference: { label: 'Average', value: 8 } },
  { kind: 'bullet', orientation: 'horizontal', x: ['PAY-1'], series: [{ key: 'e', label: 'Estimate', values: [3600] }, { key: 's', label: 'Spent', values: [5400] }], unit: 'duration' },
  { kind: 'line', x, step: true, non_working: ['2026-10-06'], series: [{ key: 'r', label: 'Remaining', values: [10, 8, 5] }, { key: 'g', label: 'Guideline', values: [10, 5, 0], dashed: true, color: 'muted' }] },
  { kind: 'stacked_area', x, series: [{ key: 't', label: 'To do', values: [3, 2, 1] }, { key: 'd', label: 'Done', values: [0, 1, 2] }] },
  { kind: 'scatter', points: [{ x: '2026-10-05T10:00:00', y: 2, label: 'PAY-1' }, { x: '2026-10-07T10:00:00', y: 5 }], lines: [{ key: 'avg', label: 'Rolling average', points: [{ x: '2026-10-05', y: 2 }, { x: '2026-10-07', y: 3.5 }] }], references: [{ label: '85th percentile', value: 4.5 }], unit: 'days' },
  { kind: 'donut', x: ['To do', 'In progress', 'Done'], series: [{ key: 'n', label: 'Issues', values: [3, 2, 5] }] },
];

describe('<ReportChart>', () => {
  it.each(charts.map((chart) => [chart.kind, chart] as const))('draws a %s chart', async (kind, chart) => {
    renderWithProviders(<ReportChart chart={chart} title="Chart" />);
    const figure = screen.getByTestId('report-chart');
    expect(figure).toHaveAttribute('data-kind', kind);
    expect(figure.querySelector('svg')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(figure.querySelector('svg[role="img"]')).toBeNull();
  });

  it('says when there is nothing to chart', () => {
    renderWithProviders(<ReportChart chart={{ kind: 'bar', x: [], series: [] }} title="Chart" />);
    expect(screen.getByText('Nothing to chart for these filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View as table' })).toBeNull();
  });
});
