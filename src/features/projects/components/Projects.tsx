import { useEffect, useRef, useState, useTransition, type FormEvent, type Ref } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Ellipsis, FolderKanban, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createWorkspaceApi, fetchWorkspacesApi } from '@/api/workspaces';
import { canManageWorkspace, type WorkspaceSummary } from '@/types';
import { canDeleteWorkspace } from '@/lib/workspaceRules';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { errorMessage, humanize } from '../presentation';
import { slugProblem, useFieldProblem } from '../fieldRules';
import WorkspaceFields from './WorkspaceFields';
import { DeleteWorkspaceDialog, EditWorkspaceDialog } from './WorkspaceDialogs';

/** A slug suggested from the name: `Acme Engineering` → `acme-engineering`. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

/**
 * Name and slug. The slug follows the name until someone edits it — after that it is theirs,
 * and retyping the name must not overwrite what they chose. It appears in shared links, so it
 * is worth offering a sensible one rather than an empty box.
 */
const CreateWorkspaceForm = ({ nameRef }: { nameRef?: Ref<HTMLInputElement> }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const slugRef = useRef<HTMLInputElement>(null);
  const slugCheck = useFieldProblem(slugProblem(slug));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (slugProblem(slug)) {
      slugCheck.reveal();
      slugRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const workspace = await createWorkspaceApi({ name: name.trim(), slug });
        toast.success(`${workspace.name} created.`);
        navigate(`/projects/${workspace.id}`);
      } catch (err) {
        // A taken slug is a 409 and a malformed one a 422; both messages name the field.
        setError(errorMessage(err));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid w-full max-w-sm gap-4 text-left">
      {error && <FormMessage>{error}</FormMessage>}
      <WorkspaceFields
        idPrefix="workspace"
        name={name}
        slug={slug}
        onNameChange={(value) => {
          setName(value);
          if (!slugEdited) setSlug(slugify(value));
        }}
        onSlugChange={(value) => {
          setSlug(value);
          setSlugEdited(true);
        }}
        slugCheck={slugCheck}
        nameRef={nameRef}
        slugRef={slugRef}
      />
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Create workspace
      </Button>
    </form>
  );
};

/** A dialog an actions menu opened, and the menu's button, which focus returns to. */
interface OpenDialog {
  kind: 'edit' | 'delete';
  workspace: WorkspaceSummary;
  trigger: HTMLButtonElement | null;
}

/**
 * Edit, and for an owner Delete. It sits beside the card's link rather than inside it: a button
 * inside a link is two controls in one, which neither a keyboard nor a screen reader can tell
 * apart.
 */
const WorkspaceActions = ({
  workspace,
  onOpen,
}: {
  workspace: WorkspaceSummary;
  onOpen: (dialog: OpenDialog) => void;
}) => {
  const trigger = useRef<HTMLButtonElement>(null);
  // Set when an item opens a dialog, so that the closing menu does not pull focus back out of it.
  const opening = useRef(false);
  const open = (kind: OpenDialog['kind']) => {
    opening.current = true;
    onOpen({ kind, workspace, trigger: trigger.current });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} variant="ghost" size="icon-sm" aria-label={`Actions for ${workspace.name}`}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (opening.current) event.preventDefault();
          opening.current = false;
        }}
      >
        {canManageWorkspace(workspace.role) && (
          <DropdownMenuItem onSelect={() => open('edit')}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        )}
        {canDeleteWorkspace(workspace.role) && (
          <DropdownMenuItem variant="destructive" onSelect={() => open('delete')}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * `/projects`: the workspaces the caller belongs to, the way to start one, and for admins and
 * owners the way to change one.
 */
const Projects = () => {
  const navigate = useNavigate();
  // The workspace whose URL is open, if any. This page is routed at `/projects` itself, so today
  // that is none; the check keeps a delete from stranding anyone on routes that now only 404.
  // `useParams` rather than `useMatch`: the router's initial chunk already ships it.
  const { workspaceId: openWorkspaceId } = useParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspacesApi()
      .then((list) => {
        if (!cancelled) setWorkspaces(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * After an edit or a delete, which are already on screen: read the list again, because the
   * API orders it by name and may know of other changes. A failed re-read leaves the list as it
   * is; it has nothing to tell the person that the change itself did not.
   */
  const refresh = () => {
    fetchWorkspacesApi().then(setWorkspaces, () => undefined);
  };

  const saved = (workspace: WorkspaceSummary) => {
    setWorkspaces((list) => list && list.map((w) => (w.id === workspace.id ? workspace : w)));
    setDialog(null);
    refresh();
  };

  const deleted = (workspaceId: string) => {
    setWorkspaces((list) => list && list.filter((w) => w.id !== workspaceId));
    setDialog(null);
    refresh();
    // Replaced rather than pushed: Back would only reopen a workspace that answers 404.
    if (openWorkspaceId === workspaceId) navigate('/projects', { replace: true });
  };

  /**
   * Once a dialog has closed, focus goes back to the actions button it was opened from or, when a
   * delete took that row away, to what is left: the list, or the create form if the list is gone.
   */
  const returnFocus = (event: Event) => {
    event.preventDefault();
    const trigger = dialog?.trigger;
    (trigger?.isConnected ? trigger : (listRef.current ?? nameRef.current))?.focus();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Your workspaces. Open one to see its spaces, lists and boards."
        icon={FolderKanban}
      />

      {error ? (
        <FormMessage>{error}</FormMessage>
      ) : !workspaces ? (
        <Skeleton aria-busy="true" className="h-40 rounded-xl" />
      ) : workspaces.length === 0 ? (
        <Card className="py-0">
          <EmptyState
            icon={FolderKanban}
            title="No workspaces yet"
            description="You only see workspaces you are a member of. Ask a workspace owner to add you, or create one — you will be its owner."
            action={<CreateWorkspaceForm nameRef={nameRef} />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <ul
            ref={listRef}
            // Focusable, not tabbable: where focus lands when a delete removes the row it was in.
            tabIndex={-1}
            className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-8"
            aria-label="Workspaces"
          >
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className={cn(
                  'flex items-center rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md',
                  canManageWorkspace(workspace.role) && 'pr-2',
                )}
              >
                <Link
                  to={`/projects/${workspace.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{workspace.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{workspace.slug}</span>
                  </span>
                  <StatusBadge tone="neutral">{humanize(workspace.role)}</StatusBadge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
                {canManageWorkspace(workspace.role) && <WorkspaceActions workspace={workspace} onOpen={setDialog} />}
              </li>
            ))}
          </ul>
          <Card className="gap-4 lg:col-span-4">
            <CardHeader>
              <CardTitle>
                <h2>New workspace</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CreateWorkspaceForm nameRef={nameRef} />
            </CardContent>
          </Card>
        </div>
      )}

      {dialog?.kind === 'edit' && (
        <EditWorkspaceDialog
          workspace={dialog.workspace}
          onClose={() => setDialog(null)}
          onSaved={saved}
          onCloseAutoFocus={returnFocus}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteWorkspaceDialog
          workspace={dialog.workspace}
          onClose={() => setDialog(null)}
          onDeleted={deleted}
          onCloseAutoFocus={returnFocus}
        />
      )}
    </PageContainer>
  );
};

export default Projects;
