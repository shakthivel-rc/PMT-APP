import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ListTodo,
  Loader2,
  Play,
  Plus,
  Search,
  Square,
  Target,
  Trash2,
  TrendingDown,
  X,
  Zap,
  Sparkles,
} from 'lucide-react';
import { PlanningPokerPanel } from './PlanningPokerPanel';
import { SprintRetroPanel } from './SprintRetroPanel';
import { toast } from 'sonner';
import { fetchReportCatalogApi } from '@/api/reports';
import {
  addSprintIssuesApi,
  closeSprintApi,
  createSprintApi,
  deleteSprintApi,
  fetchSprintIssuesApi,
  fetchSprintsApi,
  removeSprintIssuesApi,
  startSprintApi,
} from '@/api/sprints';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { IssueCard } from '@/types';
import type { SprintSummary } from '@/types/sprints';
import { addDays, formatDateKey, parseDateKey, toDateKey } from '@/lib/week';
import { useKeyed } from '@/features/reports/useKeyed';
import { cn } from '@/lib/utils';
import { IssueTypeBadge, PriorityBadge } from '@/features/projects/presentation';

const STATE_TONE: Record<string, 'success' | 'info' | 'neutral'> = {
  active: 'success',
  planned: 'info',
  closed: 'neutral',
};

export function sprintReportHref(
  workspaceId: string,
  sprint: SprintSummary,
  type: 'sprint_report' | 'burndown' = 'sprint_report',
) {
  const query = new URLSearchParams({
    workspace: workspaceId,
    scope: `space:${sprint.space_id}`,
    sprint_id: sprint.id,
  });
  return `/reports/${type}?${query.toString()}`;
}

export interface SprintPanelProps {
  workspaceId: string;
  spaceId: string;
  spaceName?: string;
  /** Issues of the list on screen — what "Add issues" offers. */
  candidates: IssueCard[];
  /** Called after issues move in or out, so the board can refresh its cards. */
  onIssuesChanged?: () => void;
}

function range(sprint: SprintSummary): string {
  if (!sprint.starts_on && !sprint.ends_on) return 'No dates yet';
  return `${sprint.starts_on ? formatDateKey(sprint.starts_on) : '?'} – ${
    sprint.ends_on ? formatDateKey(sprint.ends_on) : '?'
  }`;
}

function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'Not recorded';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getDaysRemaining(endsOn: string | null): string | null {
  if (!endsOn) return null;
  const end = parseDateKey(endsOn);
  if (!end) return null;
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Ends today';
  if (diffDays === 1) return '1 day remaining';
  return `${diffDays} days remaining`;
}

/**
 * Detailed Issues inside a sprint with search & quick add.
 */
function SprintIssues({
  workspaceId,
  sprint,
  candidates,
  canManage,
  onChanged,
}: {
  workspaceId: string;
  sprint: SprintSummary;
  candidates: IssueCard[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [version, setVersion] = useState(0);
  const issues = useKeyed(`${sprint.id}|${version}`, () => fetchSprintIssuesApi(workspaceId, sprint.id));
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const inSprint = new Set((issues?.data ?? []).map((i) => i.id));
  const availableCandidates = candidates.filter((c) => !inSprint.has(c.id));
  const filteredCandidates = availableCandidates.filter(
    (c) =>
      c.key.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.title.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const editable = canManage && sprint.state !== 'closed';

  const change = async (run: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await run();
      toast.success(done);
      setAdding(new Set());
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const selectedPoints = useMemo(() => {
    return availableCandidates
      .filter((c) => adding.has(c.id))
      .reduce((sum, c) => sum + (c.story_points || 0), 0);
  }, [availableCandidates, adding]);

  return (
    <div className="space-y-4 pt-3 border-t">
      {!issues && <p className="text-sm text-muted-foreground">Loading issues…</p>}
      {issues?.error && <FormMessage>{issues.error}</FormMessage>}

      {issues?.data && issues.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No issues in this sprint yet.
        </div>
      )}

      {issues?.data && issues.data.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            <span>Sprint Issues ({issues.data.length})</span>
            <span>
              {issues.data.reduce((sum, i) => sum + (i.story_points || 0), 0)} Total Points
            </span>
          </div>

          <ul className="divide-y divide-border rounded-lg border bg-card overflow-hidden" aria-label={`Issues in ${sprint.name}`}>
            {issues.data.map((issue) => (
              <li
                key={issue.id}
                className="flex items-center justify-between gap-3 p-2.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <IssueTypeBadge type={issue.type} />
                  <span className="font-mono text-xs font-semibold text-muted-foreground shrink-0">
                    {issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={issue.title}>
                    {issue.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={issue.priority} />
                  {issue.story_points !== null && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                      {issue.story_points} pts
                    </span>
                  )}
                  {issue.assignee && (
                    <span
                      className="text-xs text-muted-foreground truncate max-w-28 hidden sm:inline"
                      title={issue.assignee.display_name}
                    >
                      {issue.assignee.display_name}
                    </span>
                  )}
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${issue.key} from the sprint`}
                      title={`Remove ${issue.key} from sprint`}
                      disabled={busy}
                      onClick={() =>
                        void change(
                          () => removeSprintIssuesApi(workspaceId, sprint.id, [issue.id]),
                          `Removed ${issue.key}.`,
                        )
                      }
                      className="text-muted-foreground hover:text-danger"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidate Issues / Add from list */}
      {editable && availableCandidates.length > 0 && (
        <fieldset className="grid gap-2.5 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <legend className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ListTodo className="size-3.5 text-primary" />
              <span>Add from this list ({availableCandidates.length} available)</span>
            </legend>
            {availableCandidates.length > 5 && (
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter available..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            )}
          </div>

          <div className="grid max-h-48 gap-1 overflow-y-auto pr-1">
            {filteredCandidates.map((issue) => (
              <label
                key={issue.id}
                className="flex items-center gap-2.5 rounded-md p-1.5 text-sm transition-colors hover:bg-muted/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded accent-primary cursor-pointer shrink-0"
                  checked={adding.has(issue.id)}
                  onChange={(e) =>
                    setAdding((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.add(issue.id);
                      else next.delete(issue.id);
                      return next;
                    })
                  }
                />
                <IssueTypeBadge type={issue.type} />
                <span className="font-mono text-xs text-muted-foreground shrink-0">{issue.key}</span>
                <span className="truncate flex-1 font-medium text-foreground">{issue.title}</span>
                {issue.story_points !== null && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {issue.story_points} pts
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-2xs text-muted-foreground">
              {adding.size > 0
                ? `${adding.size} selected · ${selectedPoints} pts`
                : 'Check issues to include in this sprint'}
            </span>
            <Button
              size="sm"
              variant="default"
              disabled={busy || adding.size === 0}
              onClick={() =>
                void change(
                  () => addSprintIssuesApi(workspaceId, sprint.id, [...adding]),
                  `Added ${adding.size} issue(s).`,
                )
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Plus className="size-3.5 mr-1.5" aria-hidden="true" />}
              Add {adding.size || ''} to sprint
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

/**
 * Sprint Activity, Timeline & Performance Feed.
 */
function SprintActivity({ sprint }: { sprint: SprintSummary }) {
  const completionRate =
    sprint.points > 0
      ? Math.round((sprint.done_points / sprint.points) * 100)
      : sprint.done_issue_count > 0
        ? 100
        : 0;

  const issueCompletionRate =
    sprint.issue_count > 0
      ? Math.round((sprint.done_issue_count / sprint.issue_count) * 100)
      : 0;

  return (
    <div className="space-y-4 pt-3 border-t">
      {/* Timeline Section */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="size-3.5 text-primary" />
          <span>Sprint Lifecycle Timeline</span>
        </h4>

        <div className="relative pl-6 space-y-3 text-xs before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {/* Planned / Created */}
          <div className="relative">
            <div className="absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary">
              <CalendarPlus className="size-2.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Sprint Planned & Configured</p>
              <p className="text-muted-foreground text-2xs">
                Created on {formatTimestamp(sprint.created_at)}
              </p>
            </div>
          </div>

          {/* Started */}
          <div className="relative">
            <div
              className={cn(
                'absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full',
                sprint.started_at ? 'bg-success-subtle text-success' : 'bg-muted text-muted-foreground',
              )}
            >
              <Play className="size-2.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {sprint.started_at ? 'Sprint Started (Commitment Frozen)' : 'Sprint Start (Pending)'}
              </p>
              <p className="text-muted-foreground text-2xs">
                {sprint.started_at
                  ? `Commenced on ${formatTimestamp(sprint.started_at)} · ${
                      sprint.committed_points !== null
                        ? `${sprint.committed_points} pts locked as baseline commitment`
                        : 'Commitment recorded'
                    }`
                  : 'Start date will freeze the initial story points commitment for velocity tracking.'}
              </p>
            </div>
          </div>

          {/* Planned Window */}
          <div className="relative">
            <div className="absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full bg-info-subtle text-info">
              <Calendar className="size-2.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Sprint Target Schedule</p>
              <p className="text-muted-foreground text-2xs">
                {range(sprint)}
                {sprint.state === 'active' && sprint.ends_on && ` · (${getDaysRemaining(sprint.ends_on)})`}
              </p>
            </div>
          </div>

          {/* Closed */}
          <div className="relative">
            <div
              className={cn(
                'absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full',
                sprint.state === 'closed' ? 'bg-neutral text-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              <CheckCircle2 className="size-2.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {sprint.state === 'closed'
                  ? 'Sprint Closed & Completed'
                  : sprint.state === 'active'
                    ? 'Sprint In Progress'
                    : 'Sprint Pending Start'}
              </p>
              <p className="text-muted-foreground text-2xs">
                {sprint.closed_at
                  ? `Closed on ${formatTimestamp(sprint.closed_at)} · Delivered ${
                      sprint.completed_points ?? sprint.done_points
                    } completed story points`
                  : sprint.state === 'active'
                    ? `Currently active with ${sprint.done_points} of ${sprint.points} points delivered so far.`
                    : 'Unfinished issues will be carried over to backlog or next sprint upon completion.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Health & Velocity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
          <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
            Story Points Completion
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">{completionRate}%</span>
            <span className="text-xs text-muted-foreground">
              {sprint.done_points} / {sprint.points} pts
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-success transition-all duration-300" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
          <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
            Issues Delivered
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">{issueCompletionRate}%</span>
            <span className="text-xs text-muted-foreground">
              {sprint.done_issue_count} / {sprint.issue_count} issues
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${issueCompletionRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SprintPoker({
  workspaceId,
  sprint,
  candidates,
  canManage,
  onChanged,
}: {
  workspaceId: string;
  sprint: SprintSummary;
  candidates: IssueCard[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [version, setVersion] = useState(0);
  const issues = useKeyed(`${sprint.id}|poker|${version}`, () => fetchSprintIssuesApi(workspaceId, sprint.id));
  const sprintIssuesList = (issues?.data && issues.data.length > 0) ? issues.data : candidates;

  return (
    <PlanningPokerPanel
      workspaceId={workspaceId}
      sprintId={sprint.id}
      sprintIssues={sprintIssuesList}
      canManage={canManage}
      onStoryPointsAssigned={() => {
        setVersion((v) => v + 1);
        onChanged();
      }}
    />
  );
}

/**
 * Enhanced SprintPanel Component:
 * Provides informative metrics, visual progress, tabbed issue/activity view, and quick duration presets.
 */
export function SprintPanel({
  workspaceId,
  spaceId,
  candidates,
  onIssuesChanged,
}: SprintPanelProps) {
  const [version, setVersion] = useState(0);
  const sprints = useKeyed(`${workspaceId}|${spaceId}|${version}`, () => fetchSprintsApi(workspaceId, spaceId));
  const catalog = useKeyed(workspaceId, () => fetchReportCatalogApi(workspaceId));
  const canManage = catalog?.data?.can_manage_sprints ?? false;

  const [open, setOpen] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'issues' | 'poker' | 'retro' | 'activity'>>({});
  const [filterState, setFilterState] = useState<'all' | 'active' | 'planned' | 'closed'>('all');

  // Create state
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startsOn, setStartsOn] = useState(toDateKey(new Date()));
  const [endsOn, setEndsOn] = useState(toDateKey(addDays(new Date(), 13)));

  // Close sprint state
  const [closing, setClosing] = useState<SprintSummary | null>(null);
  const [carryTo, setCarryTo] = useState('backlog');

  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reload = () => setVersion((v) => v + 1);
  const list = sprints?.data ?? [];

  const active = list.find((s) => s.state === 'active');
  const planned = list.filter((s) => s.state === 'planned');
  const closed = list.filter((s) => s.state === 'closed');

  const filteredList = useMemo(() => {
    if (filterState === 'active') return list.filter((s) => s.state === 'active');
    if (filterState === 'planned') return list.filter((s) => s.state === 'planned');
    if (filterState === 'closed') return list.filter((s) => s.state === 'closed');
    return list;
  }, [list, filterState]);

  const act = async (label: string, run: () => Promise<unknown>, done: string) => {
    setBusy(label);
    setFailure(null);
    try {
      await run();
      toast.success(done);
      reload();
      return true;
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setFailure('Name the sprint.');
    const ok = await act(
      'create',
      () =>
        createSprintApi(workspaceId, spaceId, {
          name: name.trim(),
          goal: goal.trim() || null,
          starts_on: startsOn || null,
          ends_on: endsOn || null,
        }),
      'Sprint planned.',
    );
    if (ok) {
      setCreating(false);
      setName('');
      setGoal('');
    }
  };

  const close = async () => {
    if (!closing) return;
    const ok = await act(
      `close-${closing.id}`,
      () =>
        closeSprintApi(
          workspaceId,
          closing.id,
          carryTo === 'backlog'
            ? { carry_over: 'backlog' }
            : { carry_over: 'sprint', target_sprint_id: carryTo },
        ),
      `${closing.name} closed.`,
    );
    if (ok) {
      setClosing(null);
      onIssuesChanged?.();
    }
  };

  // Quick duration helper (1w, 2w, 3w, 4w)
  const applyDurationDays = (days: number) => {
    const start = startsOn ? parseDateKey(startsOn) ?? new Date() : new Date();
    const end = addDays(start, days - 1);
    setEndsOn(toDateKey(end));
  };

  return (
    <div className="space-y-4" data-testid="sprint-panel">
      {failure && <FormMessage>{failure}</FormMessage>}
      {!sprints && <p className="text-sm text-muted-foreground">Loading sprints…</p>}
      {sprints?.error && <FormMessage>{sprints.error}</FormMessage>}
      {sprints?.data && list.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
          <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-violet-500/10 text-violet-500">
            <Zap className="size-6 fill-violet-500/20" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No sprints in this project yet.</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Sprints group project issues into focused iterations with target commitments and burndown tracking.
            </p>
          </div>
          {canManage && !creating && (
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="size-4 mr-1.5" /> Plan a sprint
            </Button>
          )}
        </div>
      )}

      {/* Header Bar with Filter Tabs & Actions */}
      {list.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterState('all')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filterState === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              All Sprints ({list.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('active')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filterState === 'active'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {active && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              <span>Active ({active ? 1 : 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterState('planned')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filterState === 'planned'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Planned ({planned.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('closed')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filterState === 'closed'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Closed ({closed.length})
            </button>
          </div>

          {canManage && !creating && (
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shrink-0 self-start sm:self-auto font-medium"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-3.5 mr-1" aria-hidden="true" /> Plan a sprint
            </Button>
          )}
        </div>
      )}

      {/* Plan a Sprint Form */}
      {canManage && creating && (
        <form
          onSubmit={create}
          className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-sm"
          aria-label="Plan a sprint"
        >
          <div className="flex items-center justify-between border-b pb-2.5">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="size-4 text-violet-500" /> Plan a New Sprint
            </h4>
            <span className="text-2xs text-muted-foreground">Define sprint goals & iteration timeframe</span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sprint-goal">Goal</Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              rows={2}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What is the objective or deliverable for this sprint?"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Duration Presets</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="px-2 text-2xs h-6 w-auto"
                  onClick={() => applyDurationDays(7)}
                >
                  1 Week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="px-2 text-2xs h-6 w-auto"
                  onClick={() => applyDurationDays(14)}
                >
                  2 Weeks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="px-2 text-2xs h-6 w-auto"
                  onClick={() => applyDurationDays(21)}
                >
                  3 Weeks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="px-2 text-2xs h-6 w-auto"
                  onClick={() => applyDurationDays(28)}
                >
                  4 Weeks
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="grid gap-1.5">
                <Label htmlFor="sprint-start">Starts</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sprint-end">Ends</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button type="submit" size="sm" disabled={busy !== null}>
              {busy === 'create' && <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />}
              Plan sprint
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Sprints List */}
      <div className="space-y-4">
        {filteredList.length === 0 && list.length > 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
            <p className="text-sm font-semibold">No {filterState} sprints</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {filterState === 'active'
                ? 'There is no sprint currently active in this project.'
                : filterState === 'planned'
                  ? 'No upcoming sprints have been planned yet.'
                  : 'No sprints have been completed and closed yet.'}
            </p>
          </div>
        )}
        {filteredList.map((sprint) => {
          const isExpanded = open === sprint.id;
          const currentSubTab = activeTab[sprint.id] || 'issues';
          const completionPct =
            sprint.points > 0
              ? Math.round((sprint.done_points / sprint.points) * 100)
              : sprint.done_issue_count > 0
                ? 100
                : 0;
          const daysRemain = sprint.state === 'active' ? getDaysRemaining(sprint.ends_on) : null;

          return (
            <article
              key={sprint.id}
              className={cn(
                'grid gap-3 rounded-xl border bg-card p-4 transition-all shadow-xs',
                sprint.state === 'active' && 'border-primary/40 ring-1 ring-primary/20',
              )}
              aria-label={sprint.name}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    className="mt-1 rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors shrink-0"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Hide' : 'Show'} issues of ${sprint.name}`}
                    onClick={() => setOpen(isExpanded ? null : sprint.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden="true" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-foreground tracking-tight">
                        {sprint.name}
                      </span>
                      <StatusBadge tone={STATE_TONE[sprint.state] ?? 'neutral'}>
                        {sprint.state}
                      </StatusBadge>
                      {daysRemain && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                          {daysRemain}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>{range(sprint)}</span>
                      <span>·</span>
                      <span>{sprint.issue_count} issues</span>
                      <span>·</span>
                      <span>{sprint.done_points}/{sprint.points} pts done</span>
                      {sprint.committed_points !== null && (
                        <>
                          <span>·</span>
                          <span>committed {sprint.committed_points}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {sprint.state !== 'planned' && (
                    <>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={sprintReportHref(workspaceId, sprint)}>
                          <BarChart3 className="size-3.5 mr-1" aria-hidden="true" /> Sprint report
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={sprintReportHref(workspaceId, sprint, 'burndown')}>
                          <TrendingDown className="size-3.5 mr-1" aria-hidden="true" /> Burndown
                        </Link>
                      </Button>
                    </>
                  )}

                  {canManage && sprint.state === 'planned' && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={busy !== null || Boolean(active)}
                        title={active ? `${active.name} is still active.` : undefined}
                        onClick={() =>
                          void act(
                            `start-${sprint.id}`,
                            () =>
                              startSprintApi(workspaceId, sprint.id, {
                                starts_on: sprint.starts_on ?? toDateKey(new Date()),
                                ends_on: sprint.ends_on ?? toDateKey(addDays(new Date(), 13)),
                              }),
                            `${sprint.name} started.`,
                          )
                        }
                      >
                        {busy === `start-${sprint.id}` ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                        ) : (
                          <Play className="size-3.5 mr-1.5 fill-current" aria-hidden="true" />
                        )}
                        Start
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Delete ${sprint.name}`}
                        title={`Delete ${sprint.name}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `delete-${sprint.id}`,
                            () => deleteSprintApi(workspaceId, sprint.id),
                            `${sprint.name} deleted.`,
                          )
                        }
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  )}

                  {canManage && sprint.state === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => setClosing(sprint)}
                      className="border-danger/30 text-danger hover:bg-danger-subtle"
                    >
                      <Square className="size-3.5 mr-1.5" aria-hidden="true" /> Close
                    </Button>
                  )}
                </div>
              </div>

              {/* Goal Callout */}
              {sprint.goal && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs flex items-start gap-2">
                  <Target className="size-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-semibold text-foreground">Goal: </span>
                    <span className="text-muted-foreground">{sprint.goal}</span>
                  </div>
                </div>
              )}

              {/* Informative Progress Dashboard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
                  <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Points Done
                  </span>
                  <div className="font-bold text-sm text-foreground">
                    {sprint.done_points} <span className="text-2xs text-muted-foreground font-normal">/ {sprint.points} pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success transition-all duration-300"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
                  <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Issues Done
                  </span>
                  <div className="font-bold text-sm text-foreground">
                    {sprint.done_issue_count} <span className="text-2xs text-muted-foreground font-normal">/ {sprint.issue_count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${
                          sprint.issue_count > 0
                            ? Math.round((sprint.done_issue_count / sprint.issue_count) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
                  <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Committed
                  </span>
                  <div className="font-bold text-sm text-foreground">
                    {sprint.committed_points !== null ? `${sprint.committed_points} pts` : 'Pending'}
                  </div>
                  <p className="text-2xs text-muted-foreground truncate">
                    {sprint.started_at ? 'Baseline frozen' : 'Freezes on start'}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
                  <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Completion Rate
                  </span>
                  <div className="font-bold text-sm text-foreground">
                    {completionPct}%
                  </div>
                  <p className="text-2xs text-muted-foreground truncate">
                    {sprint.canceled_issue_count > 0 ? `${sprint.canceled_issue_count} canceled` : 'Target 100%'}
                  </p>
                </div>
              </div>

              {/* Close Sprint confirmation */}
              {closing?.id === sprint.id && (
                <div
                  className="grid gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle p-3.5"
                  role="group"
                  aria-label={`Close ${sprint.name}`}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-danger">Close {sprint.name}?</p>
                    <p className="text-2xs text-muted-foreground">
                      Completed issues will remain in this sprint. Choose where unfinished issues should move:
                    </p>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="carry-over" className="text-xs">Unfinished issues go to</Label>
                    <Select value={carryTo} onValueChange={setCarryTo}>
                      <SelectTrigger id="carry-over" className="w-full h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">The backlog</SelectItem>
                        {planned.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="destructive" onClick={() => void close()} disabled={busy !== null}>
                      {busy === `close-${sprint.id}` && (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                      )}
                      Close sprint
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Expanded details: Tabs for Issues vs Activity */}
              {isExpanded && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab((prev) => ({ ...prev, [sprint.id]: 'issues' }))
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        currentSubTab === 'issues'
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <ListTodo className="size-3.5" />
                      <span>Sprint Issues ({sprint.issue_count})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab((prev) => ({ ...prev, [sprint.id]: 'poker' }))
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        currentSubTab === 'poker'
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Sparkles className="size-3.5 text-violet-500" />
                      <span>Planning Poker</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab((prev) => ({ ...prev, [sprint.id]: 'retro' }))
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        currentSubTab === 'retro'
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Sparkles className="size-3.5 text-amber-500" />
                      <span>Retrospective</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab((prev) => ({ ...prev, [sprint.id]: 'activity' }))
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        currentSubTab === 'activity'
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Activity className="size-3.5" />
                      <span>Activity & Timeline</span>
                    </button>
                  </div>

                  {currentSubTab === 'issues' ? (
                    <SprintIssues
                      workspaceId={workspaceId}
                      sprint={sprint}
                      candidates={candidates}
                      canManage={canManage}
                      onChanged={() => {
                        reload();
                        onIssuesChanged?.();
                      }}
                    />
                  ) : currentSubTab === 'poker' ? (
                    <SprintPoker
                      workspaceId={workspaceId}
                      sprint={sprint}
                      candidates={candidates}
                      canManage={canManage}
                      onChanged={() => {
                        reload();
                        onIssuesChanged?.();
                      }}
                    />
                  ) : currentSubTab === 'retro' ? (
                    <SprintRetroPanel
                      workspaceId={workspaceId}
                      sprint={sprint}
                      canManage={canManage}
                    />
                  ) : (
                    <SprintActivity sprint={sprint} />
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Velocity Report shortcut */}
      {list.some((s) => s.state === 'closed') && (
        <div className="pt-2">
          <Button variant="link" className="justify-self-start px-0 text-xs" asChild>
            <Link
              to={`/reports/velocity?${new URLSearchParams({
                workspace: workspaceId,
                scope: `space:${spaceId}`,
              }).toString()}`}
            >
              <TrendingDown className="size-3.5 mr-1" />
              Velocity of this project
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default SprintPanel;
