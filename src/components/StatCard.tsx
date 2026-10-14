import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/components/StatusBadge';

const toneClass: Record<Tone, string> = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  primary: 'bg-primary/12 text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  className?: string;
}

/** KPI tile for dashboards. */
const StatCard = ({ label, value, icon: Icon, tone = 'primary', hint, className }: StatCardProps) => (
  <div className={cn('rounded-xl border border-border bg-card p-5 shadow-xs', className)}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneClass[tone])}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
    </div>
    <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export default StatCard;
