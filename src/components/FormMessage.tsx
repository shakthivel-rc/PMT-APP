import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'error' | 'success' | 'info' | 'warning';

const styles: Record<Variant, string> = {
  error: 'border-danger/30 bg-danger-subtle text-danger',
  success: 'border-success/30 bg-success-subtle text-success',
  info: 'border-info/30 bg-info-subtle text-info',
  warning: 'border-warning/30 bg-warning-subtle text-warning',
};

interface FormMessageProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

/** Inline form banner announced to assistive tech (errors as alert, others as status). */
const FormMessage = ({ variant = 'error', children, className }: FormMessageProps) => (
  <div
    role={variant === 'error' ? 'alert' : 'status'}
    aria-live={variant === 'error' ? 'assertive' : 'polite'}
    className={cn('rounded-lg border px-3 py-2 text-sm', styles[variant], className)}
  >
    {children}
  </div>
);

export default FormMessage;
