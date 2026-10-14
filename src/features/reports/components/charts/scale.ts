/*
 * The arithmetic under every report chart (docs/design/08-reports.md §8.3). The charts are
 * hand-drawn SVG rather than a charting library: eight chart kinds over one result shape do
 * not need 100 kB of someone else's abstractions, and owning the drawing is what lets every
 * chart carry a real table view and the theme's colours.
 */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  ticks: number[];
}

/** A "nice" step for about `count` ticks across `span`: 1, 2 or 5 times a power of ten. */
export function niceStep(span: number, count = 5): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * A linear scale from [min, max] to [rangeStart, rangeEnd], with the domain widened to
 * whole ticks. A chart of all zeros still gets an axis from 0 to 1, never a division by zero.
 */
export function linearScale(
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number,
  tickCount = 5,
): LinearScale {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, tickCount);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Rounded to the step's precision so 0.1 + 0.2 never labels an axis 0.30000000000000004.
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  for (let value = lo; value <= hi + step / 2; value += step) ticks.push(Number(value.toFixed(digits)));
  const span = hi - lo;
  const scale = ((value: number) => rangeStart + ((value - lo) / span) * (rangeEnd - rangeStart)) as LinearScale;
  scale.domain = [lo, hi];
  scale.ticks = ticks;
  return scale;
}

export interface BandScale {
  (index: number): number;
  bandwidth: number;
  step: number;
}

/** `count` equal bands across [start, end], each with `padding` (a fraction) of its step. */
export function bandScale(count: number, start: number, end: number, padding = 0.2): BandScale {
  const step = count > 0 ? (end - start) / count : 0;
  const bandwidth = step * (1 - padding);
  const scale = ((index: number) => start + index * step + (step - bandwidth) / 2) as BandScale;
  scale.bandwidth = bandwidth;
  scale.step = step;
  return scale;
}

/** Milliseconds since the epoch of an ISO date or date-time, read as UTC. */
export function toTime(value: string): number {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  return Date.parse(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export interface TimeScale {
  (value: number): number;
  domain: [number, number];
  ticks: number[];
}

const DAY = 86_400_000;

/** A time scale over [min, max] ms, with day-aligned ticks (about `tickCount` of them). */
export function timeScale(min: number, max: number, rangeStart: number, rangeEnd: number, tickCount = 6): TimeScale {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) && max > lo ? max : lo + DAY;
  const span = hi - lo;
  const scale = ((value: number) => rangeStart + ((value - lo) / span) * (rangeEnd - rangeStart)) as TimeScale;
  scale.domain = [lo, hi];
  const days = Math.max(1, Math.ceil(span / DAY / Math.max(1, tickCount)));
  const first = Math.ceil(lo / DAY) * DAY;
  const ticks: number[] = [];
  for (let value = first; value <= hi; value += days * DAY) ticks.push(value);
  scale.ticks = ticks;
  return scale;
}

/** Thin `labels` to at most `max` evenly spaced indexes — the x labels a narrow chart draws. */
export function labelIndexes(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, index) => index);
  const every = Math.ceil(count / max);
  const indexes: number[] = [];
  for (let index = 0; index < count; index += every) indexes.push(index);
  return indexes;
}

/** `5 Oct` for an ISO date; anything that is not a date comes back unchanged. */
export function shortDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const time = toTime(value.slice(0, 10));
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Stack `series` (one array per series, aligned by index): for every index, each series'
 * [bottom, top]. Nulls stack as zero; negative values are not expected in a report.
 */
export function stack(series: (number | null)[][]): [number, number][][] {
  const length = Math.max(0, ...series.map((values) => values.length));
  const base = new Array<number>(length).fill(0);
  return series.map((values) =>
    Array.from({ length }, (_, index) => {
      const bottom = base[index];
      const top = bottom + (values[index] ?? 0);
      base[index] = top;
      return [bottom, top] as [number, number];
    }),
  );
}

/** The largest total of `series` at any one index — the stacked chart's maximum. */
export function stackedMax(series: (number | null)[][]): number {
  const tops = stack(series);
  return Math.max(0, ...tops.flatMap((rows) => rows.map(([, top]) => top)));
}

const PALETTE = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'info', 'warning', 'success'];

/**
 * The colour of series `index`: its own theme token when the API named one, otherwise the
 * next chart colour. A CSS variable, so dark mode and the PDF palette follow the theme.
 */
export function seriesColor(index: number, token?: string): string {
  if (token === 'muted') return 'var(--muted-foreground)';
  if (token) return `var(--${token})`;
  return `var(--${PALETTE[index % PALETTE.length]})`;
}

/** SVG path segments through the non-null points; `step` holds each value until the next. */
export function linePath(points: ([number, number] | null)[], step = false): string {
  let path = '';
  let previous: [number, number] | null = null;
  for (const point of points) {
    if (!point) {
      previous = null;
      continue;
    }
    if (!previous) path += `M${point[0]},${point[1]}`;
    else if (step) path += `H${point[0]}V${point[1]}`;
    else path += `L${point[0]},${point[1]}`;
    previous = point;
  }
  return path;
}

const CATEGORY_COLORS = ['muted', 'info', 'success'];

/** The donut's colour for slice `index` of `count`: the three status categories get their own. */
export function donutColor(index: number, count: number): string {
  return count === 3 ? seriesColor(index, CATEGORY_COLORS[index]) : seriesColor(index);
}
