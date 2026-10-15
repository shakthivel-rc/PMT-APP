
import React, { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppDispatch } from '../../../app/hooks';
import { addNotification } from '../../ui/uiSlice';
import { createPermissionAction } from '../../../actions/rbacActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [machineName, setMachineName] = useState('');
  const [isPending, startTransition] = useTransition();
  const dispatch = useAppDispatch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
        const payload: { name: string; machine_name?: string } = { name };
        if (machineName.trim()) {
            payload.machine_name = machineName.trim();
        }
        const response = await createPermissionAction(payload);
        if (response.success) {
            dispatch(addNotification({ type: 'success', message: 'Permission created successfully.' }));
            setName('');
            setMachineName('');
            onSuccess();
            onClose();
        } else {
            dispatch(addNotification({ type: 'error', message: response.error || 'Failed.' }));
        }
    });
  };

  return (
    <Dialog
        open={isOpen}
        onOpenChange={(open) => {
            if (!open && !isPending) onClose();
        }}
    >
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Create New Permission</DialogTitle>
                <DialogDescription>Define a fine-grained capability for the RBAC system.</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <form id="perm-form" onSubmit={handleSubmit} className="grid gap-3">
                <div className="grid gap-1.5">
                    <Label htmlFor="perm-name">Permission Name</Label>
                    <Input
                        id="perm-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Delete Reports"
                        autoComplete="off"
                        required
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="perm-machine-name">
                        Machine Name <span className="text-xs text-muted-foreground font-normal">(Optional, e.g. reports:delete)</span>
                    </Label>
                    <Input
                        id="perm-machine-name"
                        value={machineName}
                        onChange={e => setMachineName(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                        autoComplete="off"
                        className="font-mono text-xs"
                    />
                </div>
              </form>
            </DialogBody>

            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={isPending}>
                    Cancel
                </Button>
                <Button type="submit" form="perm-form" disabled={isPending}>
                    {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    Create
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
};

export default PermissionModal;
