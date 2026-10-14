
import React, { useState, useEffect } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchUsers } from '../usersSlice';
import UserTable from './UserTable';
import UserModal from './UserModal';
import UserStats from './UserStats';
import { User, hasPermission } from '../../../types/index';
import { DashboardSkeleton } from './Dashboard';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const DashboardClient: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const status = useAppSelector((state) => state.users.status);
  const hasLoadedOnce = useAppSelector((state) => state.users.users.length > 0);

  // The store is the only owner of this data now — no promise cache, no hydration prop.
  // Fetching only while `idle` means navigating away and back re-renders from the store
  // instead of re-requesting, while a mutation that resets the status refetches.
  useEffect(() => {
    if (status === 'idle') dispatch(fetchUsers());
  }, [status, dispatch]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleOpenModal = (user: User | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const canAddUsers =
    hasPermission(currentUser, ['manage_users']) ||
    hasPermission(currentUser, ['users:create']);

  // First load only. A refetch after a mutation keeps the current rows on screen rather
  // than replacing the whole page with a skeleton.
  if (status === 'idle' || (status === 'loading' && !hasLoadedOnce)) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage your team members and permissions."
        icon={Users}
        actions={
          canAddUsers ? (
            <Button onClick={() => handleOpenModal()}>
              <UserPlus aria-hidden="true" />
              Add member
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* UserStats renders its own placeholder now — nothing here suspends. */}
        <UserStats />

        <Card className="overflow-hidden p-0">
          <UserTable onEditUser={handleOpenModal} />
        </Card>
      </div>

      {/*
        The `key` is the reset mechanism. UserModal initialises its form once from `user`,
        so switching between "add" and editing a different member has to remount it —
        which is react.dev's recommended alternative to an effect that syncs a prop into
        state, and is what let that effect (and the field-wipe it caused) be deleted.
      */}
      <UserModal
        key={editingUser?.id ?? 'new'}
        isOpen={isModalOpen}
        user={editingUser}
        onClose={handleCloseModal}
      />
    </>
  );
};

export default DashboardClient;
