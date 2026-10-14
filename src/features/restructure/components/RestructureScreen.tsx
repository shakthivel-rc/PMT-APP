import { Construction } from 'lucide-react';
import type { WorkspaceTree } from '@/types';
import EmptyState from '@/components/EmptyState';

export interface RestructureScreenProps {
  workspaceId: string;
  tree: WorkspaceTree;
  /** Re-reads the workspace tree after anything that moves, freezes or archives containers. */
  onChanged: () => Promise<unknown>;
}

/** Placeholder from the restructuring foundation; its lane replaces the body and keeps the props. The default export: Workspace lazy-loads it as its own chunk. */
const RestructureScreen = (_props: RestructureScreenProps) => <EmptyState icon={Construction} title="Restructure" />;

export default RestructureScreen;
