import { useState, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportChart as Chart } from '@/types/reports';
import { formatChartValue } from '../../format';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { LineChart } from './LineChart';
import { ScatterChart } from './ScatterChart';
import { donutColor, seriesColor, shortDate } from './scale';

/*
 * One entry point for every report chart: picks the drawing for `chart.kind`, draws its
 * legend, and offers the same numbers as a table — a screen reader reads a table, not an
 * SVG, and a reader who wants the exact value of one bar should not have to hover it.
 */

interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

function legendFor(chart: Chart): LegendItem[] {
  if (chart.kind === 'donut') {
    const labels = chart.x ?? [];
    return labels.map((label, index) => ({ label, color: donutColor(index, labels.length) }));
  }
  if (chart.kind === 'scatter') {
    return [
      { label: 'Resolved issue', color: seriesColor(0) },
      ...(chart.lines ?? []).map((line, index) => ({ label: line.label, color: seriesColor(index + 1) })),
      ...(chart.references ?? []).map((ref, index) => ({
        label: ref.label,
        color: index === 0 ? 'var(--success)' : 'var(--warning)',
        dashed: true,
      })),
    ];
  }
  if (chart.kind === 'bullet') {
    return [
      { label: chart.series?.[0]?.label ?? 'Estimate', color: 'var(--muted)' },
      { label: chart.series?.[1]?.label ?? 'Spent', color: seriesColor(0) },
      { label: 'Over estimate', color: 'var(--danger)' },
    ];
  }
  const items = (chart.series ?? []).map((s, index) => ({ label: s.label, color: seriesColor(index, s.color), dashed: s.dashed }));
  if (chart.reference && chart.reference.value !== null) {
    items.push({ label: chart.reference.label, color: 'var(--warning)', dashed: true });
  }
  return items;
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-3 rounded-sm"
            style={
              item.dashed
                ? { borderTop: `2px dashed ${item.color}`, height: 0 }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ChartTable({ chart }: { chart: Chart }) {
  if (chart.kind === 'scatter') {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Issue</th>
            <th className="py-1 pr-3 font-medium">Resolved</th>
            <th className="py-1 text-right font-medium">Days</th>
          </tr>
        </thead>
        <tbody>
          {(chart.points ?? []).map((point, index) => (
            <tr key={index} className="border-b last:border-0">
              <td className="py-1 pr-3">{point.label}</td>
              <td className="py-1 pr-3">{shortDate(point.x)}</td>
              <td className="py-1 text-right tabular-nums">{point.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const series = chart.series ?? [];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 pr-3 font-medium" scope="col">
            {' '}
          </th>
          {series.map((s) => (
            <th key={s.key} className="py-1 pr-3 text-right font-medium" scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(chart.x ?? []).map((label, index) => (
          <tr key={`${label}-${index}`} className="border-b last:border-0">
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              {shortDate(label)}
            </th>
            {series.map((s) => (
              <td key={s.key} className="py-1 pr-3 text-right tabular-nums">
                {formatChartValue(s.values[index] ?? null, chart.unit)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function isEmpty(chart: Chart): boolean {
  if (chart.kind === 'scatter') return !(chart.points ?? []).length;
  return !(chart.x ?? []).length || !(chart.series ?? []).some((s) => s.values.some((v) => v));
}

export function ReportChart({ chart, title }: { chart: Chart; title: string }) {
  const [asTable, setAsTable] = useState(false);
  const label = `${title} chart`;
  let drawing: ReactNode;
  switch (chart.kind) {
    case 'line':
    case 'stacked_area':
      drawing = <LineChart chart={chart} label={label} />;
      break;
    case 'scatter':
      drawing = <ScatterChart chart={chart} label={label} />;
      break;
    case 'donut':
      drawing = <DonutChart chart={chart} label={label} />;
      break;
    default:
      drawing = <BarChart chart={chart} label={label} />;
  }
  const empty = isEmpty(chart);

  return (
    <figure className="space-y-3" data-testid="report-chart" data-kind={chart.kind}>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Legend items={legendFor(chart)} />
        {!empty && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setAsTable((value) => !value)}
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
            {asTable ? 'View as chart' : 'View as table'}
          </Button>
        )}
      </div>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing to chart for these filters.</p>
      ) : asTable ? (
        <div className="max-h-80 overflow-auto">
          <ChartTable chart={chart} />
        </div>
      ) : (
        drawing
      )}
    </figure>
  );
}
