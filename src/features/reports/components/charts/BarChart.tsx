import type { ReportChart } from '@/types/reports';
import { formatAxis, formatChartValue } from '../../format';
import { bandScale, labelIndexes, linearScale, seriesColor, shortDate, stack, stackedMax } from './scale';

/*
 * Bars, in every arrangement the reports use: one series or several side by side (`bar`,
 * `grouped_bar`), stacked (`stacked_bar`), across or up (`orientation`), and the bullet —
 * a wide estimate bar with the time spent drawn inside it, red when it runs over.
 */

const WIDTH = 640;
const VERTICAL_HEIGHT = 280;
const ROW_HEIGHT = 26;
const MAX_LABEL = 22;

const truncate = (label: string) => (label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label);

export function BarChart({ chart, label }: { chart: ReportChart; label: string }) {
  const x = chart.x ?? [];
  const series = chart.series ?? [];
  const horizontal = chart.orientation === 'horizontal' || chart.kind === 'bullet';
  const stacked = chart.kind === 'stacked_bar';
  const bullet = chart.kind === 'bullet';
  const values = series.map((s) => s.values);
  const max = stacked ? stackedMax(values) : Math.max(0, ...values.flat().map((v) => v ?? 0), chart.reference?.value ?? 0);
  const tops = stacked ? stack(values) : [];

  const margin = horizontal
    ? { top: 8, right: 24, bottom: 28, left: 150 }
    : { top: 12, right: 16, bottom: 40, left: 56 };
  const height = horizontal ? margin.top + margin.bottom + Math.max(1, x.length) * ROW_HEIGHT : VERTICAL_HEIGHT;
  const plotStart = horizontal ? margin.left : height - margin.bottom;
  const plotEnd = horizontal ? WIDTH - margin.right : margin.top;
  const value = linearScale(0, max, plotStart, plotEnd);
  const band = horizontal
    ? bandScale(x.length, margin.top, height - margin.bottom, 0.25)
    : bandScale(x.length, margin.left, WIDTH - margin.right, 0.25);
  const groups = stacked || bullet ? 1 : series.length;
  const sub = band.bandwidth / Math.max(1, groups);
  const shown = new Set(labelIndexes(x.length, horizontal ? x.length : 12));

  const rect = (category: number, slot: number, from: number, to: number, thin = false) => {
    const a = value(from);
    const b = value(to);
    const offset = band(category) + slot * sub + (thin ? sub * 0.3 : 0);
    const size = thin ? sub * 0.4 : Math.max(1, sub - (groups > 1 ? 2 : 0));
    return horizontal
      ? { x: Math.min(a, b), y: offset, width: Math.abs(b - a), height: size }
      : { x: offset, y: Math.min(a, b), width: size, height: Math.abs(b - a) };
  };

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label} className="h-auto w-full text-muted-foreground">
      {value.ticks.map((tick) => {
        const at = value(tick);
        return horizontal ? (
          <g key={tick}>
            <line x1={at} x2={at} y1={margin.top} y2={height - margin.bottom} stroke="var(--border)" />
            <text x={at} y={height - margin.bottom + 16} textAnchor="middle" fontSize={11} fill="currentColor">
              {formatAxis(tick, chart.unit)}
            </text>
          </g>
        ) : (
          <g key={tick}>
            <line x1={margin.left} x2={WIDTH - margin.right} y1={at} y2={at} stroke="var(--border)" />
            <text x={margin.left - 6} y={at + 4} textAnchor="end" fontSize={11} fill="currentColor">
              {formatAxis(tick, chart.unit)}
            </text>
          </g>
        );
      })}
      {x.map((category, index) => (
        <g key={`${category}-${index}`}>
          {shown.has(index) &&
            (horizontal ? (
              <text
                x={margin.left - 6}
                y={band(index) + band.bandwidth / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fill="currentColor"
              >
                <title>{category}</title>
                {truncate(category)}
              </text>
            ) : (
              <text
                x={band(index) + band.bandwidth / 2}
                y={height - margin.bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="currentColor"
              >
                <title>{category}</title>
                {truncate(shortDate(category))}
              </text>
            ))}
          {bullet ? (
            <>
              <rect {...rect(index, 0, 0, series[0]?.values[index] ?? 0)} fill="var(--muted)" stroke="var(--border)">
                <title>{`${category} — ${series[0]?.label}: ${formatChartValue(series[0]?.values[index] ?? null, chart.unit)}`}</title>
              </rect>
              {series[1] && (
                <rect
                  {...rect(index, 0, 0, series[1].values[index] ?? 0, true)}
                  fill={
                    (series[1].values[index] ?? 0) > (series[0]?.values[index] ?? 0) && (series[0]?.values[index] ?? 0) > 0
                      ? 'var(--danger)'
                      : seriesColor(0)
                  }
                >
                  <title>{`${category} — ${series[1].label}: ${formatChartValue(series[1].values[index] ?? null, chart.unit)}`}</title>
                </rect>
              )}
            </>
          ) : (
            series.map((s, slot) => {
              const v = s.values[index];
              if (v === null || v === undefined || v === 0) return null;
              const [from, to] = stacked ? tops[slot][index] : [0, v];
              return (
                <rect key={s.key} {...rect(index, stacked ? 0 : slot, from, to)} fill={seriesColor(slot, s.color)} rx={1}>
                  <title>{`${category} — ${s.label}: ${formatChartValue(v, chart.unit)}`}</title>
                </rect>
              );
            })
          )}
        </g>
      ))}
      {chart.reference && chart.reference.value !== null && (
        <g>
          <line
            x1={margin.left}
            x2={WIDTH - margin.right}
            y1={value(chart.reference.value)}
            y2={value(chart.reference.value)}
            stroke="var(--warning)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <text
            x={WIDTH - margin.right}
            y={value(chart.reference.value) - 4}
            textAnchor="end"
            fontSize={11}
            fill="currentColor"
          >
            {`${chart.reference.label}: ${formatChartValue(chart.reference.value, chart.unit)}`}
          </text>
        </g>
      )}
    </svg>
  );
}
