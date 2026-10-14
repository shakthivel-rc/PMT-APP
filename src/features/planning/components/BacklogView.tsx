import { Construction } from 'lucide-react';
import type { SpaceNode, WorkspaceRole } from '@/types';
import EmptyState from '@/components/EmptyState';

export interface BacklogViewProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
}

/** Placeholder from the restructuring foundation; its lane replaces the body and keeps the props. A named export, because it is bundled with the projects chunk rather than lazy. */
export const BacklogView = (_props: BacklogViewProps) => <EmptyState icon={Construction} title="Backlog" />;
