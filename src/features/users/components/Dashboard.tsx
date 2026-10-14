
import React from 'react';
import DashboardClient from './DashboardClient';
import PageContainer from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/skeleton';

// Full-page fallback shown while the user list loads.
export const DashboardSkeleton: React.FC = () => (
  <div aria-busy="true" className="space-y-6">
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>

    <div className="rounded-xl border border-border">
      <div className="border-b border-border p-4">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <PageContainer>
      <DashboardClient />
    </PageContainer>
  );
};

export default Dashboard;
