import { Construction } from 'lucide-react';
import type { SpaceNode, WorkspaceRole } from '@/types';
import EmptyState from '@/components/EmptyState';

export interface ReleasesViewProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
}

/** Placeholder from the restructuring foundation; its lane replaces the body and keeps the props. The default export: SpaceView lazy-loads it as its own chunk. */
const ReleasesView = (_props: ReleasesViewProps) => <EmptyState icon={Construction} title="Releases" />;

export default ReleasesView;
