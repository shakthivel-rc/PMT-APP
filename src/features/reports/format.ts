import { formatDuration } from '@/lib/duration';
import { formatServerDateTime } from '@/lib/datetime';
import { formatDateKey } from '@/lib/week';
import type { ColumnType } from '@/types/reports';

/*
 * How a report value reads on screen, by column type. The exports format the same values on
 * the server (services/reports/exporters/formatting.py); these are the screen's versions:
 * durations as `3h 20m`, dates in the viewer's language.
 */

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** A value of `type` for reading. Null and undefined read as an em dash. */
export function formatValue(value: unknown, type: ColumnType | string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'duration':
      return typeof value === 'number' ? formatDuration(value) : String(value);
    case 'percent':
      return typeof value === 'number' ? `${numberFormat.format(value)}%` : String(value);
    case 'number':
      return typeof value === 'number' ? numberFormat.format(value) : String(value);
    case 'date':
      return typeof value === 'string' ? formatDateKey(value) : String(value);
    case 'datetime':
      return typeof value === 'string' ? formatServerDateTime(value) : String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

/** Is this column type right-aligned (numbers line up on the right)? */
export function isNumeric(type: ColumnType | string): boolean {
  return type === 'duration' || type === 'percent' || type === 'number';
}

/** A chart axis value for its unit: hours for durations, a percent sign, a plain number. */
export function formatAxis(value: number, unit: string | undefined): string {
  if (unit === 'duration') {
    const hours = value / 3600;
    return `${numberFormat.format(Math.round(hours * 10) / 10)}h`;
  }
  if (unit === 'percent') return `${numberFormat.format(value)}%`;
  return numberFormat.format(value);
}

/** A chart value for a tooltip or the table view: durations as `3h 20m`. */
export function formatChartValue(value: number | null, unit: string | undefined): string {
  if (value === null) return '—';
  if (unit === 'duration') return formatDuration(value);
  if (unit === 'percent') return `${numberFormat.format(value)}%`;
  return numberFormat.format(value);
}
