import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarClock, Download, Printer, RefreshCw, Save } from 'lucide-react';
import { fetchIssuesApi } from '@/api/issues';
import { fetchSavedReportApi } from '@/api/reports';
import { fetchSprintsApi } from '@/api/sprints';
import EmptyState from '@/components/EmptyState';
import FormMessage from '@/components/FormMessage';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/app/hooks';
import type { WeekStart } from '@/types';
import type { ReportParams, ReportResult, SavedReport } from '@/types/reports';
import { formatServerDateTime } from '@/lib/datetime';
import { formatDateKey } from '@/lib/week';
import { cn } from '@/lib/utils';
import { pickParams, paramsFromSearch, searchFromParams } from '../params';
import { rendererFor } from '../renderers';
import { useKeyed } from '../useKeyed';
import { useReport } from '../useReport';
import { useReportsWorkspace } from '../useReportsWorkspace';
import { KpiTiles } from './charts/KpiTile';
import { ReportChart } from './charts/ReportChart';
import { ExportDialog } from './ExportDialog';
import { FilterBar } from './FilterBar';
import { ReportTable } from './ReportTable';
import { SaveReportDialog } from './SaveReportDialog';
import { ScheduleDialog } from './ScheduleDialog';
import { ScopePicker, WORKSPACE_SCOPE, spaceOfScope } from './ScopePicker';

/*
 * One page for every report (docs/design/08-reports.md §8.1): the scope and filters the
 * report takes, its key figures, its chart, its table and any sections, the notes the API
 * attached — and the actions: export, save, schedule, print.
 *
 * The URL is the state. A filter change rewrites the query string (replacing the entry, as
 * the timesheet does — tweaking a filter is not history), and the query string runs the
 * report. `?saved=` marks a report opened from a saved one, so "Save" updates it.
 */

function ResultMeta({ result }: { result: ReportResult }) {
  const { meta } = result;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="report-meta">
      <span>{meta.scope_name}</span>
      {meta.date_from && (
        <span>
          {formatDateKey(meta.date_from)}
          {meta.date_to && meta.date_to !== meta.date_from ? ` – ${formatDateKey(meta.date_to)}` : ''}
        </span>
      )}
      <span>Times in {meta.timezone}</span>
      {meta.rounding_minutes > 0 && (
        <span>
          Each entry rounded {meta.rounding_mode} to {meta.rounding_minutes} min
        </span>
      )}
      <span>Generated {formatServerDateTime(meta.generated_at)}</span>
      {meta.cached && <StatusBadge tone="neutral">Cached</StatusBadge>}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-busy="true" aria-label="Loading report">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

const ReportPage = () => {
  const { type = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { workspaces, workspace, workspaceId, error, loading, catalog, tree, members } = useReportsWorkspace();
  const [dialog, setDialog] = useState<'export' | 'save' | 'schedule' | null>(null);
  const [savedOverride, setSavedOverride] = useState<SavedReport | null>(null);

  const report = catalog?.reports.find((r) => r.type === type);
  const urlParams = useMemo(() => paramsFromSearch(search), [search]);
  const params: ReportParams = useMemo(
    () => pickParams(report, { ...urlParams, scope: urlParams.scope ?? WORKSPACE_SCOPE }),
    [report, urlParams],
  );
  const savedId = search.get('saved');
  // Just saved here: the answer to the save is the saved report, so it is not asked for again.
  const savedKnown = savedOverride !== null && savedOverride.id === savedId;
  const savedLoaded = useKeyed(workspaceId && savedId && !savedKnown ? `${workspaceId}|${savedId}` : null, () =>
    fetchSavedReportApi(workspaceId as string, savedId as string),
  );
  const saved = savedOverride && savedOverride.id === savedId ? savedOverride : (savedLoaded?.data ?? null);

  const sprintSpace = report?.needs_sprints ? spaceOfScope(tree, params.scope) : null;
  const sprints = useKeyed(workspaceId && sprintSpace ? `${workspaceId}|${sprintSpace}` : null, () =>
    fetchSprintsApi(workspaceId as string, sprintSpace as string, 'active,closed'),
  );
  const epicSpace = report?.params.includes('epic_id') ? spaceOfScope(tree, params.scope) : null;
  const epics = useKeyed(workspaceId && epicSpace ? `epics|${workspaceId}|${epicSpace}` : null, () =>
    fetchIssuesApi(workspaceId as string, { space_id: epicSpace as string, type: 'epic', limit: 200 }).then((p) => p.records),
  );

  const run = useReport(workspaceId, report ? type : null, params, Boolean(catalog?.can_view));
  const result = run.result ?? run.stale;
  const renderer = rendererFor(type);

  const update = (patch: Partial<ReportParams>) => {
    const next = { ...urlParams, ...patch };
    setSearch(searchFromParams(next, search), { replace: true });
  };

  const title = saved?.name ?? report?.title ?? 'Report';
  const back = (
    <Button variant="ghost" size="sm" asChild data-print-hide>
      <Link to={`/reports${workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ''}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Reports
      </Link>
    </Button>
  );

  if (error) {
    return (
      <PageContainer>
        <PageHeader title="Reports" icon={BarChart3} />
        <FormMessage>{error}</FormMessage>
      </PageContainer>
    );
  }
  if (workspaces && workspaces.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Reports" icon={BarChart3} />
        <EmptyState icon={BarChart3} title="No workspaces yet" description="Reports are about a workspace's work. Create or join one first." />
      </PageContainer>
    );
  }
  if (loading || !catalog) {
    return (
      <PageContainer>
        <PageHeader title="Reports" icon={BarChart3} />
        <ReportSkeleton />
      </PageContainer>
    );
  }
  if (!catalog.can_view) {
    return (
      <PageContainer>
        <PageHeader title="Reports" icon={BarChart3} />
        <EmptyState icon={BarChart3} title="Reports are off for guests" description="An admin of this workspace can turn them on." />
      </PageContainer>
    );
  }
  if (!report) {
    return (
      <PageContainer>
        {back}
        <EmptyState icon={BarChart3} title="No such report" description={`There is no “${type}” report.`} />
      </PageContainer>
    );
  }

  const status = run.error?.status;
  const canExport = catalog.export_formats.length > 0;

  return (
    <PageContainer className="space-y-5">
      <div data-print-hide>{back}</div>
      <div className="print-only mb-2 text-sm">
        <p className="font-semibold">{workspace?.name}</p>
      </div>
      <PageHeader
        title={title}
        description={report.description}
        icon={BarChart3}
        actions={
          <div className="flex flex-wrap gap-2" data-print-hide>
            <Button variant="outline" size="sm" onClick={run.refresh} aria-label="Refresh report">
              <RefreshCw className={cn('h-4 w-4', run.loading && 'animate-spin')} aria-hidden />
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog('save')}>
              <Save className="h-4 w-4" aria-hidden /> {saved?.can_edit ? 'Update' : 'Save'}
            </Button>
            {saved && catalog.can_schedule && (
              <Button variant="outline" size="sm" onClick={() => setDialog('schedule')}>
                <CalendarClock className="h-4 w-4" aria-hidden /> Schedule
              </Button>
            )}
            {canExport && (
              <Button size="sm" onClick={() => setDialog('export')}>
                <Download className="h-4 w-4" aria-hidden /> Export
              </Button>
            )}
          </div>
        }
      />

      <Card data-print-hide>
        <CardContent className="flex flex-col gap-4 pt-6">
          <ScopePicker
            tree={tree}
            scope={params.scope ?? WORKSPACE_SCOPE}
            onScope={(scope) => update({ scope, sprint_id: undefined, epic_id: undefined })}
            needsSprints={report.needs_sprints && report.params.includes('sprint_id')}
            sprints={sprints?.data}
            sprintId={params.sprint_id}
            onSprint={(sprintId) => update({ sprint_id: sprintId ?? undefined })}
          />
          <FilterBar
            report={report}
            params={params}
            onChange={update}
            presets={catalog.presets}
            members={members}
            epics={epics?.data}
            weekStart={(result?.meta.week_start as WeekStart | undefined) ?? 'monday'}
          />
        </CardContent>
      </Card>

      {run.error && status === 413 && (
        <FormMessage variant="warning">
          <span className="flex flex-wrap items-center gap-3">
            {run.error.message}
            {canExport && (
              <Button size="sm" variant="outline" onClick={() => setDialog('export')}>
                <Download className="h-4 w-4" aria-hidden /> Export instead
              </Button>
            )}
          </span>
        </FormMessage>
      )}
      {run.error && status === 422 && (
        <FormMessage variant="info">
          {run.error.message}{' '}
          {sprintSpace ? 'Start a sprint from the project page, or choose another sprint.' : 'Choose a project with sprints in Scope.'}
        </FormMessage>
      )}
      {run.error && status !== 413 && status !== 422 && <FormMessage>{run.error.message}</FormMessage>}

      {!result && run.loading && <ReportSkeleton />}

      {result && (
        <div className={cn('space-y-5 transition-opacity', run.loading && 'opacity-60')} aria-busy={run.loading}>
          <ResultMeta result={result} />
          {result.meta.restricted_to_own && (
            <FormMessage variant="info">Time visibility in this workspace is “own”: the time shown is yours only.</FormMessage>
          )}
          {result.meta.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground" data-testid="report-notes">
              {result.meta.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {typeof result.meta.goal === 'string' && result.meta.goal && (
            <p className="text-sm">
              <span className="font-medium">Sprint goal:</span> {result.meta.goal}
            </p>
          )}

          <div className={cn(renderer.chartLayout === 'side' && result.chart && 'grid gap-5 lg:grid-cols-[2fr_1fr]')}>
            <KpiTiles kpis={result.kpis} />
            {renderer.chartLayout === 'side' && result.chart && (
              <Card data-report-block>
                <CardContent className="pt-6">
                  <ReportChart chart={result.chart} title={result.meta.title} />
                </CardContent>
              </Card>
            )}
          </div>

          {renderer.chartLayout === 'full' && result.chart && (
            <Card data-report-block>
              <CardContent className="pt-6">
                <ReportChart chart={result.chart} title={result.meta.title} />
              </CardContent>
            </Card>
          )}

          {renderer.sectionsFirst && <Sections result={result} workspaceId={workspaceId ?? undefined} />}

          {(result.columns.length > 0 || result.rows.length > 0) && (
            <Card data-report-block>
              <CardHeader>
                <CardTitle className="text-base">
                  {renderer.tableTitle}{' '}
                  <span className="text-sm font-normal text-muted-foreground">({result.meta.row_count} rows)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{renderer.empty}</p>
                ) : (
                  <ReportTable
                    columns={result.columns}
                    rows={result.rows}
                    totals={result.totals}
                    caption={`${result.meta.title}: ${renderer.tableTitle}`}
                    workspaceId={workspaceId ?? undefined}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {!renderer.sectionsFirst && <Sections result={result} workspaceId={workspaceId ?? undefined} />}
        </div>
      )}

      {workspaceId && dialog === 'export' && (
        <ExportDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          reportType={type}
          title={title}
          params={params}
          formats={catalog.export_formats}
        />
      )}
      {workspaceId && dialog === 'save' && (
        <SaveReportDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          reportType={type}
          defaultName={report.title}
          params={params}
          saved={saved}
          onSaved={(next) => {
            setSavedOverride(next);
            const query = searchFromParams(params, search);
            query.set('saved', next.id);
            navigate(`/reports/${type}?${query.toString()}`, { replace: true });
          }}
        />
      )}
      {workspaceId && dialog === 'schedule' && saved && (
        <ScheduleDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          saved={saved}
          members={members ?? []}
          timezone={catalog.settings.timezone}
          formats={catalog.export_formats.length ? catalog.export_formats : ['pdf']}
          currentUserId={user?.id}
        />
      )}
    </PageContainer>
  );
};

function Sections({ result, workspaceId }: { result: ReportResult; workspaceId?: string }) {
  if (!result.sections.length) return null;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {result.sections.map((section) => (
        <Card key={section.key} data-report-block data-testid={`section-${section.key}`}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {section.rows.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">None.</p>
            ) : (
              <ReportTable
                columns={section.columns}
                rows={section.rows}
                totals={section.totals}
                caption={section.title}
                workspaceId={workspaceId}
                pageSize={Infinity}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ReportPage;
