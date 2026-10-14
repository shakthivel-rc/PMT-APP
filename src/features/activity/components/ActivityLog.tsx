
import React, { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { fetchActivityLogsApi } from '../../../api/activityLogs';
import ActivityLogClient from './ActivityLogClient';
import { User, hasPermission, ActivityLog as ActivityLogType } from '../../../types/index';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';

interface ActivityLogProps {
    currentUser: User | null;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ currentUser }) => {
    const [logs, setLogs] = useState<ActivityLogType[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin =
        hasPermission(currentUser, ['manage_users']) ||
        hasPermission(currentUser, ['audit:read']);
    const fetchId = isAdmin ? undefined : currentUser?.id;

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        fetchActivityLogsApi(fetchId)
            .then((data) => {
                if (!cancelled) {
                    setLogs(data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLogs([]);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [fetchId]);

    if (loading) {
        return (
            <PageContainer>
                <PageHeader
                    title="Activity Logs"
                    icon={Activity}
                    description={
                        isAdmin
                            ? 'Monitor all user activities and system events.'
                            : 'View your recent account activity.'
                    }
                />
                <div
                    className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
                    role="status"
                    aria-live="polite"
                >
                    <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                    <span className="text-sm">Loading activity logs...</span>
                </div>
            </PageContainer>
        );
    }

    return <ActivityLogClient initialLogs={logs} currentUser={currentUser} />;
};

export default ActivityLog;
