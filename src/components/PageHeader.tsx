import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

/** Standard screen header: icon + title + description on the left, actions on the right. */
const PageHeader = ({ title, description, icon: Icon, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl break-words">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground break-words">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
