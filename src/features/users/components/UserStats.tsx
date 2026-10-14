
import React, { useEffect } from 'react';
import { Users, UserCheck, UserPlus, Shield } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchUserStats } from '../usersSlice';
import StatCard from '@/components/StatCard';
import { Skeleton } from '@/components/ui/skeleton';

// KPI grid placeholder while the counts load.
const StatsFallback: React.FC = () => (
    <div aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="size-9 rounded-lg" />
                </div>
                <Skeleton className="mt-3 h-7 w-16" />
            </div>
        ))}
    </div>
);

const UserStats: React.FC = () => {
    const dispatch = useAppDispatch();
    const stats = useAppSelector((state) => state.users.stats);
    const statsStatus = useAppSelector((state) => state.users.statsStatus);

    // These counts were previously fetched once per page load through a module-scoped
    // promise and never refreshed at all, so "Total Users" and "Active Now" were wrong for
    // the rest of the session after any create or delete. Going through the store means a
    // mutation invalidates them the same way it invalidates the table.
    useEffect(() => {
        if (statsStatus === 'idle') dispatch(fetchUserStats());
    }, [statsStatus, dispatch]);

    if (!stats) return <StatsFallback />;

    // Find the most common role name for the stats display
    const topRole = Object.entries(stats.rolesDistribution || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))[0];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Users" value={stats.totalUsers} icon={Users} tone="primary" />
            <StatCard label="Active Now" value={stats.activeNow} icon={UserCheck} tone="success" hint="Enabled accounts" />
            <StatCard label="New (Week)" value={stats.newThisWeek} icon={UserPlus} tone="info" hint="Last 7 days" />
            <StatCard
                label={topRole ? (topRole[0] as string) : 'Admins'}
                value={topRole ? (topRole[1] as number) : 0}
                icon={Shield}
                tone="warning"
                hint="Most common role"
            />
        </div>
    );
};

export default UserStats;
