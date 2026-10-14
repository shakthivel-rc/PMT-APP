import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Consistent empty/zero state: icon + copy + optional CTA. */
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    {Icon && (
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-7" aria-hidden="true" />
      </div>
    )}
    {/*
      An <h2>, not an <h3>: this sits directly under the page <h1>, so an h3 skipped a level
      and the outline read h1 -> h3 on every screen that can be empty. Classes unchanged.
    */}
    <h2 className="text-base font-semibold">{title}</h2>
    {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
