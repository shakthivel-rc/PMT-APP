import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Shield, Settings2, Plus, KeyRound } from 'lucide-react';
import { RoleDefinition, Permission, hasPermission } from '../../../types/index';
import { useAppSelector } from '@/app/hooks';
import { revalidateRbacData } from '../../../actions/rbacActions';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/lib/usePagination';
import PermissionModal from './PermissionModal';
import RoleConfigModal from './RoleConfigModal';

/** Roles are cards rather than rows, so they page in a smaller window than the table does. */
const ROLES_PER_PAGE = 6;

const PERMISSION_COLUMNS: DataTableColumn<Permission>[] = [
    {
        key: 'name',
        header: 'Permission Name',
        headerClassName: 'pl-4',
        cellClassName: 'pl-4 font-medium text-foreground',
        cell: (perm) => perm.permission_name,
    },
    {
        key: 'machine-name',
        header: 'Machine Name',
        cellClassName: 'font-mono text-xs text-muted-foreground',
        cell: (perm) => perm.machine_name,
    },
];

const RolesAndPermissionsClient: React.FC = () => {
    const [roles, setRoles] = useState<RoleDefinition[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [configRole, setConfigRole] = useState<RoleDefinition | null>(null);

    const { user: currentUser } = useAppSelector((state) => state.auth);
    const canManageRoles =
        hasPermission(currentUser, ['manage_users']) ||
        hasPermission(currentUser, ['roles:update']);
    const canManagePermissions =
        hasPermission(currentUser, ['manage_users']) ||
        hasPermission(currentUser, ['permissions:manage']);

    // One owner for this data. It used to arrive as props from a module-scoped promise that
    // was never invalidated on success, while `refreshData` wrote to this local state — two
    // caches that disagreed, so a permission created here reappeared as missing on the next
    // visit. The initial load now goes through the same function every mutation already used.
    const refreshData = useCallback(async () => {
        const { roles: r, permissions: p } = await revalidateRbacData();
        setRoles(r);
        setPermissions(p);
    }, []);

    useEffect(() => {
        let cancelled = false;
        revalidateRbacData()
            .then(({ roles: r, permissions: p }) => {
                if (cancelled) return;
                setRoles(r);
                setPermissions(p);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Two independent paginators on one screen. Both are client-side: RBAC is tens of rows
    // and arrives in a single request.
    const pagedRoles = usePagination(roles, { pageSize: ROLES_PER_PAGE });
    const pagedPermissions = usePagination(permissions);

    if (isLoading) {
        return (
            <PageContainer>
                <PageHeader
                    title="Roles & Permissions"
                    description="Manage system access levels and capabilities."
                    icon={ShieldCheck}
                />
                <div aria-busy="true" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <Skeleton className="h-64 rounded-xl lg:col-span-5" />
                    <Skeleton className="h-64 rounded-xl lg:col-span-7" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PageHeader
                title="Roles & Permissions"
                description="Manage system access levels and capabilities."
                icon={ShieldCheck}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Roles Column */}
                <section className="lg:col-span-5" aria-labelledby="roles-heading">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 id="roles-heading" className="text-base font-semibold">Roles</h2>
                        {/* The unpaged count, so the badge stays true while page 2 is open. */}
                        <StatusBadge tone="neutral">{roles.length}</StatusBadge>
                    </div>

                    {roles.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {pagedRoles.items.map((role, index) => (
                                <motion.div
                                    key={role.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: index * 0.04 }}
                                >
                                    <Card className="gap-4 py-4 transition-shadow hover:shadow-md">
                                        <CardContent className="px-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                                                        <Shield className="size-5" aria-hidden="true" />
                                                    </span>
                                                    <div>
                                                        <p className="font-semibold leading-tight">{role.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {canManageRoles && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setConfigRole(role)}
                                                        aria-label={`Configure ${role.name}`}
                                                    >
                                                        <Settings2 className="size-4" aria-hidden="true" />
                                                        <span>Configure</span>
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                {role.permissions.length > 0 ? (
                                                    <>
                                                        {role.permissions.slice(0, 3).map(p => (
                                                            <Badge key={p.id} variant="secondary" className="font-normal">
                                                                {p.permission_name}
                                                            </Badge>
                                                        ))}
                                                        {role.permissions.length > 3 && (
                                                            <Badge variant="outline" className="font-normal text-muted-foreground">
                                                                +{role.permissions.length - 3} more
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-sm italic text-muted-foreground">No permissions assigned</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}

                            {/* Hidden while everything fits: a control that can only ever say
                                "1 of 1" is noise on a column of six cards. */}
                            <Pagination
                                page={pagedRoles.page}
                                pageSize={pagedRoles.pageSize}
                                total={pagedRoles.total}
                                onPageChange={pagedRoles.setPage}
                                label="Role pages"
                                itemNoun={{ one: 'role', other: 'roles' }}
                                hideWhenSinglePage
                                className="rounded-xl border border-border"
                            />
                        </div>
                    ) : (
                        <Card className="py-0">
                            <EmptyState
                                icon={ShieldCheck}
                                title="No roles defined"
                                description="Roles are provisioned by the system. Once they exist, configure their permissions here."
                            />
                        </Card>
                    )}
                </section>

                {/* Permissions Column */}
                <section className="lg:col-span-7" aria-labelledby="permissions-heading">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <h2 id="permissions-heading" className="text-base font-semibold">All Permissions</h2>
                            <StatusBadge tone="neutral">{permissions.length}</StatusBadge>
                        </div>
                        {canManagePermissions && (
                            <Button size="sm" onClick={() => setIsPermModalOpen(true)}>
                                <Plus className="size-4" aria-hidden="true" />
                                <span>New Permission</span>
                            </Button>
                        )}
                    </div>

                    <Card className="py-0">
                        <CardContent className="px-0">
                            {/* Paged rather than scrolled inside a 600px box: a scroller hides
                                how much is below it, and gives no way to say where you are. */}
                            <DataTable
                                columns={PERMISSION_COLUMNS}
                                rows={pagedPermissions.items}
                                rowKey={(perm) => perm.id}
                                caption="All permissions with their immutable machine names."
                                animate={false}
                                empty={
                                    <EmptyState
                                        icon={KeyRound}
                                        title="No permissions yet"
                                        description="Create your first permission to start assigning capabilities to roles."
                                        action={
                                            <Button size="sm" onClick={() => setIsPermModalOpen(true)}>
                                                <Plus className="size-4" aria-hidden="true" />
                                                <span>New Permission</span>
                                            </Button>
                                        }
                                    />
                                }
                                pagination={{
                                    page: pagedPermissions.page,
                                    pageSize: pagedPermissions.pageSize,
                                    total: pagedPermissions.total,
                                    onPageChange: pagedPermissions.setPage,
                                    onPageSizeChange: pagedPermissions.setPageSize,
                                    label: 'Permission pages',
                                    itemNoun: { one: 'permission', other: 'permissions' },
                                }}
                            />
                        </CardContent>
                    </Card>
                </section>
            </div>

            <PermissionModal
                isOpen={isPermModalOpen}
                onClose={() => setIsPermModalOpen(false)}
                onSuccess={refreshData}
            />

            <RoleConfigModal
                isOpen={!!configRole}
                onClose={() => setConfigRole(null)}
                role={configRole}
                allPermissions={permissions}
                onSuccess={refreshData}
            />
        </PageContainer>
    );
};

export default RolesAndPermissionsClient;
