import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Folder, Layers, Loader2, Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { createListApi, createSpaceApi } from '@/api/workspaces';
import { canManageWorkspace, type FolderNode, type ListNode, type SpaceNode, type WorkspaceTree } from '@/types';
import { spaceHref } from './SpaceView';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
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
import { cn } from '@/lib/utils';
import { errorMessage, humanize } from '../presentation';
import { spaceKeyProblem, useFieldProblem } from '../fieldRules';

/** What the create dialog is creating, and where. */
type CreateTarget = { kind: 'space' } | { kind: 'list'; space: SpaceNode; folder: FolderNode | null };

interface CreateDialogProps {
  workspaceId: string;
  target: CreateTarget;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}

/**
 * Mounted per open (the caller keys it), so every open starts from empty fields rather than
 * resetting them in an effect.
 */
const CreateDialog = ({ workspaceId, target, onClose, onCreated }: CreateDialogProps) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const keyRef = useRef<HTMLInputElement>(null);
  const keyProblem = target.kind === 'space' ? spaceKeyProblem(key) : null;
  const keyCheck = useFieldProblem(keyProblem);
  const where = target.kind === 'list' ? (target.folder ?? target.space).name : '';
  // The hint shows the numbering the typed key will give, so the prefix/number split is visible.
  const example = keyProblem === null && key !== '' ? key : 'PAY';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (keyProblem) {
      keyCheck.reveal();
      keyRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        if (target.kind === 'space') {
          await createSpaceApi(workspaceId, { name: name.trim(), key });
          await onCreated();
          toast.success(`Space ${name.trim()} created.`);
          onClose();
        } else {
          const list = await createListApi(workspaceId, {
            space_id: target.space.id,
            folder_id: target.folder?.id ?? null,
            name: name.trim(),
          });
          await onCreated();
          onClose();
          navigate(`/projects/${workspaceId}/lists/${list.id}`);
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target.kind === 'space' ? 'New space' : `New list in ${where}`}</DialogTitle>
          <DialogDescription>
            {target.kind === 'space'
              ? 'A space has its own workflow and issue keys. It starts with four columns.'
              : 'A list holds issues and has a board.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="hierarchy-form" onSubmit={handleSubmit} className="grid gap-4">
            {error && <FormMessage>{error}</FormMessage>}
            <div className="grid gap-2">
              <Label htmlFor="hierarchy-name">Name</Label>
              <Input
                id="hierarchy-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoComplete="off"
                required
              />
            </div>
            {target.kind === 'space' && (
              <div className="grid gap-2">
                <Label htmlFor="hierarchy-key">Key prefix</Label>
                <Input
                  ref={keyRef}
                  id="hierarchy-key"
                  value={key}
                  // Upper-cased as typed: the API only accepts upper case, and a key refused
                  // for being `pay` rather than `PAY` is a pointless round trip.
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  onBlur={keyCheck.reveal}
                  placeholder="PAY"
                  // No `pattern`: the browser's message for it names no fix. `spaceKeyProblem` does.
                  maxLength={10}
                  autoComplete="off"
                  aria-invalid={keyCheck.shown ? true : undefined}
                  aria-describedby={keyCheck.shown ? 'hierarchy-key-hint hierarchy-key-error' : 'hierarchy-key-hint'}
                  className="font-mono"
                  required
                />
                <p id="hierarchy-key-hint" className="text-xs text-muted-foreground">
                  2–10 letters or digits, starting with a letter. The number is added for you: issues become{' '}
                  <span className="font-mono">{example}-1</span>, <span className="font-mono">{example}-2</span> and
                  so on.
                </p>
                {keyCheck.shown && (
                  <p id="hierarchy-key-error" className="text-xs text-danger">
                    {keyCheck.shown}
                  </p>
                )}
              </div>
            )}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="hierarchy-form" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface HierarchyPanelProps {
  tree: WorkspaceTree;
  activeListId?: string;
  activeSpaceId?: string;
  activeSpaceTab?: string;
  activeSection?: string;
  onChanged: () => Promise<unknown>;
}

/**
 * Spaces › folders › lists, from one read of the workspace tree.
 *
 * The create controls are rendered for admins and owners only. The API is what enforces
 * that; hiding them is so a member is not offered a form whose only possible answer is 403.
 */
const HierarchyPanel = ({
  tree,
  activeListId,
  activeSpaceId,
  activeSpaceTab,
  activeSection,
  onChanged,
}: HierarchyPanelProps) => {
  const [target, setTarget] = useState<CreateTarget | null>(null);
  const [opened, setOpened] = useState(0);
  const [params] = useSearchParams();
  const manage = canManageWorkspace(tree.role);
  // Carry the view choice across lists: someone reading lists as tables wants the next one
  // as a table too.
  const search = params.get('view') === 'list' ? '?view=list' : '';

  const open = (next: CreateTarget) => {
    setTarget(next);
    setOpened((n) => n + 1);
  };

  const listLink = (list: ListNode) => (
    <li key={list.id}>
      <NavLink
        to={`/projects/${tree.id}/lists/${list.id}${search}`}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          list.id === activeListId
            ? 'bg-primary/15 font-semibold text-primary border-l-2 border-primary pl-2.5'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
      >
        <span className="truncate">{list.name}</span>
      </NavLink>
    </li>
  );

  const addList = (space: SpaceNode, folder: FolderNode | null) =>
    manage && (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`New list in ${(folder ?? space).name}`}
        onClick={() => open({ kind: 'list', space, folder })}
      >
        <Plus aria-hidden="true" />
      </Button>
    );

  return (
    <nav aria-label="Workspace hierarchy" className="flex flex-col gap-5 p-4">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          All workspaces
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">{tree.name}</h1>
            <Button
              asChild
              variant="ghost"
              size="icon-xs"
              aria-label="Common Settings (All Projects)"
              title="Common Settings (All Projects)"
              className={cn(
                'text-muted-foreground hover:text-foreground shrink-0',
                activeSection === 'settings' && 'text-primary bg-accent',
              )}
            >
              <Link to={`/projects/${tree.id}/settings`}>
                <Settings className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <StatusBadge tone="neutral">{humanize(tree.role)}</StatusBadge>
        </div>
        <div className="mt-2 space-y-1">
          <NavLink
            to={`/projects/${tree.id}/settings`}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              activeSection === 'settings'
                ? 'bg-primary/15 font-semibold text-primary border-l-2 border-primary pl-2.5'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Settings className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Common Settings (All Projects)</span>
          </NavLink>
          <NavLink
            to={`/projects/${tree.id}/initiatives`}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              activeSection === 'initiatives'
                ? 'bg-primary/15 font-semibold text-primary border-l-2 border-primary pl-2.5'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Portfolio Initiatives</span>
          </NavLink>
        </div>
      </div>

      {tree.spaces.map((space) => {
        const isCurrentSpace = activeSpaceId === space.id;
        const isSettingsActive = isCurrentSpace && activeSpaceTab === 'settings';

        return (
          <div key={space.id}>
            <div className="flex items-center justify-between gap-1 px-2 group">
              <h2 className="flex-1 min-w-0 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Link
                  to={spaceHref(tree.id, space.id)}
                  className={cn(
                    'truncate hover:text-foreground transition-colors',
                    isCurrentSpace && !activeSpaceTab && 'text-foreground font-bold',
                  )}
                  title={`${space.name} (${space.key})`}
                >
                  {space.name} <span className="font-mono normal-case">· {space.key}</span>
                </Link>
              </h2>
              <div className="flex items-center gap-0.5">
                <Button
                  asChild
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Project Settings for ${space.name}`}
                  title={`Project Settings for ${space.name}`}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    isSettingsActive && 'text-primary bg-accent',
                  )}
                >
                  <Link to={spaceHref(tree.id, space.id, 'settings')}>
                    <Settings className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
                {addList(space, null)}
              </div>
            </div>
            <ul className="mt-1 space-y-0.5">
              {space.folders.map((folder) => (
                <li key={folder.id}>
                  <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                    <Folder className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{folder.name}</span>
                    {addList(space, folder)}
                  </div>
                  <ul className="ml-4 space-y-0.5">{folder.lists.map(listLink)}</ul>
                </li>
              ))}
              {space.lists.map(listLink)}
            </ul>
          </div>
        );
      })}

      {tree.spaces.length === 0 && <p className="px-2 text-sm text-muted-foreground">No spaces yet.</p>}

      {manage && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => open({ kind: 'space' })}
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 font-medium shadow-2xs transition-colors"
        >
          <Plus className="size-4 mr-1 text-primary" aria-hidden="true" />
          New space
        </Button>
      )}

      {target && (
        <CreateDialog
          key={opened}
          workspaceId={tree.id}
          target={target}
          onClose={() => setTarget(null)}
          onCreated={onChanged}
        />
      )}
    </nav>
  );
};

export default HierarchyPanel;
