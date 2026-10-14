import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteWorkspaceApi, updateWorkspaceApi } from '@/api/workspaces';
import type { WorkspaceSummary, WorkspaceUpdate } from '@/types';
import FormMessage from '@/components/FormMessage';
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
import { errorMessage } from '../presentation';
import { slugProblem, useFieldProblem } from '../fieldRules';
import WorkspaceFields from './WorkspaceFields';

/*
 * The two dialogs a workspace's actions menu opens on the Projects page. Each is mounted per
 * open, so it starts from the workspace as listed rather than resetting itself in an effect.
 */

interface WorkspaceDialogProps {
  workspace: WorkspaceSummary;
  onClose: () => void;
  /**
   * Where focus goes once the dialog has closed. Radix gives it back to a `DialogTrigger`, and
   * these dialogs open from a menu item instead, so the page decides.
   */
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * Rename a workspace, or change its slug. Unlike on create, the slug does not follow the name:
 * it is already in links, and a rename must not quietly change them.
 */
export const EditWorkspaceDialog = ({
  workspace,
  onClose,
  onCloseAutoFocus,
  onSaved,
}: WorkspaceDialogProps & { onSaved: (workspace: WorkspaceSummary) => void }) => {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const slugCheck = useFieldProblem(slugProblem(slug));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    // `required` stops an empty name; this stops one of spaces, which the API's 422 would only
    // call "not valid".
    if (!trimmed) {
      setError('Enter a name.');
      nameRef.current?.focus();
      return;
    }
    if (slugProblem(slug)) {
      slugCheck.reveal();
      slugRef.current?.focus();
      return;
    }
    // Only what changed: an empty body is a 422, and an unchanged slug is no reason to send it.
    const changes: WorkspaceUpdate = {};
    if (trimmed !== workspace.name) changes.name = trimmed;
    if (slug !== workspace.slug) changes.slug = slug;
    if (changes.name === undefined && changes.slug === undefined) {
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        const saved = await updateWorkspaceApi(workspace.id, changes);
        toast.success(`${saved.name} saved.`);
        onSaved(saved);
      } catch (err) {
        // A taken slug is a 409 that says so, a deleted workspace's included; a malformed one a 422.
        setError(errorMessage(err));
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Edit {workspace.name}</DialogTitle>
          <DialogDescription>Every member sees the change at once.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="edit-workspace-form" onSubmit={handleSubmit} className="grid gap-4">
            {error && <FormMessage>{error}</FormMessage>}
            <WorkspaceFields
              idPrefix="edit-workspace"
              name={name}
              slug={slug}
              onNameChange={setName}
              onSlugChange={setSlug}
              slugCheck={slugCheck}
              nameRef={nameRef}
              slugRef={slugRef}
            />
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-workspace-form" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Owners only. The delete is soft: the workspace disappears for every member, and what was in it
 * stays in the database. Typing the name is the confirmation, because the menu that opens this
 * sits beside every other workspace, and their names can differ by a word.
 */
export const DeleteWorkspaceDialog = ({
  workspace,
  onClose,
  onCloseAutoFocus,
  onDeleted,
}: WorkspaceDialogProps & { onDeleted: (workspaceId: string) => void }) => {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmed = typed.trim() === workspace.name.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Enter in the field submits the form even while the button is disabled.
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteWorkspaceApi(workspace.id);
        toast.success(`${workspace.name} deleted.`);
        onDeleted(workspace.id);
      } catch (err) {
        // A 409 names what would keep running unseen, such as a timer on one of its issues.
        setError(errorMessage(err));
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Delete {workspace.name}?</DialogTitle>
          <DialogDescription>
            Every member loses the workspace and everything in it: its spaces, lists, issues and logged time. Its
            history is kept, but it is not shown anywhere any more.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="delete-workspace-form" onSubmit={handleSubmit} className="grid gap-4">
            {error && <FormMessage>{error}</FormMessage>}
            <div className="grid gap-2">
              <Label htmlFor="delete-workspace-name" className="block leading-snug">
                To confirm, type <span className="font-semibold">{workspace.name}</span>
              </Label>
              <Input
                id="delete-workspace-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="delete-workspace-form" variant="destructive" disabled={!confirmed || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Delete workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
