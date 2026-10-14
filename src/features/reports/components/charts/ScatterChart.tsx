import type { ReportChart } from '@/types/reports';
import { formatAxis, formatChartValue } from '../../format';
import { linePath, linearScale, seriesColor, shortDate, timeScale, toTime } from './scale';

/*
 * The cycle-time scatter: one dot per resolved issue at the time it was resolved, the
 * rolling average through them, and the median and 85th percentile as reference lines —
 * the chart that shows both the typical issue and the outliers.
 */

const WIDTH = 640;
const HEIGHT = 300;
const MARGIN = { top: 12, right: 16, bottom: 40, left: 56 };

export function ScatterChart({ chart, label }: { chart: ReportChart; label: string }) {
  const points = chart.points ?? [];
  const lines = chart.lines ?? [];
  const references = (chart.references ?? []).filter((r) => r.value !== null);
  const times = points.map((p) => toTime(p.x));
  const maxY = Math.max(0, ...points.map((p) => p.y), ...references.map((r) => r.value ?? 0));
  const x = timeScale(Math.min(...times), Math.max(...times), MARGIN.left, WIDTH - MARGIN.right);
  const y = linearScale(0, maxY, HEIGHT - MARGIN.bottom, MARGIN.top);
  const day = (ms: number) => shortDate(new Date(ms).toISOString().slice(0, 10));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full text-muted-foreground">
      {y.ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
          <text x={MARGIN.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="currentColor">
            {formatAxis(tick, chart.unit)}
          </text>
        </g>
      ))}
      {x.ticks.map((tick) => (
        <text key={tick} x={x(tick)} y={HEIGHT - MARGIN.bottom + 16} textAnchor="middle" fontSize={11} fill="currentColor">
          {day(tick)}
        </text>
      ))}
      {references.map((reference, index) => (
        <g key={reference.label}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(reference.value ?? 0)}
            y2={y(reference.value ?? 0)}
            stroke={index === 0 ? 'var(--success)' : 'var(--warning)'}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <text
            x={WIDTH - MARGIN.right}
            y={y(reference.value ?? 0) - 4}
            textAnchor="end"
            fontSize={11}
            fill="currentColor"
          >
            {`${reference.label}: ${formatChartValue(reference.value, chart.unit === 'days' ? undefined : chart.unit)}${chart.unit === 'days' ? ' d' : ''}`}
          </text>
        </g>
      ))}
      {points.map((point, index) => (
        <circle key={index} cx={x(times[index])} cy={y(point.y)} r={3.5} fill={seriesColor(0)} fillOpacity={0.7}>
          <title>{`${point.label ?? ''} — ${point.y} days, resolved ${day(times[index])}`}</title>
        </circle>
      ))}
      {lines.map((line, index) => (
        <path
          key={line.key}
          d={linePath(line.points.map((p) => [x(toTime(p.x)), y(p.y)]))}
          fill="none"
          stroke={seriesColor(index + 1)}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
