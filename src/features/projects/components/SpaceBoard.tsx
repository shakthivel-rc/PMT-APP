import { Construction } from 'lucide-react';
import type { SpaceNode, WorkspaceRole } from '@/types';
import EmptyState from '@/components/EmptyState';

export interface SpaceBoardProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
  /** `space`: every list's issues by stage, labelled with their list. `sprint`: the active sprint, across lists. */
  scope: 'space' | 'sprint';
}

/** Placeholder from the restructuring foundation; its lane replaces the body and keeps the props. */
const SpaceBoard = ({ scope }: SpaceBoardProps) => (
  <EmptyState icon={Construction} title={scope === 'sprint' ? 'Active sprint board' : 'Space overview'} />
);

export default SpaceBoard;
