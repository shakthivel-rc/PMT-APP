
import React, { useState, useMemo, useTransition } from 'react';
import { Search, Pencil, Trash2, UsersRound } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchUsers, fetchUserStats } from '../usersSlice';
import { addNotification } from '../../ui/uiSlice';
import { deleteUserAction } from '../../../actions/userActions';
import { User, getDisplayName, getUserRoleName, hasPermission } from '../../../types/index';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, type Tone } from '@/components/StatusBadge';
import UserAvatar from '@/components/UserAvatar';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePagination } from '@/lib/usePagination';
import { cn } from '@/lib/utils';

interface UserTableProps {
  onEditUser: (user: User) => void;
}

function roleTone(role: string): Tone {
  switch (role.toLowerCase()) {
    case 'admin':
    case 'administrator':
      return 'danger';
    case 'manager':
      return 'warning';
    case 'member':
    case 'user':
    case 'standard user':
      return 'primary';
    case 'no role':
      return 'neutral';
    default:
      return 'info';
  }
}

const UserTable: React.FC<UserTableProps> = ({ onEditUser }) => {
  const dispatch = useAppDispatch();
  const { users } = useAppSelector((state) => state.users);
  const { user: currentUser } = useAppSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [isPending, startTransition] = useTransition();

  // Get unique role names from users
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    users.forEach(u => {
      const roleName = getUserRoleName(u);
      if (roleName !== 'No Role') roles.add(roleName);
    });
    return Array.from(roles);
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const displayName = getDisplayName(user).toLowerCase();
      const matchesSearch =
        displayName.includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const userRole = getUserRoleName(user);
      const matchesRole = roleFilter === 'All' || userRole === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Client-side: the whole list is already in the store, and a round trip per keystroke
  // would be slower and no more correct. Narrowing the list returns to page 1 — page 3 of
  // the previous search is not page 3 of this one.
  const paged = usePagination(filteredUsers, { resetKey: `${searchQuery}|${roleFilter}` });

  const performDelete = () => {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      const response = await deleteUserAction(target.id);
      if (response.success) {
        // Both, and through the store: the KPI tiles are derived from the same list, and
        // leaving them stale is what made "Total Users" wrong for the rest of the session.
        dispatch(fetchUsers());
        dispatch(fetchUserStats());
        dispatch(addNotification({ type: 'success', message: 'User deleted successfully.' }));
      } else {
        dispatch(addNotification({ type: 'error', message: response.error || 'Failed to delete.' }));
      }
      setDeleteTarget(null);
    });
  };

  const canEdit = () => {
    return hasPermission(currentUser, ['manage_users']) || hasPermission(currentUser, ['users:update']);
  };

  const canDelete = (user: User) => {
    if (!currentUser) return false;
    return (
      (hasPermission(currentUser, ['manage_users']) || hasPermission(currentUser, ['users:delete'])) &&
      currentUser.id !== user.id
    );
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={getDisplayName(user)} avatarUrl={user.avatarUrl} className="size-8" />
          <span className="font-medium">{getDisplayName(user)}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cellClassName: 'text-muted-foreground',
      cell: (user) => user.email,
    },
    {
      key: 'role',
      header: 'Role',
      cell: (user) => (
        <StatusBadge tone={roleTone(getUserRoleName(user))}>{getUserRoleName(user)}</StatusBadge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => (
        <StatusBadge tone={user.status ? 'success' : 'neutral'}>
          {user.status ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit() && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditUser(user)}
              aria-label={`Edit ${getDisplayName(user)}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
          )}
          {canDelete(user) && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-danger hover:text-danger"
              onClick={() => setDeleteTarget(user)}
              aria-label={`Delete ${getDisplayName(user)}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Label htmlFor="user-search" className="sr-only">Search users</Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="user-search"
            type="search"
            className="pl-9"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="sm:w-56">
          <Label htmlFor="role-filter" className="sr-only">Filter by role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger id="role-filter" className="w-full">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Roles</SelectItem>
              {uniqueRoles.map((role) => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        aria-busy={isPending}
        className={cn('transition-opacity', isPending && 'pointer-events-none opacity-60')}
      >
        <DataTable
          columns={columns}
          rows={paged.items}
          rowKey={(user) => user.id}
          caption="List of users with their role, status and available actions"
          empty={
            <EmptyState
              icon={UsersRound}
              title="No users found"
              description="No users match your current search or filter."
            />
          }
          pagination={{
            page: paged.page,
            pageSize: paged.pageSize,
            total: paged.total,
            onPageChange: paged.setPage,
            onPageSizeChange: paged.setPageSize,
            label: 'User pages',
            itemNoun: { one: 'user', other: 'users' },
          }}
        />
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleteTarget(null);
        }}
        title="Delete user"
        description={
          deleteTarget
            ? `This will permanently remove ${getDisplayName(deleteTarget)}. This action cannot be undone.`
            : 'This action cannot be undone.'
        }
        confirmLabel="Delete"
        destructive
        loading={isPending}
        onConfirm={performDelete}
      />
    </>
  );
};

export default UserTable;
