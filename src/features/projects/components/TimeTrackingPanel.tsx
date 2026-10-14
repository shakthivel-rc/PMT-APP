import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { Clock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppSelector } from '@/app/hooks';
import { ApiError } from '@/api/client';
import { updateIssueApi } from '@/api/issues';
import {
  createTimeEntryApi,
  deleteTimeEntryApi,
  fetchIssueTimeApi,
  updateTimeEntryApi,
} from '@/api/timeTracking';
import { fetchMembersApi } from '@/api/workspaces';
import type {
  IssueCard,
  IssueDetail,
  IssueTimeTracking,
  MemberSummary,
  TimeEntryCreate,
  TimeEntrySummary,
  TimeEntryUpdate,
  TimeTrackingSettings,
} from '@/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { durationInput, formatDuration } from '@/lib/duration';
import { durationProblem, parseDuration, type DurationUnits } from '@/lib/durationParse';
import { formatServerDateTime, parseServerDate } from '@/lib/datetime';
import { formatDateKey, parseDateKey, toDateKey } from '@/lib/week';
import { cn } from '@/lib/utils';
import { errorMessage } from '../presentation';
import TimerButton from './TimerButton';

/*
 * The issue drawer's time section: totals against the estimate, the roll-up over sub-issues,
 * who logged what, the work log, and the forms to add to it.
 *
 * Self-contained like the thread summary beside it — its own fetch, its own failure, its own
 * "switched off" state — and deliberately NOT part of the drawer's `Promise.all`: a time
 * service that fails must not blank the issue it sits under. Its failure is said in muted
 * text rather than an alert; the drawer's one alert is reserved for the issue itself.
 *
 * Notes are plain text rendered as text nodes, like every other user-written string in the
 * drawer (see the comment at the top of IssueDrawer.tsx).
 */

const NOTE_MAX = 2000;

const unitsOf = (settings: TimeTrackingSettings): DurationUnits => ({
  hoursPerDay: settings.hours_per_day,
  daysPerWeek: settings.days_per_week,
});

/** The local wall-clock time (`HH:MM`) of a server instant, for a `type="time"` input. */
const localTime = (iso: string | null): string => {
  if (!iso) return '';
  const date = parseServerDate(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** A local day and wall-clock time as an instant with its offset, which the API requires. */
const startedAt = (day: string, time: string): string | null => {
  const date = parseDateKey(day);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!date || !match) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toISOString();
};

interface EntryFormProps {
  workspaceId: string;
  issueId: string;
  settings: TimeTrackingSettings;
  /** The entry being edited; absent to log a new one. */
  entry?: TimeEntrySummary;
  canLogForOthers: boolean;
  currentUserId: string | undefined;
  onSaved: (entry: TimeEntrySummary) => void;
  onCancel: () => void;
}

/** Log time, or change an entry. Remounted per use (by `key`), so it starts from its props. */
const EntryForm = ({
  workspaceId,
  issueId,
  settings,
  entry,
  canLogForOthers,
  currentUserId,
  onSaved,
  onCancel,
}: EntryFormProps) => {
  const prefix = entry ? `edit-${entry.id}` : 'log-time';
  const [duration, setDuration] = useState(entry ? durationInput(entry.duration_seconds) : '');
  const [day, setDay] = useState(() => entry?.work_date ?? toDateKey(new Date()));
  const [time, setTime] = useState(localTime(entry?.started_at ?? null));
  const [note, setNote] = useState(entry?.note ?? '');
  // Older payloads (and test fixtures) may lack the flag; billable is the API's default too.
  const [billable, setBillable] = useState(entry?.billable ?? settings.billable_default ?? true);
  const [worker, setWorker] = useState(currentUserId ?? '');
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!canLogForOthers || entry) return;
    let cancelled = false;
    fetchMembersApi(workspaceId)
      .then((all) => {
        // Guests cannot log time themselves, so the API refuses logging it for them.
        if (!cancelled) setMembers(all.filter((m) => m.role !== 'guest'));
      })
      .catch(() => {
        // Without the list the form still logs your own time, which is what most people want.
      });
    return () => {
      cancelled = true;
    };
  }, [canLogForOthers, entry, workspaceId]);

  const units = unitsOf(settings);
  const problem = durationProblem(duration, units);
  const shownProblem = problem && (revealed || !problem.incomplete) ? problem.message : null;
  const seconds = parseDuration(duration, units);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setRevealed(true);
    if (problem || seconds === null) return;
    if (!parseDateKey(day)) {
      setFailure('Choose the day the work was done.');
      return;
    }
    const start = time ? startedAt(day, time) : null;
    startTransition(async () => {
      try {
        let saved: TimeEntrySummary;
        if (entry) {
          const body: TimeEntryUpdate = {};
          if (seconds !== entry.duration_seconds) body.duration_seconds = seconds;
          if (day !== entry.work_date) body.work_date = day;
          if (time !== localTime(entry.started_at)) body.started_at = start;
          if ((note.trim() || null) !== entry.note) body.note = note.trim() || null;
          if (billable !== (entry.billable ?? true)) body.billable = billable;
          saved = Object.keys(body).length ? await updateTimeEntryApi(workspaceId, entry.id, body) : entry;
        } else {
          const body: TimeEntryCreate = { duration_seconds: seconds, work_date: day };
          if (start) body.started_at = start;
          if (note.trim()) body.note = note.trim();
          if (worker && worker !== currentUserId) body.user_id = worker;
          if (billable !== (settings.billable_default ?? true)) body.billable = billable;
          saved = await createTimeEntryApi(workspaceId, issueId, body);
        }
        onSaved(saved);
      } catch (err) {
        setFailure(errorMessage(err));
      }
    });
  };

  const problemId = `${prefix}-duration-problem`;
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-muted/30 p-3" aria-label={entry ? 'Edit time entry' : 'Log time'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-duration`}>Time spent</Label>
          <Input
            id={`${prefix}-duration`}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => setRevealed(true)}
            placeholder="1h 30m"
            autoComplete="off"
            aria-invalid={shownProblem ? true : undefined}
            aria-describedby={shownProblem ? problemId : `${prefix}-duration-hint`}
          />
          {shownProblem ? (
            <p id={problemId} className="text-xs text-danger">
              {shownProblem}
            </p>
          ) : (
            <p id={`${prefix}-duration-hint`} className="text-xs text-muted-foreground">
              {seconds ? `= ${formatDuration(seconds)}` : `e.g. 1h 30m, 45m, 1d (${settings.hours_per_day}h)`}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-day`}>Day</Label>
          <Input id={`${prefix}-day`} type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-time`}>Started at (optional)</Label>
          <Input id={`${prefix}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {canLogForOthers && !entry && members.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-worker`}>Whose time</Label>
            <Select value={worker} onValueChange={setWorker}>
              <SelectTrigger id={`${prefix}-worker`} className="w-full">
                <SelectValue placeholder="You" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {`${m.first_name} ${m.last_name}`.trim() || m.email}
                    {m.user_id === currentUserId ? ' (you)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-note`}>What was done (optional)</Label>
        <Textarea id={`${prefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={NOTE_MAX} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id={`${prefix}-billable`} checked={billable} onCheckedChange={setBillable} />
        <Label htmlFor={`${prefix}-billable`}>Billable</Label>
      </div>
      {failure && <FormMessage>{failure}</FormMessage>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !duration.trim()}>
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {entry ? 'Save' : 'Log time'}
        </Button>
      </div>
    </form>
  );
};

interface EstimateProps {
  workspaceId: string;
  issue: IssueDetail;
  settings: TimeTrackingSettings;
  onChanged: (patch: Partial<IssueCard>) => void;
}

/** The first field the drawer edits: PATCH with the `version` read, and a 409 explained. */
const EstimateEditor = ({ workspaceId, issue, settings, onChanged }: EstimateProps) => {
  const [text, setText] = useState(issue.time_estimate_seconds ? durationInput(issue.time_estimate_seconds) : '');
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const units = unitsOf(settings);

  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setEditing(true)}
        aria-label="Edit estimate"
        className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1 font-medium transition-colors"
      >
        <Pencil className="size-3 text-amber-500" aria-hidden="true" />
        {issue.time_estimate_seconds ? 'Edit' : 'Add estimate'}
      </Button>
    );
  }

  const save = (event: FormEvent) => {
    event.preventDefault();
    const seconds = text.trim() ? parseDuration(text, units) : null;
    if (text.trim() && seconds === null) {
      setFailure('Use h and m, for example 4h or 2d.');
      return;
    }
    startTransition(async () => {
      try {
        const next = await updateIssueApi(workspaceId, issue.id, { version: issue.version, time_estimate_seconds: seconds });
        onChanged({ time_estimate_seconds: next.time_estimate_seconds, version: next.version });
        setEditing(false);
      } catch (err) {
        setFailure(
          err instanceof ApiError && err.status === 409
            ? 'Someone else changed this issue since you opened it. Close it and open it again, then set the estimate.'
            : errorMessage(err),
        );
      }
    });
  };

  return (
    <form onSubmit={save} className="mt-2 grid gap-2" aria-label="Set the estimate">
      <div className="flex items-center gap-2">
        <Label htmlFor="estimate-input" className="sr-only">
          Estimate
        </Label>
        <Input
          id="estimate-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="4h — empty to clear"
          className="h-8 w-40"
          autoComplete="off"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save estimate
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {failure && <FormMessage>{failure}</FormMessage>}
    </form>
  );
};

/** Logged against estimated, as a bar and in words. */
const Progress = ({ spent, estimate }: { spent: number; estimate: number }) => {
  const ratio = estimate > 0 ? Math.min(1, spent / estimate) : 1;
  const over = spent > estimate;
  return (
    <div
      role="progressbar"
      aria-label="Time logged against the estimate"
      aria-valuemin={0}
      aria-valuemax={estimate}
      aria-valuenow={Math.min(spent, estimate)}
      aria-valuetext={`${formatDuration(spent)} of ${formatDuration(estimate)}`}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-primary')} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
};

interface TimeTrackingPanelProps {
  workspaceId: string;
  issue: IssueDetail;
  /** May the caller edit the issue's fields (the estimate)? Members and above. */
  canWrite: boolean;
  /** Fields of the issue that changed here — time logged, estimate, version — for its card. */
  onIssueChange: (patch: Partial<IssueCard>) => void;
}

const TimeTrackingPanel = ({ workspaceId, issue, canWrite, onIssueChange }: TimeTrackingPanelProps) => {
  const [data, setData] = useState<IssueTimeTracking | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [mode, setMode] = useState<{ kind: 'idle' } | { kind: 'log' } | { kind: 'edit'; entry: TimeEntrySummary }>({ kind: 'idle' });
  const [deleting, setDeleting] = useState<TimeEntrySummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  // A timer started or stopped anywhere — the header included — may have logged time here.
  const timerChanges = useAppSelector((s) => s.timer.changes);

  useEffect(() => {
    let cancelled = false;
    fetchIssueTimeApi(workspaceId, issue.id)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setFailure(null);
        onIssueChange({ time_spent_seconds: next.summary.spent_seconds });
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
    // `onIssueChange` is a fresh closure every render of the drawer; re-reading the panel on
    // each of those would be a request per keystroke in the comment box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, issue.id, reloads, timerChanges]);

  const reload = () => setReloads((n) => n + 1);

  if (!data) {
    return (
      <section className="rounded-lg border p-3" aria-busy={!failure || undefined}>
        <h3 className="text-sm font-semibold">Time tracking</h3>
        {failure ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Time tracking could not be loaded. {failure}</span>
            <Button size="xs" variant="outline" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Loading time…</p>
        )}
      </section>
    );
  }

  const { summary, settings, entries } = data;
  const canLog = data.can_log;
  const subIssues =
    summary.rollup_spent_seconds !== summary.spent_seconds ||
    summary.rollup_estimate_seconds !== summary.estimate_seconds;

  const saved = (entry: TimeEntrySummary, verb: string) => {
    setMode({ kind: 'idle' });
    toast.success(`${verb} ${formatDuration(entry.duration_seconds)}.`);
    reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteTimeEntryApi(workspaceId, deleting.id);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Time tracking</h3>
        {canLog && (
          <div className="flex gap-2">
            <TimerButton workspaceId={workspaceId} issueId={issue.id} issueKey={issue.key} />
            {mode.kind !== 'log' && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/60 shadow-2xs font-medium gap-1.5 transition-colors"
                onClick={() => setMode({ kind: 'log' })}
              >
                <Clock className="size-3.5 text-blue-500" aria-hidden="true" />
                Log time
              </Button>
            )}
          </div>
        )}
      </div>

      {!settings.enabled && (
        <FormMessage variant="info">Time tracking is switched off in this workspace. Time already logged stays here.</FormMessage>
      )}

      <div className="space-y-2">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Logged</dt>
            <dd className="font-medium">{formatDuration(summary.spent_seconds)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estimate</dt>
            <dd className="font-medium">
              {summary.estimate_seconds === null ? '—' : formatDuration(summary.estimate_seconds)}
              {canWrite && (
                <EstimateEditor
                  key={`${issue.version}`}
                  workspaceId={workspaceId}
                  issue={issue}
                  settings={settings}
                  onChanged={(patch) => {
                    onIssueChange(patch);
                    reload();
                  }}
                />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Remaining</dt>
            <dd className="font-medium">
              {summary.remaining_seconds === null ? '—' : formatDuration(summary.remaining_seconds)}
            </dd>
          </div>
        </dl>
        {summary.estimate_seconds !== null && (
          <>
            <Progress spent={summary.spent_seconds} estimate={summary.estimate_seconds} />
            {summary.spent_seconds > summary.estimate_seconds && (
              <p className="text-xs text-danger">
                Over the estimate by {formatDuration(summary.spent_seconds - summary.estimate_seconds)}.
              </p>
            )}
          </>
        )}
        {subIssues && (
          <p className="text-xs text-muted-foreground">
            With sub-issues: {formatDuration(summary.rollup_spent_seconds)} logged
            {summary.rollup_estimate_seconds !== null && ` of ${formatDuration(summary.rollup_estimate_seconds)} estimated`}.
          </p>
        )}
      </div>

      {summary.by_user.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">By person</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {summary.by_user.map(({ user, seconds }) => (
              <li key={user.id} className="flex justify-between gap-3">
                <span className="truncate">{user.display_name || 'Former member'}</span>
                <span className="font-medium tabular-nums">{formatDuration(seconds)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode.kind === 'log' && (
        <EntryForm
          workspaceId={workspaceId}
          issueId={issue.id}
          settings={settings}
          canLogForOthers={data.can_log_for_others}
          currentUserId={currentUserId}
          onSaved={(entry) => saved(entry, 'Logged')}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      <div>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Work log ({data.entries_total})
        </h4>
        {entries.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No time logged yet.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {entries.map((entry) =>
              mode.kind === 'edit' && mode.entry.id === entry.id ? (
                <li key={entry.id}>
                  <EntryForm
                    key={entry.id}
                    workspaceId={workspaceId}
                    issueId={issue.id}
                    settings={settings}
                    entry={entry}
                    canLogForOthers={false}
                    currentUserId={currentUserId}
                    onSaved={(next) => saved(next, 'Saved')}
                    onCancel={() => setMode({ kind: 'idle' })}
                  />
                </li>
              ) : (
                <li key={entry.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.user.display_name || 'Former member'}</span>
                      {' · '}
                      <time dateTime={entry.work_date}>{formatDateKey(entry.work_date)}</time>
                      {entry.started_at && <> · from {formatServerDateTime(entry.started_at)}</>}
                      {entry.created_by.id !== entry.user.id && <> · logged by {entry.created_by.display_name}</>}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {entry.source === 'timer' && <StatusBadge tone="info">Timer</StatusBadge>}
                      {entry.billable === false ? (
                        <StatusBadge tone="neutral">Non-billable</StatusBadge>
                      ) : entry.cost_amount != null ? (
                        <StatusBadge tone="success">${entry.cost_amount.toFixed(2)}</StatusBadge>
                      ) : null}
                      <span className="text-sm font-semibold tabular-nums">{formatDuration(entry.duration_seconds)}</span>
                      {entry.can_edit && settings.enabled && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Edit ${formatDuration(entry.duration_seconds)} on ${formatDateKey(entry.work_date)}`}
                          onClick={() => setMode({ kind: 'edit', entry })}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      )}
                      {entry.can_edit && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${formatDuration(entry.duration_seconds)} on ${formatDateKey(entry.work_date)}`}
                          onClick={() => setDeleting(entry)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {entry.note && <p className="mt-1 text-sm break-words whitespace-pre-wrap">{entry.note}</p>}
                </li>
              ),
            )}
          </ol>
        )}
        {data.entries_total > entries.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the newest {entries.length} of {data.entries_total}. The timesheet has the rest.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this time?"
        description={
          deleting
            ? `${formatDuration(deleting.duration_seconds)} logged by ${deleting.user.display_name} on ${formatDateKey(deleting.work_date)} comes off the issue's total.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </section>
  );
};

export default TimeTrackingPanel;
