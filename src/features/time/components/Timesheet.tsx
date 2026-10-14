import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, ChevronLeft, ChevronRight, Clock, Settings, Timer } from 'lucide-react';
import { fetchMembersApi, fetchWorkspacesApi } from '@/api/workspaces';
import { fetchTimeEntriesApi, fetchTimeReportApi, fetchTimeSettingsApi } from '@/api/timeTracking';
import {
  canManageWorkspace,
  type MemberSummary,
  type TimeEntryPage,
  type TimeEntrySummary,
  type TimeIssueRef,
  type TimeReport,
  type TimeTrackingSettings,
  type WorkspaceSummary,
} from '@/types';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import FormMessage from '@/components/FormMessage';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/duration';
import { addDays, dayLabel, formatDateKey, parseDateKey, startOfWeek, toDateKey, weekDays } from '@/lib/week';
import { buildGrid, type GridRow } from '../timesheetGrid';
import TimeSettingsDialog from './TimeSettingsDialog';

/*
 * The other half of "time on a ticket": time by *person*. Native Jira Cloud has no such
 * screen — it is the gap Tempo is bought to fill — so it is a first-class page here.
 *
 * Everything that picks what is shown lives in the URL (`?workspace=&week=&person=`), so a
 * sheet can be bookmarked or sent to someone. Stepping weeks `replace`s the entry, as the list
 * view does with `?view=`: flicking through weeks is not history Back should step through.
 *
 * Fetched data is stored with the key of the request that produced it, and a result is only
 * shown when its key is the current one. That is what stops a slow answer for last week from
 * being drawn as this week's after a quick click — and it lets "loading" be derived rather
 * than set in an effect, which the hooks lint rules forbid.
 */

const EVERYONE = 'everyone';
const PAGE_SIZE = 50;

interface Keyed<T> {
  key: string;
  data?: T;
  error?: string;
}

const message = (err: unknown) => (err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.');

const issueHref = (issue: TimeIssueRef) =>
  `/projects/${encodeURIComponent(issue.workspace_id)}/lists/${encodeURIComponent(issue.list_id)}?issue=${encodeURIComponent(issue.id)}`;

const IssueLink = ({ issue }: { issue: TimeIssueRef }) => (
  <Link to={issueHref(issue)} className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
    <span className="font-mono text-xs text-muted-foreground">{issue.key}</span> {issue.title}
  </Link>
);

/** Load once per key; the answer is kept with the key it answers. */
function useKeyed<T>(key: string | null, load: () => Promise<T>): Keyed<T> | null {
  const [state, setState] = useState<Keyed<T> | null>(null);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, data }),
      (err: unknown) => !cancelled && setState({ key, error: message(err) }),
    );
    return () => {
      cancelled = true;
    };
    // `load` closes over exactly what `key` spells out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state : null;
}

const Timesheet = () => {
  const [params, setParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<Keyed<TimeTrackingSettings> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState({ key: '', number: 1 });

  useEffect(() => {
    let cancelled = false;
    fetchWorkspacesApi().then(
      (all) => !cancelled && setWorkspaces(all),
      (err: unknown) => !cancelled && setWorkspacesError(message(err)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const workspace = workspaces?.find((w) => w.id === params.get('workspace')) ?? workspaces?.[0] ?? null;
  const workspaceId = workspace?.id ?? null;

  const loadedSettings = useKeyed(workspaceId, () => fetchTimeSettingsApi(workspaceId as string));
  const settings =
    savedSettings && savedSettings.key === workspaceId ? savedSettings.data : loadedSettings?.data;
  const isAdmin = workspace ? canManageWorkspace(workspace.role) : false;
  const seesOthers = isAdmin || settings?.visibility === 'everyone';

  const members = useKeyed(seesOthers ? workspaceId : null, () => fetchMembersApi(workspaceId as string));

  const anchor = parseDateKey(params.get('week') ?? '') ?? new Date();
  const start = startOfWeek(anchor, settings?.week_start ?? 'monday');
  const days = weekDays(start);
  const dayKeys = days.map(toDateKey);
  const range = { date_from: dayKeys[0], date_to: dayKeys[6] };
  const wantedPerson = params.get('person') ?? 'me';
  // Someone who cannot see others is asking about themselves, whatever the link said.
  const person = seesOthers ? wantedPerson : 'me';
  const userId = person === EVERYONE ? undefined : person;

  const sheetKey = settings && workspaceId ? `${workspaceId}|${range.date_from}|${person}` : null;
  const report = useKeyed<TimeReport>(sheetKey, () => fetchTimeReportApi(workspaceId as string, { ...range, user_id: userId }));
  const pageNumber = page.key === sheetKey ? page.number : 1;
  const entries = useKeyed<TimeEntryPage>(sheetKey && `${sheetKey}|${pageNumber}`, () =>
    fetchTimeEntriesApi(workspaceId as string, { ...range, user_id: userId, page: pageNumber, limit: PAGE_SIZE }),
  );

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [name, value] of Object.entries(changes)) {
          if (value === null) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );

  if (workspacesError) {
    return (
      <PageContainer>
        <PageHeader title="Timesheet" icon={Timer} />
        <FormMessage>{workspacesError}</FormMessage>
      </PageContainer>
    );
  }
  if (workspaces && workspaces.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Timesheet" icon={Timer} />
        <EmptyState
          icon={Clock}
          title="No workspaces yet"
          description="Time is logged on issues, and issues live in a workspace. Create or join one first."
        />
      </PageContainer>
    );
  }

  const byPerson = person === EVERYONE;
  const grid = report?.data ? buildGrid(report.data.rows, dayKeys, byPerson) : null;
  const todayKey = toDateKey(new Date());
  const columns: DataTableColumn<GridRow>[] = [
    { key: 'issue', header: 'Issue', cell: (row) => <IssueLink issue={row.issue} /> },
    ...(byPerson ? [{ key: 'person', header: 'Person', cell: (row: GridRow) => row.user?.display_name || 'Former member' }] : []),
    ...days.map((day, index) => ({
      key: dayKeys[index],
      header: <span className={dayKeys[index] === todayKey ? 'text-primary' : undefined}>{dayLabel(day)}</span>,
      align: 'right' as const,
      cell: (row: GridRow) => (row.days[dayKeys[index]] ? formatDuration(row.days[dayKeys[index]]) : '—'),
    })),
    { key: 'total', header: 'Total', align: 'right', cellClassName: 'font-semibold', cell: (row) => formatDuration(row.total) },
  ];
  const totals = grid
    ? {
        issue: 'Total',
        ...Object.fromEntries(dayKeys.map((key) => [key, formatDuration(grid.dayTotals[key])])),
        total: formatDuration(grid.total),
      }
    : undefined;

  const entryColumns: DataTableColumn<TimeEntrySummary>[] = [
    { key: 'day', header: 'Day', cell: (e) => <time dateTime={e.work_date}>{formatDateKey(e.work_date)}</time> },
    { key: 'issue', header: 'Issue', cell: (e) => <IssueLink issue={e.issue} /> },
    ...(byPerson ? [{ key: 'person', header: 'Person', cell: (e: TimeEntrySummary) => e.user.display_name || 'Former member' }] : []),
    {
      key: 'time',
      header: 'Time',
      align: 'right',
      cell: (e) => (
        <span className="inline-flex items-center gap-1.5">
          {e.source === 'timer' && <StatusBadge tone="info">Timer</StatusBadge>}
          {formatDuration(e.duration_seconds)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      cell: (e) => {
        if (!e.billable) {
          return <span className="text-2xs text-muted-foreground">Non-billable</span>;
        }
        if (e.cost_amount != null) {
          return (
            <span className="font-mono text-xs tabular-nums text-foreground">
              ${e.cost_amount.toFixed(2)}
              {e.billing_rate != null && (
                <span className="text-2xs text-muted-foreground ml-1">(@ ${e.billing_rate}/h)</span>
              )}
            </span>
          );
        }
        return '—';
      },
    },
    {
      key: 'note',
      header: 'Note',
      cellClassName: 'max-w-md',
      cell: (e) => <span className="line-clamp-2 break-words whitespace-pre-wrap text-muted-foreground">{e.note ?? ''}</span>,
    },
  ];

  const weekLabel = `${formatDateKey(dayKeys[0])} – ${formatDateKey(dayKeys[6])}`;
  const memberName = (m: MemberSummary) => `${m.first_name} ${m.last_name}`.trim() || m.email;

  return (
    <PageContainer>
      <PageHeader
        title="Timesheet"
        description="Time logged by person, by week."
        icon={Timer}
        actions={
          <>
            {workspaceId && (
              // The same week, grouped by person and project — and exportable.
              <Button variant="outline" asChild>
                <Link
                  to={`/reports/time_by_group?${new URLSearchParams({
                    workspace: workspaceId,
                    preset: 'custom',
                    date_from: range.date_from,
                    date_to: range.date_to,
                    group_by: 'user,project',
                  }).toString()}`}
                >
                  <BarChart3 className="size-4" aria-hidden="true" />
                  Reports
                </Link>
              </Button>
            )}
            {isAdmin && workspace && settings ? (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ts-workspace">Workspace</Label>
          {workspaces ? (
            <Select value={workspaceId ?? undefined} onValueChange={(id) => update({ workspace: id, person: null })}>
              <SelectTrigger id="ts-workspace" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-9 w-56" />
          )}
        </div>
        {seesOthers && (
          <div className="grid gap-1.5">
            <Label htmlFor="ts-person">Person</Label>
            <Select value={person} onValueChange={(value) => update({ person: value === 'me' ? null : value })}>
              <SelectTrigger id="ts-person" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Me</SelectItem>
                <SelectItem value={EVERYONE}>Everyone</SelectItem>
                {(members?.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {memberName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div role="group" aria-label="Week" className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => update({ week: toDateKey(addDays(start, -7)) })}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={() => update({ week: null })}>
            This week
          </Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => update({ week: toDateKey(addDays(start, 7)) })}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {weekLabel}
        {grid ? ` · ${formatDuration(grid.total)} logged` : ''}
        {entries?.data?.total_cost_amount != null && entries.data.total_cost_amount > 0 ? (
          <span className="ml-2 font-medium text-foreground">
            · Total value: ${entries.data.total_cost_amount.toFixed(2)} ({entries.data.currency || 'USD'})
          </span>
        ) : null}
      </p>

      {settings && !settings.enabled && (
        <FormMessage variant="info" className="mb-4">
          Time tracking is switched off in this workspace. Time already logged is shown below.
        </FormMessage>
      )}
      {loadedSettings?.error && <FormMessage className="mb-4">{loadedSettings.error}</FormMessage>}

      <Card className="mb-6 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Week</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report?.error ? (
            <div className="p-4">
              <FormMessage>{report.error}</FormMessage>
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={grid?.rows ?? []}
              rowKey={(row) => row.key}
              caption={`Time logged for the week of ${weekLabel}, by issue and day, with totals.`}
              ariaLabel="Timesheet"
              animate={false}
              loading={grid ? undefined : <Skeleton aria-busy="true" className="m-4 h-40" />}
              totals={totals}
              footer={
                report?.data?.truncated ? (
                  <p className="p-4 text-xs text-muted-foreground">Too many rows for one sheet; choose one person to see them all.</p>
                ) : undefined
              }
              empty={
                <EmptyState
                  icon={Clock}
                  title="Nothing logged this week"
                  description="Log time from an issue's drawer, or start its timer."
                />
              }
            />
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Entries{entries?.data ? ` (${entries.data.total})` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries?.error ? (
            <div className="p-4">
              <FormMessage>{entries.error}</FormMessage>
            </div>
          ) : (
            <DataTable
              columns={entryColumns}
              rows={entries?.data?.records ?? []}
              rowKey={(e) => e.id}
              caption={`Every time entry in the week of ${weekLabel}, newest first.`}
              ariaLabel="Time entries"
              animate={false}
              loading={entries ? undefined : <Skeleton aria-busy="true" className="m-4 h-24" />}
              empty={<p className="p-4 text-sm text-muted-foreground">No entries this week.</p>}
              pagination={
                entries?.data && entries.data.total > PAGE_SIZE
                  ? {
                      page: pageNumber,
                      pageSize: PAGE_SIZE,
                      total: entries.data.total,
                      onPageChange: (number) => setPage({ key: sheetKey ?? '', number }),
                      label: 'Time entry pages',
                      itemNoun: { one: 'entry', other: 'entries' },
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {settingsOpen && workspace && settings && (
        <TimeSettingsDialog
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          settings={settings}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={(next) => setSavedSettings({ key: workspace.id, data: next })}
        />
      )}
    </PageContainer>
  );
};

export default Timesheet;
