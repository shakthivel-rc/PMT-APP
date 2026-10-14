import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { addMemberApi, fetchMembersApi, removeMemberApi, updateMemberApi } from '@/api/workspaces';
import { useAppSelector } from '@/app/hooks';
import { canManageWorkspace, type MemberSummary, type WorkspaceRole } from '@/types';
import { assignableRoles, canManageMember } from '@/lib/workspaceRules';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage, humanize } from '../presentation';

const ROLE_HINTS: Record<WorkspaceRole, string> = {
  guest: 'Reads only',
  member: 'Creates and edits issues',
  admin: 'Also manages spaces, lists and members',
  owner: 'Admin who can also grant owner',
};

const nameOf = (member: MemberSummary) => `${member.first_name} ${member.last_name}`.trim() || member.email;

/** A change that asks first, and the control it was asked from, which focus goes back to. */
interface Confirming {
  kind: 'remove' | 'leave' | 'demote';
  member: MemberSummary;
  /** The role asked for, for `demote`. */
  role?: WorkspaceRole;
  from: HTMLElement | null;
}

/** What each confirm says. Everything a removal leaves behind is kept: assigned issues stay assigned. */
function confirmCopy({ kind, member, role }: Confirming, workspaceName: string) {
  if (kind === 'remove') {
    return {
      title: `Remove ${nameOf(member)}?`,
      description: `They lose access to ${workspaceName} at once. Issues assigned to them stay assigned, and their history is kept.`,
      confirmLabel: 'Remove',
    };
  }
  if (kind === 'leave') {
    return {
      title: `Leave ${workspaceName}?`,
      description: 'You lose access to it at once. To come back, an admin or owner has to add you again.',
      confirmLabel: 'Leave workspace',
    };
  }
  return {
    title: `Change your own role to ${humanize(role ?? member.role)}?`,
    description: `You cannot undo this yourself: ${member.role === 'owner' ? 'another owner' : 'an admin or owner'} would have to.`,
    confirmLabel: 'Change my role',
  };
}

interface MemberRowProps {
  member: MemberSummary;
  /** The caller's role, which decides what the row offers. */
  caller: WorkspaceRole;
  /** The caller's own row, which offers Leave rather than Remove. */
  own: boolean;
  /** A change to this row is in flight. */
  busy: boolean;
  /** The role that change asked for, shown until the answer; a refusal puts the old one back. */
  pendingRole?: WorkspaceRole;
  /** A change to any row is in flight. */
  locked: boolean;
  onRole: (member: MemberSummary, role: WorkspaceRole, from: HTMLElement | null) => void;
  onAsk: (kind: 'remove' | 'leave', member: MemberSummary, from: HTMLElement) => void;
}

/**
 * One member: a role select where the caller may change it and a badge where not, Remove for
 * someone the caller manages, and Leave on the caller's own row.
 */
const MemberRow = ({ member, caller, own, busy, pendingRole, locked, onRole, onAsk }: MemberRowProps) => {
  const roleTrigger = useRef<HTMLButtonElement>(null);
  const name = nameOf(member);
  const editable = canManageMember(caller, member.role);

  return (
    <li aria-busy={busy || undefined} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <div className="flex items-center gap-2">
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
        {editable ? (
          <Select
            value={pendingRole ?? member.role}
            onValueChange={(next) => onRole(member, next as WorkspaceRole, roleTrigger.current)}
          >
            <SelectTrigger
              ref={roleTrigger}
              size="sm"
              className="w-28"
              aria-label={`Role of ${name}`}
              // The select a change was just made with has focus, so it stays enabled (and is
              // ignored until the answer comes); every other control waits, disabled.
              disabled={locked && !busy}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles(caller).map((r) => (
                <SelectItem key={r} value={r}>
                  {humanize(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusBadge tone="neutral">{humanize(member.role)}</StatusBadge>
        )}
        {own ? (
          <Button variant="outline" size="sm" disabled={locked} onClick={(e) => onAsk('leave', member, e.currentTarget)}>
            <LogOut aria-hidden="true" />
            Leave workspace
          </Button>
        ) : (
          editable && (
            <Button
              variant="ghost"
              size="sm"
              // Starts with the visible word, so a voice command naming what is on screen still works.
              aria-label={`Remove ${name}`}
              disabled={locked}
              onClick={(e) => onAsk('remove', member, e.currentTarget)}
            >
              Remove
            </Button>
          )
        )}
      </div>
    </li>
  );
};

interface MembersDialogProps {
  workspaceId: string;
  workspaceName: string;
  /** The caller's role: decides what the dialog offers until the member list says otherwise. */
  role: WorkspaceRole;
  onClose: () => void;
}

/**
 * Who is in the workspace. Admins and owners also add an existing account, change roles and
 * remove members; anyone may leave. A workspace is visible only to its members, so this is how
 * anyone else gets to see it.
 *
 * The rules in `lib/workspaceRules.ts` decide what is offered, and the API decides what happens:
 * its 403s and 409s (the last owner, something a member still owns) are shown here as worded.
 */
const MembersDialog = ({ workspaceId, workspaceName, role, onClose }: MembersDialogProps) => {
  const navigate = useNavigate();
  const me = useAppSelector((state) => state.auth.user?.id);
  // Opened from state rather than from a `DialogTrigger`, so Radix has nothing to give focus
  // back to on close: remember what had it when the dialog opened.
  const [opener] = useState(() => document.activeElement);
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<WorkspaceRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ userId: string; role?: WorkspaceRole } | null>(null);
  // Kept after the confirm closes, so its words hold still while it animates out and focus can
  // still go back to where it was asked from.
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  // The caller's role as their own row has it, once loaded: a change made here can lower it,
  // and what the dialog offers has to follow.
  const caller = members?.find((m) => m.user_id === me)?.role ?? role;
  const manage = canManageWorkspace(caller);
  const offered = assignableRoles(caller);

  useEffect(() => {
    let cancelled = false;
    fetchMembersApi(workspaceId)
      .then((rows) => !cancelled && setMembers(rows))
      .catch((err: unknown) => !cancelled && setLoadError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const address = email.trim();
    startTransition(async () => {
      try {
        const added = await addMemberApi(workspaceId, { email: address, role: newRole });
        setMembers((rows) => [...(rows ?? []), added]);
        setEmail('');
        setNewRole('member');
        toast.success(`${address} added as ${humanize(added.role)}.`);
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  };

  /** One change to one row, which is busy meanwhile. A refusal is shown above the list. */
  const change = (member: MemberSummary, work: () => Promise<void>, pendingRole?: WorkspaceRole) => {
    setChangeError(null);
    setBusy({ userId: member.user_id, role: pendingRole });
    startTransition(async () => {
      try {
        await work();
      } catch (err) {
        // 403 and 409 come worded to be shown: who may make this change, or what to change first.
        setChangeError(errorMessage(err));
      }
      setBusy(null);
      setConfirmOpen(false);
    });
  };

  const setRole = (member: MemberSummary, next: WorkspaceRole) =>
    change(
      member,
      async () => {
        const updated = await updateMemberApi(workspaceId, member.user_id, { role: next });
        setMembers((rows) => rows && rows.map((m) => (m.user_id === updated.user_id ? updated : m)));
        toast.success(`${nameOf(updated)} is now ${humanize(updated.role)}.`);
      },
      next,
    );

  const remove = (member: MemberSummary) =>
    change(member, async () => {
      await removeMemberApi(workspaceId, member.user_id);
      setMembers((rows) => rows && rows.filter((m) => m.user_id !== member.user_id));
      toast.success(`${nameOf(member)} removed from ${workspaceName}.`);
    });

  const leave = (member: MemberSummary) =>
    change(member, async () => {
      await removeMemberApi(workspaceId, member.user_id);
      toast.success(`You left ${workspaceName}.`);
      // Replaced rather than pushed: every URL of this workspace now answers 404, Back included.
      navigate('/projects', { replace: true });
      onClose();
    });

  const ask = (next: Confirming) => {
    setConfirming(next);
    setConfirmOpen(true);
  };

  const onRole = (member: MemberSummary, next: WorkspaceRole, from: HTMLElement | null) => {
    if (busy || next === member.role) return;
    // A change to your own role can only lower it, and you cannot undo it, so it asks first.
    if (member.user_id === me) ask({ kind: 'demote', member, role: next, from });
    else setRole(member, next);
  };

  const confirmed = () => {
    if (!confirming) return;
    const { kind, member, role: next } = confirming;
    if (kind === 'remove') remove(member);
    else if (kind === 'leave') leave(member);
    else if (next) setRole(member, next);
  };

  /**
   * Back to the control a confirm was asked from, which is still there after Cancel or a
   * refusal. A removal takes its row away, and lowering your own role can take your select with
   * it, so then focus lands on the list.
   */
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const from = confirming?.from;
    (from?.isConnected ? from : listRef.current)?.focus();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Members of {workspaceName}</DialogTitle>
          <DialogDescription>
            Only members see this workspace and its spaces, lists and issues.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          {loadError ? (
            <FormMessage>{loadError}</FormMessage>
          ) : members === null ? (
            <div role="status" aria-label="Loading members" className="grid gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <>
              {changeError && <FormMessage>{changeError}</FormMessage>}
              <ul
                ref={listRef}
                // Focusable, not tabbable: where focus lands when a removal takes its row away.
                tabIndex={-1}
                aria-label="Members"
                className="divide-y divide-border rounded-md border border-border"
              >
                {members.map((m) => (
                  <MemberRow
                    key={m.user_id}
                    member={m}
                    caller={caller}
                    own={m.user_id === me}
                    busy={busy?.userId === m.user_id}
                    pendingRole={busy?.userId === m.user_id ? busy.role : undefined}
                    // `busy`, not the transition's `isPending`: it clears in the same render that
                    // closes a confirm, and the confirm hands focus back to one of these controls,
                    // which a still-disabled control cannot take. `isPending` can lag by a render.
                    locked={busy !== null}
                    onRole={onRole}
                    onAsk={(kind, member, from) => ask({ kind, member, from })}
                  />
                ))}
              </ul>
            </>
          )}

          {manage && (
            <form id="member-form" onSubmit={handleSubmit} className="grid gap-3">
              <h3 className="text-sm font-semibold">Add a member</h3>
              {error && <FormMessage>{error}</FormMessage>}
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <div className="grid gap-1.5">
                  <Label htmlFor="member-email">Email</Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dev@example.com"
                    maxLength={100}
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="member-role">Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as WorkspaceRole)}>
                    <SelectTrigger id="member-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {offered.map((r) => (
                        <SelectItem key={r} value={r}>
                          {humanize(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {ROLE_HINTS[newRole]}. The account must already exist — invite them from User Management first.
              </p>
            </form>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Close
          </Button>
          {manage && (
            <Button type="submit" form="member-form" disabled={isPending}>
              {/* Spins for an add only: a row's change shows on its row. */}
              {isPending && !busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Add member
            </Button>
          )}
        </DialogFooter>

        {/* Inside the dialog's content, not beside it: Radix treats a dialog opened from within
            another as part of it, so a click in this one does not count as outside the first. */}
        {confirming && (
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={(open) => !open && !isPending && setConfirmOpen(false)}
            {...confirmCopy(confirming, workspaceName)}
            destructive
            loading={isPending}
            onConfirm={confirmed}
            onCloseAutoFocus={restoreFocus}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MembersDialog;
