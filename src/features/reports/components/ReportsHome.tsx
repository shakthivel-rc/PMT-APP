import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  FolderKanban,
  Loader2,
  Pin,
  Settings,
  Trash2,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteSavedReportApi,
  downloadReportJobApi,
  fetchReportJobsApi,
  fetchSavedReportsApi,
  saveFile,
  updateSavedReportApi,
} from '@/api/reports';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import FormMessage from '@/components/FormMessage';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { canManageWorkspace } from '@/types';
import type { ReportJob, ReportType, SavedReport } from '@/types/reports';
import { formatServerDateTime } from '@/lib/datetime';
import { searchFromParams } from '../params';
import { useKeyed } from '../useKeyed';
import { useReport } from '../useReport';
import { useReportsWorkspace } from '../useReportsWorkspace';
import { KpiTiles } from './charts/KpiTile';
import { ReportsSettingsDialog } from './ReportsSettingsDialog';

/*
 * The Reports home (docs/design/08-reports.md §8.1): pinned reports with their live key
 * figures first — a small dashboard — then the catalogue by category, every saved report
 * this person can open, and their recent exports with the links still valid.
 *
 * A `?scope=` on the way in (the project page's "Reports" button) is passed on to every
 * report opened from here, so the reports open on that project.
 */

const CATEGORIES: { key: string; title: string; description: string; icon: LucideIcon }[] = [
  { key: 'time', title: 'Time', description: 'Who logged what, where, and against which estimate.', icon: Clock },
  { key: 'project', title: 'Projects', description: 'Where the work stands, and who carries it.', icon: FolderKanban },
  { key: 'sprint', title: 'Sprints', description: 'Commitment, progress and velocity.', icon: Zap },
  { key: 'flow', title: 'Flow', description: 'Bottlenecks and how long work takes.', icon: Activity },
];
const MAX_PINNED_PREVIEWS = 6;

const JOB_TONE: Record<string, 'success' | 'danger' | 'info' | 'neutral'> = {
  done: 'success',
  failed: 'danger',
  running: 'info',
  queued: 'neutral',
};

function savedHref(saved: SavedReport, workspaceId: string) {
  const query = searchFromParams(saved.params);
  query.set('workspace', workspaceId);
  query.set('saved', saved.id);
  return `/reports/${saved.report_type}?${query.toString()}`;
}

function PinnedReport({ saved, workspaceId, title }: { saved: SavedReport; workspaceId: string; title: string }) {
  const run = useReport(workspaceId, saved.report_type, saved.params);
  return (
    <Card className="flex flex-col" data-testid="pinned-report">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pin className="h-4 w-4 text-primary" aria-hidden />
          <Link to={savedHref(saved, workspaceId)} className="hover:underline">
            {saved.name}
          </Link>
        </CardTitle>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        {run.loading && <Skeleton className="h-16" />}
        {run.error && <p className="text-sm text-muted-foreground">{run.error.message}</p>}
        {run.result && <KpiTiles kpis={run.result.kpis.slice(0, 3)} />}
      </CardContent>
    </Card>
  );
}

const ReportsHome = () => {
  const [search, setSearch] = useSearchParams();
  const { workspaces, workspace, workspaceId, error, loading, catalog, onSettingsSaved } = useReportsWorkspace();
  const [version, setVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const savedReports = useKeyed(catalog?.can_view && workspaceId ? `${workspaceId}|${version}` : null, () =>
    fetchSavedReportsApi(workspaceId as string),
  );
  const jobs = useKeyed(catalog?.can_view && workspaceId ? `jobs|${workspaceId}|${version}` : null, () =>
    fetchReportJobsApi(workspaceId as string),
  );
  const scope = search.get('scope');
  const isAdmin = workspace ? canManageWorkspace(workspace.role) : false;

  const reportHref = (report: ReportType) => {
    const query = new URLSearchParams();
    if (workspaceId) query.set('workspace', workspaceId);
    if (scope) query.set('scope', scope);
    return `/reports/${report.type}?${query.toString()}`;
  };
  const titleOf = (type: string) => catalog?.reports.find((r) => r.type === type)?.title ?? type;

  const download = async (job: ReportJob) => {
    setDownloading(job.id);
    try {
      saveFile(await downloadReportJobApi(job));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The download failed.');
    } finally {
      setDownloading(null);
    }
  };

  const changeSaved = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run();
      toast.success(done);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work. Try again.');
    }
  };

  const header = (
    <PageHeader
      title="Reports"
      description="Time, projects, sprints and flow — on screen, as files, or by email."
      icon={BarChart3}
      actions={
        <div className="flex items-end gap-2">
          {workspaces && workspaces.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="reports-workspace" className="sr-only">
                Workspace
              </Label>
              <Select value={workspaceId ?? undefined} onValueChange={(id) => setSearch({ workspace: id }, { replace: true })}>
                <SelectTrigger id="reports-workspace" className="w-48">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isAdmin && catalog && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" aria-hidden /> Settings
            </Button>
          )}
        </div>
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <FormMessage>{error}</FormMessage>
      </PageContainer>
    );
  }
  if (workspaces && workspaces.length === 0) {
    return (
      <PageContainer>
        {header}
        <EmptyState icon={BarChart3} title="No workspaces yet" description="Reports are about a workspace's work. Create or join one first." />
      </PageContainer>
    );
  }
  if (loading || !catalog || !workspaceId) {
    return (
      <PageContainer>
        {header}
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </PageContainer>
    );
  }
  if (!catalog.can_view) {
    return (
      <PageContainer>
        {header}
        <EmptyState icon={BarChart3} title="Reports are off for guests" description="An admin of this workspace can turn them on." />
      </PageContainer>
    );
  }

  const saved = savedReports?.data ?? [];
  const pinned = saved.filter((s) => s.pinned).slice(0, MAX_PINNED_PREVIEWS);

  return (
    <PageContainer className="space-y-8">
      {header}
      {scope && (
        <FormMessage variant="info">
          Reports opened from here start on the project you came from.{' '}
          <button type="button" className="underline" onClick={() => setSearch({ workspace: workspaceId }, { replace: true })}>
            Use the whole workspace
          </button>
        </FormMessage>
      )}

      {pinned.length > 0 && (
        <section aria-labelledby="pinned-heading" className="space-y-3">
          <h2 id="pinned-heading" className="text-lg font-semibold">
            Pinned
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pinned.map((s) => (
              <PinnedReport key={s.id} saved={s} workspaceId={workspaceId} title={titleOf(s.report_type)} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="catalog-heading" className="space-y-3">
        <h2 id="catalog-heading" className="text-lg font-semibold">
          All reports
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORIES.map((category) => {
            const reports = catalog.reports.filter((r) => r.category === category.key);
            if (!reports.length) return null;
            const Icon = category.icon;
            return (
              <Card key={category.key} data-testid={`category-${category.key}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                    {category.title}
                  </CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {reports.map((report) => (
                      <li key={report.type} className="py-2.5">
                        <Link to={reportHref(report)} className="font-medium hover:underline">
                          {report.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="saved-heading" className="space-y-3">
        <h2 id="saved-heading" className="text-lg font-semibold">
          Saved reports
        </h2>
        <DataTable
          caption="Saved reports"
          rows={saved}
          rowKey={(s) => s.id}
          animate={false}
          loading={!savedReports ? <Skeleton className="h-24" /> : undefined}
          empty={
            <EmptyState
              icon={Users}
              title="No saved reports yet"
              description="Open a report, set its filters, and choose Save. Shared ones appear here for everyone."
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (s) => (
                <Link to={savedHref(s, workspaceId)} className="font-medium hover:underline">
                  {s.name}
                </Link>
              ),
            },
            { key: 'type', header: 'Report', cell: (s) => titleOf(s.report_type) },
            {
              key: 'visibility',
              header: 'Shared',
              cell: (s) => (s.visibility === 'workspace' ? <StatusBadge tone="info">Workspace</StatusBadge> : 'Only me'),
            },
            { key: 'owner', header: 'Owner', cell: (s) => s.owner_name ?? '—' },
            { key: 'schedules', header: 'Schedules', align: 'right', cell: (s) => s.schedule_count || '—' },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              cell: (s) =>
                s.can_edit ? (
                  <span className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={s.pinned ? `Unpin ${s.name}` : `Pin ${s.name}`}
                      aria-pressed={s.pinned}
                      onClick={() =>
                        void changeSaved(
                          () => updateSavedReportApi(workspaceId, s.id, { pinned: !s.pinned }),
                          s.pinned ? 'Unpinned.' : 'Pinned.',
                        )
                      }
                    >
                      <Pin className={s.pinned ? 'h-4 w-4 fill-current text-primary' : 'h-4 w-4'} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => setDeleting(s)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      </section>

      <section aria-labelledby="jobs-heading" className="space-y-3">
        <h2 id="jobs-heading" className="text-lg font-semibold">
          Recent exports
        </h2>
        <DataTable
          caption="Recent exports"
          rows={jobs?.data ?? []}
          rowKey={(j) => j.id}
          animate={false}
          loading={!jobs ? <Skeleton className="h-24" /> : undefined}
          empty={<p className="text-sm text-muted-foreground">Exports prepared in the background are kept here for a while.</p>}
          columns={[
            {
              key: 'report',
              header: 'Report',
              cell: (j) => (
                <Link to={`/reports/jobs/${j.id}?workspace=${encodeURIComponent(workspaceId)}`} className="hover:underline">
                  {titleOf(j.report_type)}
                </Link>
              ),
            },
            { key: 'format', header: 'Format', cell: (j) => j.format.toUpperCase() },
            {
              key: 'status',
              header: 'Status',
              cell: (j) => <StatusBadge tone={JOB_TONE[j.status] ?? 'neutral'}>{j.status}</StatusBadge>,
            },
            { key: 'created', header: 'Requested', cell: (j) => formatServerDateTime(j.created_at) },
            {
              key: 'download',
              header: <span className="sr-only">Download</span>,
              align: 'right',
              cell: (j) =>
                j.download_path ? (
                  <Button variant="ghost" size="sm" onClick={() => void download(j)} disabled={downloading === j.id}>
                    {downloading === j.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden />
                    )}
                    Download
                  </Button>
                ) : null,
            },
          ]}
        />
      </section>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Its schedules stop too. The reports themselves are not affected."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await changeSaved(() => deleteSavedReportApi(workspaceId, deleting.id), 'Deleted.');
          setDeleting(null);
        }}
      />

      {settingsOpen && workspace && (
        <ReportsSettingsDialog
          open
          onOpenChange={setSettingsOpen}
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          settings={catalog.settings}
          onSaved={onSettingsSaved}
        />
      )}
    </PageContainer>
  );
};

export default ReportsHome;
