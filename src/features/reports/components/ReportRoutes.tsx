import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadReportJobApi, fetchReportJobApi, fetchSavedReportApi, isFinishedJob, saveFile, waitForReportJobApi } from '@/api/reports';
import FormMessage from '@/components/FormMessage';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReportJob } from '@/types/reports';
import { formatServerDateTime } from '@/lib/datetime';
import { searchFromParams } from '../params';
import { useKeyed } from '../useKeyed';
import { useReportsWorkspace } from '../useReportsWorkspace';

/*
 * The two small routes around the report page:
 *
 * * `/reports/saved/:id` opens a saved report — by sending the browser to the report's own
 *   URL with the saved filters and `?saved=`, so a saved report is the same page, filters and
 *   all, as the report it was saved from.
 * * `/reports/jobs/:id` is an export prepared in the background: its state, asked after until
 *   it finishes, and the download. The export dialog links here, so leaving the dialog never
 *   loses the file.
 */

export function SavedReportRoute() {
  const { id = '' } = useParams();
  const { workspaceId, error } = useReportsWorkspace();
  const saved = useKeyed(workspaceId ? `${workspaceId}|${id}` : null, () => fetchSavedReportApi(workspaceId as string, id));

  if (error || saved?.error) {
    return (
      <PageContainer>
        <PageHeader title="Saved report" icon={BarChart3} />
        <FormMessage>{error ?? saved?.error}</FormMessage>
      </PageContainer>
    );
  }
  if (!saved?.data || !workspaceId) {
    return (
      <PageContainer>
        <Skeleton className="h-64" />
      </PageContainer>
    );
  }
  const query = searchFromParams(saved.data.params);
  query.set('workspace', workspaceId);
  query.set('saved', saved.data.id);
  return <Navigate to={`/reports/${saved.data.report_type}?${query.toString()}`} replace />;
}

const STATUS_TEXT: Record<string, string> = {
  queued: 'Queued — waiting for the report worker.',
  running: 'Preparing the file.',
  done: 'Ready to download.',
  failed: 'The export failed.',
};

export function ReportJobPage() {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const { workspaceId, error, catalog } = useReportsWorkspace();
  const loaded = useKeyed(workspaceId ? `${workspaceId}|${id}` : null, () => fetchReportJobApi(workspaceId as string, id));
  const [live, setLive] = useState<ReportJob | null>(null);
  const [downloading, setDownloading] = useState(false);
  const job = live && live.id === id ? live : (loaded?.data ?? null);

  useEffect(() => {
    const first = loaded?.data;
    if (!first || !workspaceId || isFinishedJob(first)) return;
    const controller = new AbortController();
    waitForReportJobApi(workspaceId, first, { signal: controller.signal, onUpdate: setLive }).catch(() => undefined);
    return () => controller.abort();
  }, [loaded?.data, workspaceId]);

  const download = async () => {
    if (!job) return;
    setDownloading(true);
    try {
      saveFile(await downloadReportJobApi(job));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const title = job ? (catalog?.reports.find((r) => r.type === job.report_type)?.title ?? job.report_type) : 'Export';
  const workspaceQuery = workspaceId ?? search.get('workspace');

  return (
    <PageContainer className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/reports${workspaceQuery ? `?workspace=${encodeURIComponent(workspaceQuery)}` : ''}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Reports
        </Link>
      </Button>
      <PageHeader title={`${title} export`} icon={FileDown} />
      {(error || loaded?.error) && <FormMessage>{error ?? loaded?.error}</FormMessage>}
      {!job && !error && !loaded?.error && <Skeleton className="h-32" />}
      {job && (
        <Card>
          <CardContent className="grid gap-3 pt-6 text-sm">
            <div className="flex items-center gap-2" role="status" data-testid="job-status">
              {!isFinishedJob(job) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              <StatusBadge tone={job.status === 'done' ? 'success' : job.status === 'failed' ? 'danger' : 'info'}>{job.status}</StatusBadge>
              <span>{STATUS_TEXT[job.status] ?? job.status}</span>
            </div>
            {job.status === 'failed' && job.error && <FormMessage>{job.error}</FormMessage>}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Format</dt>
              <dd>{job.format.toUpperCase()}</dd>
              <dt className="text-muted-foreground">Requested</dt>
              <dd>{formatServerDateTime(job.created_at)}</dd>
              {job.row_count !== null && (
                <>
                  <dt className="text-muted-foreground">Rows</dt>
                  <dd>{job.row_count}</dd>
                </>
              )}
              {job.expires_at && (
                <>
                  <dt className="text-muted-foreground">Kept until</dt>
                  <dd>{formatServerDateTime(job.expires_at)}</dd>
                </>
              )}
            </dl>
            {job.download_path && (
              <div>
                <Button onClick={() => void download()} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                  Download {job.file_name ?? ''}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
