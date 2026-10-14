import type { ReportKpi } from '@/types/reports';
import { formatValue } from '../../format';

/*
 * The headline numbers above a report: total time, done %, committed and completed points.
 * Smaller than the dashboard's StatCard and without its icon — a report has up to six of
 * these in a row, and six icons say nothing the labels do not.
 */

export function KpiTile({ kpi }: { kpi: ReportKpi }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3" data-testid={`kpi-${kpi.key}`}>
      <dt className="truncate text-xs font-medium text-muted-foreground">{kpi.label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{formatValue(kpi.value, kpi.type)}</dd>
    </div>
  );
}

export function KpiTiles({ kpis }: { kpis: ReportKpi[] }) {
  if (!kpis.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.key} kpi={kpi} />
      ))}
    </dl>
  );
}
