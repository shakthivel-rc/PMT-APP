import type { ReportChart } from '@/types/reports';
import { formatAxis, formatChartValue } from '../../format';
import { labelIndexes, linearScale, linePath, seriesColor, shortDate, stack, stackedMax } from './scale';

/*
 * Lines over days, weeks or months: `line` (created vs resolved), `line` with `step` (the
 * burndown and burnup — work changes at events, not smoothly between days) and
 * `stacked_area` (cumulative flow). A null value breaks the line: a burnup's future days
 * have no value yet, and drawing them as zero would claim the work was undone.
 */

const WIDTH = 640;
const HEIGHT = 280;
const MARGIN = { top: 12, right: 16, bottom: 40, left: 56 };

export function LineChart({ chart, label }: { chart: ReportChart; label: string }) {
  const x = chart.x ?? [];
  const series = chart.series ?? [];
  const area = chart.kind === 'stacked_area';
  const values = series.map((s) => s.values);
  const max = area ? stackedMax(values) : Math.max(0, ...values.flat().map((v) => v ?? 0));
  const y = linearScale(0, max, HEIGHT - MARGIN.bottom, MARGIN.top);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const step = x.length > 1 ? plotWidth / (x.length - 1) : plotWidth;
  const at = (index: number) => MARGIN.left + (x.length > 1 ? index * step : plotWidth / 2);
  const shown = labelIndexes(x.length, 10);
  const nonWorking = new Set(chart.non_working ?? []);
  const tops = area ? stack(values) : [];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full text-muted-foreground">
      {x.map((day, index) =>
        nonWorking.has(day) ? (
          <rect
            key={`nw-${day}`}
            x={Math.max(MARGIN.left, at(index) - step / 2)}
            y={MARGIN.top}
            width={Math.min(step, WIDTH - MARGIN.right - Math.max(MARGIN.left, at(index) - step / 2))}
            height={HEIGHT - MARGIN.top - MARGIN.bottom}
            fill="var(--muted)"
            opacity={0.6}
          >
            <title>{`${shortDate(day)} — non-working day`}</title>
          </rect>
        ) : null,
      )}
      {y.ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
          <text x={MARGIN.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="currentColor">
            {formatAxis(tick, chart.unit)}
          </text>
        </g>
      ))}
      {shown.map((index) => (
        <text key={index} x={at(index)} y={HEIGHT - MARGIN.bottom + 16} textAnchor="middle" fontSize={11} fill="currentColor">
          {shortDate(x[index])}
        </text>
      ))}
      {area
        ? series.map((s, index) => {
            const upper = tops[index].map(([, top], i) => `${at(i)},${y(top)}`);
            const lower = tops[index].map(([bottom], i) => `${at(i)},${y(bottom)}`).reverse();
            return (
              <polygon
                key={s.key}
                points={[...upper, ...lower].join(' ')}
                fill={seriesColor(index, s.color)}
                fillOpacity={0.75}
                stroke={seriesColor(index, s.color)}
              >
                <title>{s.label}</title>
              </polygon>
            );
          })
        : series.map((s, index) => (
            <g key={s.key}>
              <path
                d={linePath(
                  s.values.map((v, i) => (v === null || v === undefined ? null : [at(i), y(v)])),
                  chart.step,
                )}
                fill="none"
                stroke={seriesColor(index, s.color)}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '6 4' : undefined}
              />
              {!s.dashed &&
                s.values.map((v, i) =>
                  v === null || v === undefined ? null : (
                    <circle key={i} cx={at(i)} cy={y(v)} r={2.5} fill={seriesColor(index, s.color)}>
                      <title>{`${shortDate(x[i])} — ${s.label}: ${formatChartValue(v, chart.unit)}`}</title>
                    </circle>
                  ),
                )}
            </g>
          ))}
    </svg>
  );
}
