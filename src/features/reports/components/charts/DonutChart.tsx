import type { ReportChart } from '@/types/reports';
import { formatChartValue } from '../../format';
import { donutColor } from './scale';

/*
 * The project overview's donut: issues by status category. Arcs are drawn as two-point SVG
 * arcs, with a full circle special-cased — an arc whose start and end coincide draws nothing.
 */

const SIZE = 220;
const RADIUS = 90;
const INNER = 56;

function arc(start: number, end: number): string {
  const point = (angle: number, radius: number) => [
    SIZE / 2 + radius * Math.sin(angle),
    SIZE / 2 - radius * Math.cos(angle),
  ];
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(start, RADIUS);
  const [x2, y2] = point(end, RADIUS);
  const [x3, y3] = point(end, INNER);
  const [x4, y4] = point(start, INNER);
  return `M${x1},${y1}A${RADIUS},${RADIUS} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${INNER},${INNER} 0 ${large} 0 ${x4},${y4}Z`;
}

export function DonutChart({ chart, label }: { chart: ReportChart; label: string }) {
  const labels = chart.x ?? [];
  const values = (chart.series?.[0]?.values ?? []).map((v) => v ?? 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  const color = (index: number) => donutColor(index, labels.length);
  let angle = 0;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="mx-auto h-auto w-full max-w-[220px]">
      {total === 0 ? (
        <circle cx={SIZE / 2} cy={SIZE / 2} r={(RADIUS + INNER) / 2} fill="none" stroke="var(--muted)" strokeWidth={RADIUS - INNER} />
      ) : (
        values.map((value, index) => {
          if (!value) return null;
          const start = angle;
          angle += (value / total) * Math.PI * 2;
          const title = `${labels[index]}: ${formatChartValue(value, chart.unit)} (${Math.round((value / total) * 100)}%)`;
          return value === total ? (
            <circle
              key={index}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={(RADIUS + INNER) / 2}
              fill="none"
              stroke={color(index)}
              strokeWidth={RADIUS - INNER}
            >
              <title>{title}</title>
            </circle>
          ) : (
            <path key={index} d={arc(start, angle)} fill={color(index)}>
              <title>{title}</title>
            </path>
          );
        })
      )}
      <text x={SIZE / 2} y={SIZE / 2 + 6} textAnchor="middle" fontSize={22} fontWeight={600} fill="var(--foreground)">
        {formatChartValue(total, chart.unit)}
      </text>
    </svg>
  );
}

