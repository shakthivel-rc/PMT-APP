import { Suspense } from 'react';
import { NavLink } from 'react-router-dom';
import { Archive, SearchX, Snowflake } from 'lucide-react';
import type { SpaceNode, WorkspaceRole } from '@/types';
import EmptyState from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { readOnlyReason } from '@/lib/workflowRules';
import { cn } from '@/lib/utils';
import { BacklogView } from '@/features/planning/components/BacklogView';
import SpaceBoard from './SpaceBoard';

// Each its own chunk: the settings and releases screens are opened far less often than the
// board, and neither should weigh on the first paint of a space.
const ReleasesView = lazyWithRetry(() => import('@/features/planning/components/ReleasesView'), 'ReleasesView');
const SpaceSettings = lazyWithRetry(() => import('./SpaceSettings'), 'SpaceSettings');

/** The views of one space (09-restructuring.md §5). `board` is the default and is spelled by leaving the segment out. */
export type SpaceTab = 'board' | 'sprint' | 'backlog' | 'releases' | 'settings';

const TABS: { id: SpaceTab; label: string }[] = [
  { id: 'board', label: 'Overview' },
  { id: 'sprint', label: 'Active sprint' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'releases', label: 'Releases' },
  { id: 'settings', label: 'Settings' },
];

export const spaceHref = (workspaceId: string, spaceId: string, tab: SpaceTab = 'board'): string =>
  `/projects/${encodeURIComponent(workspaceId)}/spaces/${encodeURIComponent(spaceId)}${tab === 'board' ? '' : `/${tab}`}`;

const isTab = (value: string): value is SpaceTab => TABS.some((tab) => tab.id === value);

interface SpaceViewProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
  /** The route's `:spaceTab`, unchecked. */
  tab: string | undefined;
  /** Re-reads the workspace tree — after a publish, a rename, an archive. */
  onChanged: () => Promise<unknown>;
}

/**
 * `/projects/:workspaceId/spaces/:spaceId[/:tab]`: a space's views, every one a projection of
 * the same issues — where work lives (its list) never changes because of how it is viewed.
 */
const SpaceView = ({ workspaceId, space, role, tab = 'board', onChanged }: SpaceViewProps) => {
  const readOnly = readOnlyReason(space);
  if (!isTab(tab)) {
    return <EmptyState icon={SearchX} title="Not a view of this space" description="Choose one of the space's tabs." />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{space.key}</p>
          <h2 className="flex flex-wrap items-center gap-2 truncate text-xl font-bold tracking-tight">
            {space.name}
            {space.archived && (
              <StatusBadge>
                <Archive className="h-3 w-3" aria-hidden /> Archived
              </StatusBadge>
            )}
            {space.frozen && (
              <StatusBadge tone="info">
                <Snowflake className="h-3 w-3" aria-hidden /> Frozen
              </StatusBadge>
            )}
          </h2>
          {readOnly && <p className="mt-1 text-sm text-muted-foreground">{readOnly}</p>}
        </div>
      </div>
      <nav aria-label={`${space.name} views`} className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(({ id, label }) => (
          <NavLink
            key={id}
            end
            to={spaceHref(workspaceId, space.id, id)}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<Skeleton aria-busy="true" className="h-72 rounded-xl" />}>
        {tab === 'board' && <SpaceBoard key="space" workspaceId={workspaceId} space={space} role={role} scope="space" />}
        {tab === 'sprint' && <SpaceBoard key="sprint" workspaceId={workspaceId} space={space} role={role} scope="sprint" />}
        {tab === 'backlog' && <BacklogView workspaceId={workspaceId} space={space} role={role} />}
        {tab === 'releases' && <ReleasesView workspaceId={workspaceId} space={space} role={role} />}
        {tab === 'settings' && (
          <SpaceSettings workspaceId={workspaceId} space={space} role={role} onChanged={onChanged} />
        )}
      </Suspense>
    </div>
  );
};

export default SpaceView;
