import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

const toneClass: Record<Tone, string> = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  primary: 'bg-primary/12 text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatusBadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/** Small theme-safe status pill. Activity-log badges take their tone from `activityTone` below. */
export const StatusBadge = ({ tone = 'neutral', className, children }: StatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      toneClass[tone],
      className,
    )}
  >
    {children}
  </span>
);

/* ---- Tone mapper for activity-log actions ---- */

/**
 * Activity-log actions, as the API writes them (lower-cased): login, logout, create, update,
 * delete, security. `logout` is routine and deliberately falls through to neutral.
 */
export function activityTone(type: string): Tone {
  switch (type) {
    case 'create':
      return 'success';
    case 'update':
      return 'info';
    case 'delete':
      return 'danger';
    case 'login':
      return 'primary';
    case 'security':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default StatusBadge;
