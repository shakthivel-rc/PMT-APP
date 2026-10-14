
import React, { useState, useMemo } from 'react';
import { Activity, Search, SearchX } from 'lucide-react';
import { ActivityLog, User, hasPermission } from '../../../types/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import UserAvatar from '@/components/UserAvatar';
import { StatusBadge, activityTone } from '@/components/StatusBadge';
import { formatServerDateTime } from '@/lib/datetime';
import { usePagination } from '@/lib/usePagination';

interface ActivityLogClientProps {
    initialLogs: ActivityLog[];
    currentUser: User | null;
}

const ActivityLogClient: React.FC<ActivityLogClientProps> = ({ initialLogs, currentUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');

    const isAdmin =
        hasPermission(currentUser, ['manage_users']) ||
        hasPermission(currentUser, ['audit:read']);

    const filteredLogs = useMemo(() => {
        return initialLogs.filter(log => {
            const matchesSearch =
                log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.action.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesType = typeFilter === 'All' || log.type === typeFilter;

            return matchesSearch && matchesType;
        });
    }, [initialLogs, searchQuery, typeFilter]);

    // The whole audit trail arrives in one request, so paging it is a rendering decision
    // rather than a fetching one. Narrowing the list returns to page 1.
    const paged = usePagination(filteredLogs, { resetKey: `${searchQuery}|${typeFilter}` });

    const isFiltered = searchQuery.trim() !== '' || typeFilter !== 'All';

    const columns: DataTableColumn<ActivityLog>[] = [
        {
            key: 'action',
            header: 'Action',
            headerClassName: 'pl-6',
            cellClassName: 'pl-6',
            cell: (log) => (
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">{log.action}</span>
                    <StatusBadge tone={activityTone(log.type)} className="w-fit">
                        {log.type}
                    </StatusBadge>
                </div>
            ),
        },
        {
            key: 'user',
            header: 'User',
            cell: (log) => (
                <div className="flex items-center gap-2">
                    <UserAvatar name={log.userName} className="size-7 text-xs" />
                    <span className="text-sm text-foreground">{log.userName}</span>
                </div>
            ),
        },
        {
            key: 'details',
            header: 'Details',
            cellClassName: 'max-w-xs whitespace-normal text-sm text-muted-foreground',
            cell: (log) => log.details,
        },
        {
            key: 'date',
            header: 'Date',
            cellClassName: 'text-sm text-muted-foreground',
            cell: (log) => formatServerDateTime(log.timestamp),
        },
        // The IP address is an administrator's column: it identifies where somebody else
        // signed in from, and a non-admin only ever sees their own rows.
        ...(isAdmin
            ? ([
                  {
                      key: 'ip',
                      header: 'IP Address',
                      align: 'right',
                      headerClassName: 'pr-6',
                      cellClassName: 'pr-6 font-mono text-sm text-muted-foreground',
                      cell: (log) => log.ipAddress,
                  },
              ] as DataTableColumn<ActivityLog>[])
            : []),
    ];

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

            <Card className="gap-0 py-0 overflow-hidden">
                <CardHeader className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Recent Activity</CardTitle>

                    {isAdmin && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative sm:w-60">
                                <Label htmlFor="activity-search" className="sr-only">
                                    Search activity
                                </Label>
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="activity-search"
                                    type="search"
                                    className="pl-9"
                                    placeholder="Search user, action..."
                                    aria-label="Search activity logs"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger
                                    className="w-full sm:w-40"
                                    aria-label="Filter by activity type"
                                >
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Types</SelectItem>
                                    <SelectItem value="login">Login</SelectItem>
                                    <SelectItem value="logout">Logout</SelectItem>
                                    <SelectItem value="create">Create</SelectItem>
                                    <SelectItem value="update">Update</SelectItem>
                                    <SelectItem value="delete">Delete</SelectItem>
                                    <SelectItem value="security">Security</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        rows={paged.items}
                        rowKey={(log) => log.id}
                        ariaLabel="Activity logs"
                        caption={
                            isAdmin
                                ? 'All user activities and system events.'
                                : 'Your recent account activity.'
                        }
                        empty={
                            <EmptyState
                                icon={isFiltered ? SearchX : Activity}
                                title={isFiltered ? 'No matching activity' : 'No activity logs found'}
                                description={
                                    isFiltered
                                        ? 'Try adjusting your search or filter to find what you are looking for.'
                                        : isAdmin
                                            ? 'Activity will appear here as users interact with the system.'
                                            : 'Your recent account activity will appear here.'
                                }
                            />
                        }
                        pagination={{
                            page: paged.page,
                            pageSize: paged.pageSize,
                            total: paged.total,
                            onPageChange: paged.setPage,
                            onPageSizeChange: paged.setPageSize,
                            label: 'Activity log pages',
                            itemNoun: { one: 'entry', other: 'entries' },
                        }}
                    />
                </CardContent>
            </Card>
        </PageContainer>
    );
};

export default ActivityLogClient;
