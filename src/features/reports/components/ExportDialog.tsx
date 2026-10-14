import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadReportJobApi, exportReportApi, saveFile, waitForReportJobApi } from '@/api/reports';
import FormMessage from '@/components/FormMessage';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { DateFormat, DurationFormat, ExportFormat, ReportJob, ReportParams } from '@/types/reports';

/*
 * Download a report as CSV, Excel or PDF (docs/design/08-reports.md §7). The API answers a
 * small export with the file itself, and a large one — or one asked to run in the
 * background — with a 202 and a job. This dialog then asks after the job until it is done
 * and downloads it; closing the dialog stops the asking, not the job, which the Reports home
 * keeps listing with its link for as long as the file is kept.
 */

const FORMAT_LABELS: Record<string, string> = { csv: 'CSV', xlsx: 'Excel (.xlsx)', pdf: 'PDF' };

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  reportType: string;
  title: string;
  params: ReportParams;
  formats: ExportFormat[];
  /** Poll interval; tests shorten it. */
  pollMs?: number;
}

export function ExportDialog({ open, onOpenChange, workspaceId, reportType, title, params, formats, pollMs }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(formats[0] ?? 'csv');
  const [durationFormat, setDurationFormat] = useState<DurationFormat>('decimal');
  const [dateFormat, setDateFormat] = useState<DateFormat>('iso');
  const [background, setBackground] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ReportJob | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const close = (next: boolean) => {
    if (!next) {
      controller.current?.abort();
      setBusy(false);
      setJob(null);
      setFailure(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    setBusy(true);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const outcome = await exportReportApi(workspaceId, reportType, {
        params,
        format,
        duration_format: durationFormat,
        date_format: dateFormat,
        background,
      });
      if (outcome.kind === 'file') {
        saveFile(outcome);
        toast.success(`Downloaded ${outcome.fileName}.`);
        close(false);
        return;
      }
      setJob(outcome.job);
      const finished = await waitForReportJobApi(workspaceId, outcome.job, {
        signal: abort.signal,
        onUpdate: setJob,
        intervalMs: pollMs,
      });
      if (finished.status === 'failed') {
        setFailure(finished.error || 'The export failed. Try again.');
        setBusy(false);
        return;
      }
      const file = await downloadReportJobApi(finished);
      saveFile(file);
      toast.success(`Downloaded ${file.fileName}.`);
      close(false);
    } catch (err) {
      if (abort.signal.aborted) return;
      setFailure(err instanceof Error ? err.message : 'The export failed. Try again.');
      setBusy(false);
    }
  };

  const durationOption = format !== 'pdf';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export report</DialogTitle>
          <DialogDescription>{title}, with the filters shown.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {formats.length === 0 ? (
            <FormMessage variant="info">Your role in this workspace cannot export reports. Ask an admin.</FormMessage>
          ) : (
            <form id="report-export" onSubmit={submit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="export-format">Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)} disabled={busy}>
                  <SelectTrigger id="export-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMAT_LABELS[f] ?? f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {durationOption && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="export-duration">Durations as</Label>
                    <Select value={durationFormat} onValueChange={(v) => setDurationFormat(v as DurationFormat)} disabled={busy}>
                      <SelectTrigger id="export-duration" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decimal">Hours (1.50)</SelectItem>
                        <SelectItem value="hhmm">Clock (1:30)</SelectItem>
                        <SelectItem value="iso">ISO 8601 (PT1H30M)</SelectItem>
                        <SelectItem value="seconds">Seconds (5400)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="export-dates">Dates as</Label>
                    <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateFormat)} disabled={busy}>
                      <SelectTrigger id="export-dates" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iso">2026-10-05</SelectItem>
                        <SelectItem value="normal">05 Oct 2026</SelectItem>
                        <SelectItem value="epoch">Unix time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="export-background" className="flex-col items-start gap-0.5">
                  <span>Prepare in the background</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Large exports always are. You can leave and download it from Reports later.
                  </span>
                </Label>
                <Switch id="export-background" checked={background} onCheckedChange={setBackground} disabled={busy} />
              </div>
              {job && (
                <p className="text-sm text-muted-foreground" role="status" data-testid="export-job-status">
                  {job.status === 'queued' && 'Queued — waiting for the report worker…'}
                  {job.status === 'running' && 'Preparing the file…'}
                  {job.status === 'done' && 'Ready — downloading…'}
                  {job.status === 'failed' && 'The export failed.'}{' '}
                  <Link to={`/reports/jobs/${job.id}?workspace=${encodeURIComponent(workspaceId)}`} className="underline">
                    Open the export
                  </Link>
                </p>
              )}
              {failure && <FormMessage>{failure}</FormMessage>}
            </form>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {job && busy ? 'Close — keep preparing' : 'Cancel'}
          </Button>
          {formats.length > 0 && (
            <Button type="submit" form="report-export" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
