import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Standard padded, max-width page wrapper for content screens. */
const PageContainer = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8', className)}>{children}</div>
);

export default PageContainer;
