import { Construction } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

export interface IssueKeyRedirectProps {
  workspaceId: string;
  /** As typed in the URL: current or old, any case. */
  issueKey: string;
}

/** Placeholder from the restructuring foundation; its lane replaces the body and keeps the props. */
const IssueKeyRedirect = ({ issueKey }: IssueKeyRedirectProps) => <EmptyState icon={Construction} title={issueKey} />;

export default IssueKeyRedirect;
