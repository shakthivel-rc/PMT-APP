
import React, { useState, useEffect, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppDispatch } from '../../../app/hooks';
import { fetchUsers, fetchUserStats } from '../usersSlice';
import { addNotification } from '../../ui/uiSlice';
import { User, RoleDefinition } from '../../../types/index';
import { saveUserAction } from '../../../actions/userActions';
import { fetchRolesApi } from '../../../api/rbac';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface UserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  organization: '',
  department: '',
  role_id: '',
};

const formFromUser = (user: User): typeof EMPTY_FORM => ({
  first_name: user.first_name,
  last_name: user.last_name,
  username: user.username,
  email: user.email,
  organization: user.organization,
  department: user.department,
  role_id: user.roles[0]?.role_id || '',
});

const UserModal: React.FC<UserModalProps> = ({ user, isOpen, onClose }) => {
  // Initialised once from the prop, never re-synced by an effect. The reset effect this
  // replaces listed `roles` in its dependency array, so the moment fetchRolesApi() resolved
  // the array got a new identity, the effect re-ran, `user` was null for a create, and it
  // blanked all seven fields — destroying anything the admin had typed, silently. Resetting
  // between users is the `key` on this component in DashboardClient, per react.dev's
  // "You Might Not Need an Effect".
  const [formData, setFormData] = useState(() => (user ? formFromUser(user) : EMPTY_FORM));
  const [roles, setRoles] = useState<RoleDefinition[]>([]);

  const [isPending, startTransition] = useTransition();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (isOpen) {
      fetchRolesApi().then(setRoles).catch(() => {});
    }
  }, [isOpen]);

  // Derived at render, never written to state: an arriving `roles` array must not be able
  // to touch the form. That is the property that fixes the wipe.
  const selectedRoleId = formData.role_id || roles[0]?.id || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Functional form — the captured `formData` version dropped keystrokes whenever two
    // changes landed in the same batch.
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role_id: value }));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isPending) onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      // Resolve the same fallback the Select displays, so submitting without touching the
      // dropdown sends the default role rather than ''.
      const submitted = { ...formData, role_id: selectedRoleId };
      const payload = user
        ? { id: user.id, ...submitted }
        : submitted;
      const response = await saveUserAction(payload);

      if (response.success) {
        dispatch(fetchUsers());
        dispatch(fetchUserStats());

        dispatch(addNotification({
          type: 'success',
          message: user ? 'User updated successfully.' : 'User created successfully.'
        }));
        onClose();
      } else {
        dispatch(addNotification({
          type: 'error',
          message: response.error || 'Operation failed.'
        }));
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update this member's details and role."
              : 'Create a new member and assign their role.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form onSubmit={handleSubmit} id="user-form" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                type="text"
                name="first_name"
                id="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                disabled={isPending}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                type="text"
                name="last_name"
                id="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                disabled={isPending}
                autoComplete="family-name"
              />
            </div>
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                type="text"
                name="username"
                id="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isPending}
                autoComplete="username"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isPending}
              autoComplete="email"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                type="text"
                name="organization"
                id="organization"
                value={formData.organization}
                onChange={handleChange}
                required
                disabled={isPending}
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                type="text"
                name="department"
                id="department"
                value={formData.department}
                onChange={handleChange}
                required
                disabled={isPending}
                autoComplete="organization-title"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role_id">Role</Label>
            <Select
              value={selectedRoleId}
              onValueChange={handleRoleChange}
              disabled={isPending}
            >
              <SelectTrigger id="role_id" className="w-full">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={isPending} aria-busy={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {user ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
