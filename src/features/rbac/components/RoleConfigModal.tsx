
import React, { useState, useEffect, useTransition } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { RoleDefinition, Permission } from '../../../types/index';
import { updateRolePermissionsAction } from '../../../actions/rbacActions';
import { useAppDispatch } from '../../../app/hooks';
import { addNotification } from '../../ui/uiSlice';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { usePagination } from '@/lib/usePagination';

/**
 * How many switches fit in the dialog without it becoming a scroller.
 *
 * The list used to be a 400px-tall scroll box, which on a deployment with thirty
 * permissions hid most of them behind a scrollbar and gave no way to say where you were.
 * Paging it keeps the dialog one screen tall and the count honest.
 */
const PERMISSIONS_PER_PAGE = 6;

interface RoleConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    role: RoleDefinition | null;
    allPermissions: Permission[];
    onSuccess: () => void;
}

const RoleConfigModal: React.FC<RoleConfigModalProps> = ({ isOpen, onClose, role, allPermissions, onSuccess }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const dispatch = useAppDispatch();

    // Keyed on the role, so opening a different one starts at page 1 rather than on
    // whichever page the previous role was left on.
    const paged = usePagination(allPermissions, {
        pageSize: PERMISSIONS_PER_PAGE,
        resetKey: role?.id ?? null,
    });

    useEffect(() => {
        if (role) {
            setSelectedIds(new Set(role.permissions.map(p => p.id)));
        }
    }, [role, isOpen]);

    const togglePermission = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSave = () => {
        if (!role) return;
        startTransition(async () => {
            const response = await updateRolePermissionsAction(role.id, Array.from(selectedIds));
            if (response.success) {
                dispatch(addNotification({ type: 'success', message: `Updated permissions for ${role.name}` }));
                onSuccess();
                onClose();
            } else {
                dispatch(addNotification({ type: 'error', message: response.error || 'Failed update.' }));
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="break-words">Configure: {role?.name}</DialogTitle>
                    <DialogDescription>Select the permissions assigned to this role.</DialogDescription>
                </DialogHeader>

                {/* Everything between the two bars is one scroller. This list pages, but a
                    page of it still outgrew the viewport, and with no cap the footer — the
                    only way to save — was pushed off the bottom of the screen. */}
                <DialogBody className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Assigned permissions</span>
                    <StatusBadge tone="primary">{selectedIds.size} selected</StatusBadge>
                </div>

                {allPermissions.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {paged.items.map(perm => (
                            <div
                                key={perm.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                                {/* `min-w-0` on the flex item and a break rule on each token:
                                    a machine name is one unbreakable string, and without both
                                    it sets the dialog's minimum width. */}
                                <Label
                                    htmlFor={`perm-${perm.id}`}
                                    className="flex min-w-0 cursor-pointer flex-col items-start gap-0.5"
                                >
                                    <span className="break-words font-medium text-foreground">{perm.permission_name}</span>
                                    <span className="font-mono text-xs break-all text-muted-foreground">{perm.machine_name}</span>
                                </Label>
                                <Switch
                                    id={`perm-${perm.id}`}
                                    checked={selectedIds.has(perm.id)}
                                    onCheckedChange={() => togglePermission(perm.id)}
                                    disabled={isPending}
                                    aria-label={`Toggle ${perm.permission_name}`}
                                />
                            </div>
                        ))}

                        <Pagination
                            page={paged.page}
                            pageSize={paged.pageSize}
                            total={paged.total}
                            onPageChange={paged.setPage}
                            label="Permission list pages"
                            itemNoun={{ one: 'permission', other: 'permissions' }}
                            hideWhenSinglePage
                            disabled={isPending}
                            className="p-0 pt-3"
                        />
                    </div>
                ) : (
                    <EmptyState
                        icon={KeyRound}
                        title="No permissions available"
                        description="Create a permission first, then assign it to this role."
                    />
                )}
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RoleConfigModal;
