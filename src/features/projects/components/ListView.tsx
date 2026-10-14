import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppWindow, BarChart3, Maximize2, Minimize2, PanelRight, Settings, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setTicketViewMode, toggleFocusMode } from '@/features/ui/uiSlice';
import { createIssueApi, fetchBoardApi, moveIssueApi } from '@/api/issues';
import { pqlApi } from '@/api/pql';
import { canWriteIssues, type BoardColumn, type ListNode, type SpaceNode, type WorkspaceRole } from '@/types';
import { spaceHref } from './SpaceView';
import { cn } from '@/lib/utils';
import FormMessage from '@/components/FormMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { patchCard, planMove, replaceCard } from '../boardPosition';
import { errorMessage, isNotFound } from '../presentation';
import BoardView from './BoardView';
import IssueTable from './IssueTable';
import IssueDrawer from './IssueDrawer';
import { PQLSearchBar } from './PQLSearchBar';
import { DailyStandupCard } from './DailyStandupCard';

const SprintPanel = lazyWithRetry(
  () => import('@/features/sprints/components/SprintPanel').then((m) => ({ default: m.SprintPanel })),
  'SprintPanel',
);

type View = 'board' | 'list';

const VIEWS: { id: View; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
];

interface ListViewProps {
  workspaceId: string;
  space: SpaceNode;
  list: ListNode;
  role: WorkspaceRole;
}

/**
 * One list, drawn as a board or as a table.
 *
 * **Data is decoupled from view.** The board payload is loaded once, here, and both views are
 * projections of it: the board groups the cards by status, the table flattens the same
 * columns into rows. Switching view is a re-render of data already held — it never fetches —
 * and a card moved on the board is already in its new place when the table is shown. A later
 * view (calendar, timeline) is one more projection of the same `IssueCard`s, not a new query.
 *
 * The chosen view lives in the URL (`?view=list`), so a link to a list opens it the way it
 * was being read. The board is the default and is spelled by leaving the parameter out.
 *
 * So does the open issue (`?issue=<id>`), so the header's running timer and the timesheet
 * can link straight to one. A search parameter rather than a path segment: AppShell keys the
 * routed outlet on the pathname, and a path segment would remount the whole workspace — tree
 * and board refetched — on every open and close of the drawer.
 */
const ListView = ({ workspaceId, space, list, role }: ListViewProps) => {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'list' ? 'list' : 'board';
  const [columns, setColumns] = useState<BoardColumn[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const openIssueId = params.get('issue');
  const canWrite = canWriteIssues(role);
  // Numbers each move, so a refusal can tell whether another move has happened since.
  const latestMove = useRef(0);
  const [sprintsOpen, setSprintsOpen] = useState(false);
  const reportsHref = `/reports?${new URLSearchParams({ workspace: workspaceId, scope: `space:${space.id}` }).toString()}`;

  const [pqlMatchingIds, setPqlMatchingIds] = useState<Set<string> | null>(null);
  const [pqlQuery, setPqlQuery] = useState('');

  const handlePQLSearch = async (q: string) => {
    setPqlQuery(q);
    if (!q.trim()) {
      setPqlMatchingIds(null);
      return;
    }
    try {
      const res = await pqlApi.execute(workspaceId, { query: q });
      setPqlMatchingIds(new Set(res.data.records.map((r) => r.id)));
      toast.success(`PQL matched ${res.data.records.length} issue(s)`);
    } catch (err: any) {
      toast.error(err.message || 'PQL execution failed');
    }
  };

  const handlePQLClear = () => {
    setPqlQuery('');
    setPqlMatchingIds(null);
  };

  const displayedColumns = useMemo(() => {
    if (!columns || pqlMatchingIds === null) return columns;
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => pqlMatchingIds.has(card.id)),
    }));
  }, [columns, pqlMatchingIds]);

  const loadBoard = useCallback(
    () => fetchBoardApi(workspaceId, { list_id: list.id }).then((board) => board.columns),
    [workspaceId, list.id],
  );

  useEffect(() => {
    let cancelled = false;
    loadBoard()
      .then((next) => {
        if (!cancelled) setColumns(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure(isNotFound(err) ? 'This list no longer exists, or you are no longer a member here.' : errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [loadBoard]);

  const setView = (next: View) =>
    // `replace`: flipping between two drawings of the same list is not somewhere Back
    // should have to step through on the way out.
    setParams(
      (current) => {
        const query = new URLSearchParams(current);
        if (next === 'list') query.set('view', 'list');
        else query.delete('view');
        return query;
      },
      { replace: true },
    );

  const setOpenIssueId = (issueId: string | null) =>
    setParams(
      (current) => {
        const query = new URLSearchParams(current);
        if (issueId) query.set('issue', issueId);
        else query.delete('issue');
        return query;
      },
      // `replace`, for the reason `setView` gives: opening and closing the drawer is not a
      // place Back should step through.
      { replace: true },
    );

  /**
   * Optimistic: the card moves at once and the request follows. On a refusal the board goes
   * back to the snapshot taken here — but only if no other move has been made since, because
   * restoring the snapshot would silently undo that one too, and its request may well have
   * succeeded. In that case the server's board is the only state known to be right.
   */
  const moveCard = async (cardId: string, statusId: string, dropIndex: number) => {
    if (!columns) return;
    const plan = planMove(columns, cardId, statusId, dropIndex);
    if (!plan) return;
    const snapshot = columns;
    const ticket = ++latestMove.current;
    setColumns(plan.columns);
    try {
      const { value: card, notice } = await moveIssueApi(workspaceId, cardId, plan.move);
      setColumns((current) => current && replaceCard(current, card));
      if (notice) toast.warning(notice);
    } catch (err) {
      if (ticket === latestMove.current) setColumns(snapshot);
      else loadBoard().then(setColumns, () => setColumns(snapshot));
      toast.error(`The move was undone. ${errorMessage(err)}`);
    }
  };

  const addIssue = async (statusId: string, title: string) => {
    const { value: issue, notice } = await createIssueApi(workspaceId, { list_id: list.id, title, type: 'task', status_id: statusId });
    if (notice) toast.warning(notice);
    // Created at the bottom of its column, which is where it is drawn.
    setColumns((current) =>
      current && current.map((c) => (c.status.id === issue.status_id ? { ...c, cards: [...c.cards, issue] } : c)),
    );
  };

  const dispatch = useAppDispatch();
  const focusMode = useAppSelector((state) => state.ui.focusMode);
  const ticketViewMode = useAppSelector((state) => state.ui.ticketViewMode);
  const totalCards = columns ? columns.reduce((acc, col) => acc + col.cards.length, 0) : 0;

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={spaceHref(workspaceId, space.id)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors block"
            title={`Go to ${space.name} overview`}
          >
            {space.name}
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-bold tracking-tight">{list.name}</h2>
            {columns !== null && (
              <Badge variant="secondary" className="font-mono text-xs font-normal">
                {totalCards} {totalCards === 1 ? 'issue' : 'issues'}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Settings configures the space (workflows, charter, danger zone). */}
          <Button size="sm" variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-2xs transition-colors font-medium" asChild>
            <Link to={spaceHref(workspaceId, space.id, 'settings')}>
              <Settings className="h-4 w-4 text-amber-500 mr-1.5" aria-hidden="true" /> Project Settings
            </Link>
          </Button>
          {/* Sprints are per project (space); reports open scoped to it. */}
          <Button size="sm" variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/60 shadow-2xs transition-colors font-medium" onClick={() => setSprintsOpen(true)}>
            <Zap className="h-4 w-4 text-violet-500 fill-violet-500/25 mr-1.5" aria-hidden /> Sprints
          </Button>
          <Button size="sm" variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 shadow-2xs transition-colors font-medium" asChild>
            <Link to={reportsHref}>
              <BarChart3 className="h-4 w-4 text-emerald-500 mr-1.5" aria-hidden /> Reports
            </Link>
          </Button>

          {/* Focus Mode button */}
          <Button
            size="sm"
            variant={focusMode ? 'secondary' : 'outline'}
            onClick={() => dispatch(toggleFocusMode())}
            title={focusMode ? 'Exit focus mode (Shift+F)' : 'Enter focus mode (Shift+F)'}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 shadow-2xs font-medium transition-colors",
              focusMode
                ? "bg-sky-500 text-white hover:bg-sky-600 border-sky-500 shadow-xs"
                : "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/60"
            )}
          >
            {focusMode ? <Minimize2 className="h-4 w-4 text-white" aria-hidden="true" /> : <Maximize2 className="h-4 w-4 text-sky-500" aria-hidden="true" />}
            <span>Focus</span>
          </Button>

          {/* Ticket View Mode: Full Modal Pop-up vs Side Drawer */}
          <Button
            size="sm"
            variant={ticketViewMode === 'modal' ? 'secondary' : 'outline'}
            onClick={() => dispatch(setTicketViewMode(ticketViewMode === 'modal' ? 'drawer' : 'modal'))}
            title={
              ticketViewMode === 'modal'
                ? 'Tickets open in full modal pop-up (click to switch to side drawer)'
                : 'Tickets open in side drawer (click to switch to full modal pop-up)'
            }
            aria-label={ticketViewMode === 'modal' ? 'Ticket mode: Modal pop-up' : 'Ticket mode: Side drawer'}
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 shadow-2xs font-medium transition-colors",
              ticketViewMode === 'modal'
                ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/25"
                : "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/20 hover:border-fuchsia-500/60"
            )}
          >
            {ticketViewMode === 'modal' ? (
              <AppWindow className="h-4 w-4 text-fuchsia-500" aria-hidden="true" />
            ) : (
              <PanelRight className="h-4 w-4 text-fuchsia-500" aria-hidden="true" />
            )}
            <span>{ticketViewMode === 'modal' ? 'Modal' : 'Drawer'}</span>
          </Button>

          <div role="group" aria-label="View" className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            {VIEWS.map(({ id, label }) => (
              <Button
                key={id}
                size="sm"
                variant={view === id ? 'default' : 'ghost'}
                className={cn(
                  'text-xs font-medium transition-all',
                  view === id ? 'bg-primary text-primary-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <DailyStandupCard workspaceId={workspaceId} />

      <div className="py-1">
        <PQLSearchBar
          workspaceId={workspaceId}
          onSearch={handlePQLSearch}
          onClear={handlePQLClear}
          initialQuery={pqlQuery}
          onSaveView={(q) => {
            toast.success(`Filter "${q}" saved to views.`);
          }}
        />
      </div>

      {failure ? (
        <FormMessage>{failure}</FormMessage>
      ) : !columns ? (
        <Skeleton aria-busy="true" className="h-72 rounded-xl" />
      ) : view === 'board' ? (
        <BoardView
          columns={displayedColumns ?? []}
          canWrite={canWrite}
          onMove={moveCard}
          onAdd={addIssue}
          onOpen={setOpenIssueId}
        />
      ) : (
        <IssueTable columns={displayedColumns ?? []} onOpen={setOpenIssueId} />
      )}

      <Dialog open={sprintsOpen} onOpenChange={setSprintsOpen}>
        <DialogContent className="w-full sm:max-w-2xl h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                <Zap className="size-5 fill-violet-500/20" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Sprints in {space.name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Plan, start and close sprints; open their reports.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
            {sprintsOpen && (
              <Suspense fallback={<Skeleton className="h-full min-h-[300px] w-full rounded-xl" aria-busy="true" />}>
                <SprintPanel
                  workspaceId={workspaceId}
                  spaceId={space.id}
                  spaceName={space.name}
                  candidates={columns?.flatMap((c) => c.cards) ?? []}
                  onIssuesChanged={() => void loadBoard().then(setColumns, () => undefined)}
                />
              </Suspense>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <IssueDrawer
        workspaceId={workspaceId}
        space={space}
        issueId={openIssueId}
        statuses={columns?.map((c) => c.status) ?? space.statuses}
        canWrite={canWrite}
        onOpenIssue={setOpenIssueId}
        onCardChanged={(issueId, patch) => setColumns((current) => current && patchCard(current, issueId, patch))}
        onClose={() => setOpenIssueId(null)}
      />
    </div>
  );
};

export default ListView;
