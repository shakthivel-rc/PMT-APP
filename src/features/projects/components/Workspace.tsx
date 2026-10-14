import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FolderKanban, SearchX, ShieldAlert } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setTreeCollapsed, toggleTree } from '@/features/ui/uiSlice';
import { fetchWorkspaceTreeApi } from '@/api/workspaces';
import { canManageWorkspace, type ListNode, type SpaceNode, type WorkspaceTree } from '@/types';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';
import { errorMessage, isNotFound } from '../presentation';
import HierarchyPanel from './HierarchyPanel';
import IssueKeyRedirect from './IssueKeyRedirect';
import ListView from './ListView';
import SpaceView from './SpaceView';

// Admins only, and rarely: its own chunk (09-restructuring.md §8).
const RestructureScreen = lazyWithRetry(() => import('@/features/restructure/components/RestructureScreen'), 'RestructureScreen');
const WorkspaceSettings = lazyWithRetry(() => import('./WorkspaceSettings'), 'WorkspaceSettings');

/** The list a route names, and the space whose workflow its board draws — or null. */
function locateList(tree: WorkspaceTree, listId: string | undefined): { space: SpaceNode; list: ListNode } | null {
  for (const space of tree.spaces) {
    const list = [...space.lists, ...space.folders.flatMap((folder) => folder.lists)].find((l) => l.id === listId);
    if (list) return { space, list };
  }
  return null;
}

/**
 * `/projects/:workspaceId` and everything under it: the hierarchy on the left, and on the
 * right the chosen list (`/lists/:listId`), a space's views (`/spaces/:spaceId[/:spaceTab]`),
 * an issue found by key (`/browse/:issueKey`, old keys included) or, for admins, the
 * restructuring tools (`section="restructure"`).
 *
 * One component for both routes. AppShell keys its outlet on the pathname, so choosing
 * another list remounts this and the tree is read again. That is one small request, and it
 * is the price of the shell's rule that a route's content never outlives its route — the
 * alternative, a module-level cache, is exactly what outlived logout on the RBAC screen.
 */
interface WorkspaceProps {
  /** A route that is not a list, a space or a key. */
  section?: 'restructure' | 'settings';
}

const Workspace = ({ section }: WorkspaceProps) => {
  const { workspaceId = '', listId, spaceId, spaceTab, issueKey } = useParams();
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const dispatch = useAppDispatch();
  const { treeCollapsed, focusMode } = useAppSelector((state) => state.ui);

  // After a create. Awaited by the dialogs, so the new node is in the panel before they close.
  const reload = useCallback(
    () => fetchWorkspaceTreeApi(workspaceId).then(setTree),
    [workspaceId],
  );

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceTreeApi(workspaceId)
      .then((next) => {
        if (!cancelled) setTree(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure(err);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const located = useMemo(() => (tree ? locateList(tree, listId) : null), [tree, listId]);
  const space = useMemo(() => tree?.spaces.find((s) => s.id === spaceId) ?? null, [tree, spaceId]);
  const hasSelectedView = Boolean(located || (spaceId && space) || issueKey || section === 'restructure' || section === 'settings');
  const isTreeHidden = hasSelectedView ? (focusMode || treeCollapsed) : false;

  useEffect(() => {
    if (!hasSelectedView && treeCollapsed) {
      dispatch(setTreeCollapsed(false));
    }
  }, [hasSelectedView, treeCollapsed, dispatch]);

  if (failure) {
    const missing = isNotFound(failure);
    return (
      <EmptyState
        icon={SearchX}
        title={missing ? 'Workspace not found' : 'This workspace could not be loaded'}
        // Not "you are not a member": the API refuses non-members and missing workspaces
        // with the same 404, precisely so that nobody can tell the two apart from here.
        description={missing ? 'It does not exist, or you are not a member of it.' : errorMessage(failure)}
        action={
          <Button asChild variant="outline">
            <Link to="/projects">All workspaces</Link>
          </Button>
        }
      />
    );
  }

  if (!tree) {
    return (
      <div aria-busy="true" className="flex h-full gap-6 p-4 sm:p-6">
        <Skeleton className="hidden h-72 w-60 rounded-xl lg:block" />
        <Skeleton className="h-72 flex-1 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col lg:flex-row">
      <aside
        className={cn(
          'shrink-0 border-b border-border transition-all duration-200 ease-in-out lg:border-r lg:border-b-0 overflow-hidden',
          isTreeHidden ? 'lg:w-0 border-r-0' : 'lg:w-64 lg:overflow-y-auto'
        )}
      >
        <HierarchyPanel
          tree={tree}
          activeListId={listId}
          activeSpaceId={spaceId ?? located?.space.id}
          activeSpaceTab={spaceTab}
          activeSection={section}
          onChanged={reload}
        />
      </aside>

      {/* Floating Space Tree Toggle Handle */}
      {!focusMode && (
        <button
          type="button"
          disabled={!hasSelectedView}
          onClick={() => {
            if (hasSelectedView) {
              dispatch(toggleTree());
            }
          }}
          className={cn(
            'hidden lg:flex absolute top-3 z-20 items-center justify-center size-6 rounded-full border bg-background text-muted-foreground shadow-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            hasSelectedView
              ? 'hover:bg-muted hover:text-foreground cursor-pointer'
              : 'opacity-40 cursor-not-allowed',
            isTreeHidden ? 'left-2' : 'left-[244px]'
          )}
          title={
            !hasSelectedView
              ? 'Select a list from the hierarchy to collapse space tree'
              : isTreeHidden
                ? 'Expand space tree (\\)'
                : 'Collapse space tree (\\)'
          }
          aria-label={
            !hasSelectedView
              ? 'Select a list from the hierarchy to collapse space tree'
              : isTreeHidden
                ? 'Expand space tree'
                : 'Collapse space tree'
          }
        >
          {isTreeHidden ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6" aria-label="Selected list">
        {section === 'settings' ? (
          <Suspense fallback={<Skeleton aria-busy="true" className="h-72 rounded-xl" />}>
            <WorkspaceSettings workspaceId={tree.id} tree={tree} role={tree.role} onChanged={reload} />
          </Suspense>
        ) : section === 'restructure' ? (
          canManageWorkspace(tree.role) ? (
            <Suspense fallback={<Skeleton aria-busy="true" className="h-72 rounded-xl" />}>
              <RestructureScreen workspaceId={tree.id} tree={tree} onChanged={reload} />
            </Suspense>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="Admins only"
              description="Restructuring moves, freezes and archives containers for everyone, so it needs a workspace admin."
            />
          )
        ) : issueKey ? (
          <IssueKeyRedirect workspaceId={tree.id} issueKey={issueKey} />
        ) : spaceId ? (
          space ? (
            <SpaceView workspaceId={tree.id} space={space} role={tree.role} tab={spaceTab} onChanged={reload} />
          ) : (
            <EmptyState icon={SearchX} title="Space not found" description="It is not in this workspace any more." />
          )
        ) : located ? (
          <ListView workspaceId={tree.id} space={located.space} list={located.list} role={tree.role} />
        ) : (
          <EmptyState
            icon={listId ? SearchX : FolderKanban}
            title={listId ? 'List not found' : 'Pick a list'}
            description={
              listId
                ? 'It is not in this workspace any more. Choose another from the hierarchy.'
                : tree.spaces.length > 0
                  ? 'Choose a list from the hierarchy to see its board.'
                  : 'This workspace has no spaces yet. A space holds lists, and each list has a board.'
            }
          />
        )}
      </section>
    </div>
  );
};

export default Workspace;
