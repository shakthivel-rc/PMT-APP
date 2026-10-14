import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  AppWindow,
  Bot,
  Check,
  Copy,
  Loader2,
  Maximize2,
  Milestone,
  Minimize2,
  PanelRight,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsApi } from '@/api/aiAgents';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setTicketViewMode } from '@/features/ui/uiSlice';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ApiError } from '@/api/client';
import { deleteIssueAttachment, uploadIssueAttachment } from '@/api/storage';
import {
  createCommentApi,
  deleteCommentApi,
  fetchCommentsApi,
  fetchIssueApi,
  isTerminalJob,
  moveIssueApi,
  requestThreadSummaryApi,
  updateCommentApi,
  updateIssueApi,
  waitForAIJobApi,
} from '@/api/issues';
import { fetchFixVersionsApi, fetchReleasesApi, setFixVersionsApi } from '@/api/releases';
import { fetchMembersApi } from '@/api/workspaces';
import { deploymentsApi } from '@/api/deployments';
import type {
  AIJobSummary,
  CommentSummary,
  IssueAttachment,
  IssueCard,
  IssueDeploymentSummary,
  IssueDetail,
  IssuePriority,
  IssueType,
  MemberSummary,
  SpaceNode,
  StatusSummary,
  ThreadSummary,
  TriageResult,
} from '@/types';
import type { FixVersion, ReleaseSummary } from '@/types/releases';
import FormMessage from '@/components/FormMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatServerDateTime } from '@/lib/datetime';
import { MarkdownEditor, SafeMarkdownView } from '@/components/MarkdownEditor';
import { DeploymentBadge, errorMessage, humanize, isNotFound, IssueTypeBadge, PriorityBadge, PullRequestBadge, StageBadge } from '../presentation';
import TimeTrackingPanel from './TimeTrackingPanel';
import { IssueAttachments, formatBytes } from './IssueAttachments';
import { CommentAttachmentList } from './CommentAttachmentList';

/*
 * Every piece of user-written text in this file — the description, comment bodies, PR titles
 * and the AI summary built from all of them — is rendered as a React text node or through
 * SafeMarkdownView, which escapes raw markup. None of it goes near `dangerouslySetInnerHTML`.
 * `whitespace-pre-wrap` preserves line breaks and indentation.
 */

/**
 * Only http(s) becomes a link. The URL arrives from a webhook delivery, and a `javascript:`
 * one rendered as an `href` would run in this origin, token and all, on a single click.
 */
const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

const Section = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
  <section>
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      {actions}
    </div>
    {children}
  </section>
);

type SummaryState =
  | { phase: 'idle' | 'running' }
  | { phase: 'done'; job: AIJobSummary & { result: ThreadSummary } }
  | { phase: 'failed'; message: string; unavailable: boolean };

const SummaryList = ({ title, items }: { title: string; items: ReactNode[] }) => (
  <div>
    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
    {items.length > 0 ? (
      <ul className="mt-1 list-disc space-y-1 pl-5 break-words whitespace-pre-wrap">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="mt-1 text-muted-foreground">None.</p>
    )}
  </div>
);

/**
 * Ask for a summary, then poll its job until it is terminal. Leaving the drawer (or asking
 * again) aborts the wait, so no request outlives the panel that would show its answer.
 */
const ThreadSummaryPanel = ({ workspaceId, issueId }: { workspaceId: string; issueId: string }) => {
  const [state, setState] = useState<SummaryState>({ phase: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const summarize = async () => {
    inFlight.current?.abort();
    const mine = new AbortController();
    inFlight.current = mine;
    setState({ phase: 'running' });
    try {
      let job = await requestThreadSummaryApi(workspaceId, issueId);
      // A reused summary comes back already `succeeded`, with nothing to wait for.
      if (!isTerminalJob(job)) job = await waitForAIJobApi(workspaceId, job.id, { signal: mine.signal });
      if (mine.signal.aborted) return;
      const { result } = job;
      setState(
        job.status === 'succeeded' && result
          ? { phase: 'done', job: { ...job, result } }
          : { phase: 'failed', message: job.error ?? 'The summary could not be written. Try again.', unavailable: false },
      );
    } catch (err) {
      if (mine.signal.aborted) return;
      // 503 is "AI is switched off here" — a fact about the deployment, not a fault, and its
      // message is written for people. Shown as information rather than as an error.
      setState({ phase: 'failed', message: errorMessage(err), unavailable: err instanceof ApiError && err.status === 503 });
    }
  };

  const running = state.phase === 'running';
  const summary = state.phase === 'done' ? state.job.result : null;

  return (
    <section className="rounded-lg border p-3" aria-busy={running || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Thread summary</h3>
        <Button
          size="sm"
          variant="outline"
          className="border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/60 font-medium shadow-2xs transition-colors"
          onClick={() => void summarize()}
          disabled={running}
        >
          {running ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin text-purple-500" aria-hidden="true" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5 text-purple-500" aria-hidden="true" />
          )}
          {running ? 'Summarizing…' : summary ? 'Summarize again' : 'Summarize thread'}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {running ? 'Summarizing the thread.' : summary ? 'Summary ready.' : ''}
      </p>

      {state.phase === 'failed' && (
        <FormMessage variant={state.unavailable ? 'info' : 'error'} className="mt-3">
          {state.message}
        </FormMessage>
      )}

      {summary && state.phase === 'done' && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">TL;DR</h4>
            <p className="mt-1 break-words whitespace-pre-wrap">{summary.tldr}</p>
          </div>
          <SummaryList title="Decisions" items={summary.decisions} />
          <SummaryList title="Open questions" items={summary.open_questions} />
          <SummaryList
            title="Action items"
            items={summary.action_items.map(({ owner, text }) =>
              owner ? (
                <>
                  <span className="font-medium">{owner}:</span> {text}
                </>
              ) : (
                text
              ),
            )}
          />
          <p className="text-xs text-muted-foreground">
            {state.job.cached && 'Reused: the thread has not changed since this summary was written. '}
            AI-generated{state.job.model ? ` by ${state.job.model}` : ''} — check it against the thread.
          </p>
        </div>
      )}
    </section>
  );
};

const AITriagePanel = ({
  workspaceId,
  issueId,
  onTriaged,
}: {
  workspaceId: string;
  issueId: string;
  onTriaged?: () => void;
}) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);

  const triage = async () => {
    setRunning(true);
    try {
      const res = await aiAgentsApi.triageIssue(workspaceId, issueId);
      setResult(res.data);
      if (res.data.potential_duplicate) {
        toast.warning(
          `Potential duplicate detected: ${res.data.duplicate_issue_key}`,
        );
      } else {
        toast.success('Auto-triage completed: No duplicates found');
      }
      onTriaged?.();
    } catch (err) {
      toast.error('Failed to run autonomous triage');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-lg border p-3" aria-busy={running || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Bot className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Autonomous Triage & Deduplication</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-medium shadow-2xs transition-colors"
          onClick={() => void triage()}
          disabled={running}
        >
          {running ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
          )}
          {running ? 'Triaging ticket…' : result ? 'Re-triage ticket' : 'Auto-triage ticket'}
        </Button>
      </div>

      {result && (
        <div className="mt-3 space-y-3 text-xs">
          {result.potential_duplicate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>
                  Potential duplicate detected ({Math.round((result.similarity_score ?? 0) * 100)}% match)
                </span>
              </div>
              <p className="text-2xs">
                Related to <strong className="font-mono">{result.duplicate_issue_key}</strong>: {result.duplicate_issue_title}
              </p>
              <div className="text-3xs text-amber-700 dark:text-amber-400">
                Automatically linked as related issue with triage memo posted.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded border">
            <div>
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Suggested Priority</span>
              <p className="font-semibold text-foreground uppercase">{result.suggested_priority || 'Standard'}</p>
            </div>
            <div>
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Suggested Owner</span>
              <p className="font-semibold text-foreground">{result.suggested_assignee_name || 'Unassigned'}</p>
            </div>
          </div>

          {result.structured_reproduction_steps && (
            <div>
              <span className="text-3xs text-muted-foreground uppercase font-semibold">
                Extracted Reproduction Specification
              </span>
              <pre className="mt-1 p-2 rounded bg-muted/40 font-mono text-2xs whitespace-pre-wrap leading-relaxed overflow-x-auto border">
                {result.structured_reproduction_steps}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const CommentItem = ({
  comment,
  canEdit,
  workspaceId,
  issueId,
  onUpdate,
  onDelete,
  onDeleteAttachment,
}: {
  comment: CommentSummary;
  canEdit: boolean;
  workspaceId: string;
  issueId: string;
  onUpdate: (commentId: string, newBody: string, attachmentIds?: string[]) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onDeleteAttachment?: (commentId: string, attachmentId: string) => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [isPending, startTransition] = useTransition();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editAttachments, setEditAttachments] = useState<IssueAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const handleEditUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const created = await uploadIssueAttachment(workspaceId, issueId, file, comment.id);
        setEditAttachments((prev) => [...prev, created]);
        toast.success(`Attached ${file.name}`);
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    } finally {
      setIsUploading(false);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    }
  };

  const handleSave = () => {
    const text = draft.trim();
    if (!text && editAttachments.length === 0 && (!comment.attachments || comment.attachments.length === 0)) {
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        const newIds = editAttachments.map((a) => a.id);
        await onUpdate(comment.id, text, newIds.length > 0 ? newIds : undefined);
        setIsEditing(false);
        setEditAttachments([]);
        toast.success('Comment updated');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await onDelete(comment.id);
        toast.success('Comment deleted');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  return (
    <li className="rounded-lg bg-muted/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{comment.author.display_name}</span>
          {' · '}
          <time dateTime={comment.created_at}>{formatServerDateTime(comment.created_at)}</time>
          {comment.updated_at && comment.updated_at !== comment.created_at && (
            <span className="italic text-[11px] ml-1">(edited)</span>
          )}
        </p>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Edit comment"
              aria-label="Edit comment"
              onClick={() => {
                setDraft(comment.body);
                setEditAttachments([]);
                setIsEditing(true);
              }}
            >
              <Pencil className="size-3" />
            </Button>
            {!isConfirmingDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                title="Delete comment"
                aria-label="Delete comment"
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2 className="size-3" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  className="h-6 px-1.5 text-[11px]"
                  disabled={isPending}
                  onClick={handleDelete}
                  aria-label="Confirm delete comment"
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 px-1 text-[11px]"
                  onClick={() => setIsConfirmingDelete(false)}
                  aria-label="Cancel delete comment"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <MarkdownEditor
            id={`edit-comment-${comment.id}`}
            value={draft}
            onChange={setDraft}
            placeholder="Edit your comment…"
            rows={3}
            disabled={isPending}
            ariaLabel="Edit comment body"
            actions={
              <div className="flex items-center gap-2">
                <input
                  ref={editFileInputRef}
                  type="file"
                  multiple
                  disabled={isPending || isUploading}
                  onChange={(e) => void handleEditUpload(e.target.files)}
                  className="hidden"
                  id={`comment-edit-file-${comment.id}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isPending || isUploading}
                  onClick={() => editFileInputRef.current?.click()}
                  className="text-xs"
                >
                  {isUploading ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Paperclip className="mr-1 size-3" />
                  )}
                  Attach
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(comment.body);
                    setEditAttachments([]);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || (!draft.trim() && editAttachments.length === 0)}
                  onClick={handleSave}
                >
                  {isPending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                  Save
                </Button>
              </div>
            }
          />
          {editAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {editAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                >
                  <Paperclip className="size-3 text-muted-foreground" />
                  <span className="truncate max-w-[100px]">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => setEditAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <SafeMarkdownView content={comment.body} />
          {comment.attachments && comment.attachments.length > 0 && (
            <CommentAttachmentList
              attachments={comment.attachments}
              canDelete={canEdit}
              onDelete={
                onDeleteAttachment
                  ? (attId) => onDeleteAttachment(comment.id, attId)
                  : undefined
              }
            />
          )}
        </>
      )}
    </li>
  );
};

const CommentForm = ({
  workspaceId,
  issueId,
  onPost,
}: {
  workspaceId: string;
  issueId: string;
  onPost: (body: string, attachmentIds?: string[]) => Promise<void>;
}) => {
  const [body, setBody] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<IssueAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const created = await uploadIssueAttachment(workspaceId, issueId, file);
        setPendingAttachments((prev) => [...prev, created]);
        toast.success(`Attached ${file.name}`);
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePending = (attId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleInsertMarkdown = (att: IssueAttachment) => {
    const snippet = att.is_image
      ? `\n![${att.filename}](${att.download_url})\n`
      : `\n[${att.filename}](${att.download_url})\n`;
    setBody((prev) => prev + snippet);
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = body.trim();
    if (!text && pendingAttachments.length === 0) return;
    startTransition(async () => {
      try {
        const attachmentIds = pendingAttachments.map((a) => a.id);
        await onPost(text, attachmentIds.length > 0 ? attachmentIds : undefined);
        setBody('');
        setPendingAttachments([]);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="new-comment">Add a comment</Label>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            disabled={isPending || isUploading}
            onChange={(e) => void handleFileUpload(e.target.files)}
            className="hidden"
            id="comment-file-upload"
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isPending || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Attach file to comment"
          >
            {isUploading ? (
              <Loader2 className="mr-1 size-3 animate-spin text-primary" />
            ) : (
              <Paperclip className="mr-1 size-3 text-primary" />
            )}
            Attach file
          </Button>
        </div>
      </div>

      <MarkdownEditor
        id="new-comment"
        value={body}
        onChange={setBody}
        disabled={isPending}
        placeholder="Add a comment with markdown formatting (Ctrl+B bold, lists, code, links)…"
        rows={3}
        ariaLabel="Add a comment"
        actions={
          <Button
            type="submit"
            size="sm"
            disabled={isPending || isUploading || (!body.trim() && pendingAttachments.length === 0)}
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Comment
          </Button>
        }
      />

      {/* Pending Attachments List */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
            >
              <Paperclip className="size-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate font-medium text-foreground" title={att.filename}>
                {att.filename}
              </span>
              <span className="text-[10px] text-muted-foreground">({formatBytes(att.file_size)})</span>
              <button
                type="button"
                onClick={() => handleInsertMarkdown(att)}
                className="text-[10px] text-primary hover:underline ml-0.5"
                title="Insert markdown link"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => handleRemovePending(att.id)}
                className="text-muted-foreground hover:text-destructive ml-1"
                title="Remove attachment"
                aria-label={`Remove ${att.filename}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
};

interface IssuePanelProps {
  workspaceId: string;
  issueId: string;
  statuses: StatusSummary[];
  /**
   * The issue's space, when the opener knows it: its workflow rules (restricted transitions,
   * the initial stage) and its write state (archived, frozen). Optional so an opener without
   * the tree — a report, the timesheet — can still open an issue.
   */
  space?: SpaceNode;
  canWrite: boolean;
  onOpenIssue: (issueId: string) => void;
  /**
   * Fields of the open issue that changed in the drawer — time logged, the estimate, and the
   * `version` an estimate edit moves — so the board's copy of the card can follow.
   */
  onCardChanged?: (issueId: string, patch: Partial<IssueCard>) => void;
  onClose: () => void;
  isModal?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleMode?: () => void;
}

/** Keyed on the issue by its parent, so opening another one starts from a clean load. */
const IssuePanel = ({
  workspaceId,
  issueId,
  statuses,
  canWrite,
  onOpenIssue,
  onCardChanged,
  onClose,
  isModal = false,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMode,
}: IssuePanelProps) => {
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<CommentSummary[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [fixVersions, setFixVersions] = useState<FixVersion[]>([]);
  const [spaceReleases, setSpaceReleases] = useState<ReleaseSummary[]>([]);
  const [deployments, setDeployments] = useState<IssueDeploymentSummary[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isEditingPoints, setIsEditingPoints] = useState(false);
  const [pointsDraft, setPointsDraft] = useState('');
  const [isBlockingOpen, setIsBlockingOpen] = useState(false);
  const [blockedReasonDraft, setBlockedReasonDraft] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchIssueApi(workspaceId, issueId),
      fetchCommentsApi(workspaceId, issueId),
      fetchFixVersionsApi(workspaceId, issueId).catch(() => [] as FixVersion[]),
      fetchMembersApi(workspaceId).catch(() => [] as MemberSummary[]),
      deploymentsApi.getIssueDeployments(workspaceId, issueId).then((r) => r.data).catch(() => [] as IssueDeploymentSummary[]),
    ])
      .then(([detail, thread, versions, workspaceMembers, issueDeployments]) => {
        if (cancelled) return;
        setIssue(detail);
        setComments(thread);
        setFixVersions(versions);
        setMembers(workspaceMembers);
        setDeployments(issueDeployments);
        if (detail.space_id) {
          fetchReleasesApi(workspaceId, detail.space_id)
            .then((rels) => {
              if (!cancelled) setSpaceReleases(rels);
            })
            .catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure(isNotFound(err) ? 'This issue does not exist, or you cannot see it.' : errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, issueId, reloadTick]);

  if (!issue) {
    // The sheet is a dialog and must be named even before there is anything to name it by.
    return (
      <>
        <SheetHeader>
          <SheetTitle>{failure ? 'Issue unavailable' : 'Loading issue…'}</SheetTitle>
          <SheetDescription className="sr-only">Issue details</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {failure ? <FormMessage>{failure}</FormMessage> : <Skeleton aria-busy="true" className="h-48 rounded-lg" />}
        </SheetBody>
      </>
    );
  }

  const status = statuses.find((s) => s.id === issue.status_id);

  const changeIssue = (patch: Partial<IssueCard>) => {
    setIssue((current) => current && { ...current, ...patch });
    onCardChanged?.(issueId, patch);
  };

  const postComment = async (body: string, attachmentIds?: string[]) => {
    const comment = await createCommentApi(workspaceId, issueId, {
      body,
      attachment_ids: attachmentIds,
    });
    setComments((current) => [...current, comment]);
  };

  const updateComment = async (commentId: string, body: string, attachmentIds?: string[]) => {
    const updated = await updateCommentApi(workspaceId, issueId, commentId, {
      body,
      attachment_ids: attachmentIds,
    });
    setComments((current) => current.map((c) => (c.id === commentId ? updated : c)));
  };

  const deleteComment = async (commentId: string) => {
    await deleteCommentApi(workspaceId, issueId, commentId);
    setComments((current) => current.filter((c) => c.id !== commentId));
  };

  const deleteCommentAttachment = async (commentId: string, attachmentId: string) => {
    await deleteIssueAttachment(workspaceId, issueId, attachmentId);
    setComments((current) =>
      current.map((c) =>
        c.id === commentId
          ? {
              ...c,
              attachments: (c.attachments || []).filter((a) => a.id !== attachmentId),
            }
          : c
      )
    );
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (!issue || newStatusId === issue.status_id) return;
    setIsUpdating(true);
    try {
      const result = await moveIssueApi(workspaceId, issueId, {
        status_id: newStatusId,
        after_id: null,
        before_id: null,
      });
      const patch = { ...result.value, status_id: newStatusId };
      setIssue((cur) => cur && { ...cur, ...patch });
      onCardChanged?.(issueId, patch);
      const target = statuses.find((s) => s.id === newStatusId);
      toast.success(`Moved to ${target?.name ?? 'new stage'}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!issue || newPriority === issue.priority) return;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        priority: newPriority as IssuePriority,
      });
      setIssue(updated);
      onCardChanged?.(issueId, { priority: updated.priority, version: updated.version });
      toast.success('Priority updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssigneeChange = async (newVal: string) => {
    if (!issue) return;
    const assigneeId = newVal === 'unassigned' ? null : newVal;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        assignee_id: assigneeId,
      });
      setIssue(updated);
      onCardChanged?.(issueId, { assignee: updated.assignee, version: updated.version });
      toast.success('Assignee updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTypeChange = async (newType: string) => {
    if (!issue || newType === issue.type) return;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        type: newType as IssueType,
      });
      setIssue(updated);
      onCardChanged?.(issueId, { type: updated.type, version: updated.version });
      toast.success('Issue type updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDueDateChange = async (val: string) => {
    if (!issue) return;
    const dateVal = val ? val : null;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        due_date: dateVal,
      });
      setIssue(updated);
      onCardChanged?.(issueId, { due_date: updated.due_date, version: updated.version });
      toast.success('Due date updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveStoryPoints = async () => {
    if (!issue) return;
    const points = pointsDraft.trim() === '' ? null : Number(pointsDraft);
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        story_points: points,
      });
      setIssue(updated);
      setIsEditingPoints(false);
      onCardChanged?.(issueId, { story_points: updated.story_points, version: updated.version });
      toast.success('Story points updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveTitle = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!issue) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === issue.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        title: trimmed,
      });
      setIssue(updated);
      setIsEditingTitle(false);
      onCardChanged?.(issueId, { title: updated.title, version: updated.version });
      toast.success('Title updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!issue) return;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        description: descriptionDraft,
      });
      setIssue(updated);
      setIsEditingDescription(false);
      toast.success('Description updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnblock = async () => {
    if (!issue) return;
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        blocked: false,
        blocked_reason: null,
      });
      setIssue(updated);
      onCardChanged?.(issueId, { blocked: false, blocked_reason: null, version: updated.version });
      toast.success('Issue unblocked');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!issue) return;
    const reason = blockedReasonDraft.trim();
    if (!reason) {
      toast.error('Blocker reason is required');
      return;
    }
    setIsUpdating(true);
    try {
      const updated = await updateIssueApi(workspaceId, issueId, {
        version: issue.version,
        blocked: true,
        blocked_reason: reason,
      });
      setIssue(updated);
      setIsBlockingOpen(false);
      setBlockedReasonDraft('');
      onCardChanged?.(issueId, { blocked: true, blocked_reason: updated.blocked_reason, version: updated.version });
      toast.success('Issue marked as blocked');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddFixVersion = async (releaseId: string) => {
    if (!issue) return;
    const currentIds = fixVersions.map((fv) => fv.id);
    if (currentIds.includes(releaseId)) return;
    setIsUpdating(true);
    try {
      const updatedList = await setFixVersionsApi(workspaceId, issueId, [...currentIds, releaseId]);
      setFixVersions(updatedList);
      toast.success('Fix version linked');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveFixVersion = async (releaseId: string) => {
    if (!issue) return;
    setIsUpdating(true);
    try {
      const nextIds = fixVersions.map((fv) => fv.id).filter((id) => id !== releaseId);
      const updatedList = await setFixVersionsApi(workspaceId, issueId, nextIds);
      setFixVersions(updatedList);
      toast.success('Fix version removed');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const unassignedReleases = spaceReleases.filter((r) => !fixVersions.some((fv) => fv.id === r.id));

  const completedChildren = issue.children.filter((child) => {
    const childStatus = statuses.find((s) => s.id === child.status_id);
    return childStatus?.category === 'done' || childStatus?.name.toLowerCase() === 'done';
  }).length;

  const fields: [string, ReactNode][] = [
    [
      'Status',
      canWrite ? (
        <Select value={issue.status_id} onValueChange={handleStatusChange} disabled={isUpdating}>
          <SelectTrigger className="h-7 w-fit gap-1.5 px-2 text-xs font-medium" aria-label="Status">
            <SelectValue>{status ? <StageBadge stage={status} /> : 'Unknown'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <StageBadge stage={s} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        status ? <StageBadge stage={status} /> : <span>Unknown</span>
      ),
    ],
    [
      'Type',
      canWrite ? (
        <Select value={issue.type} onValueChange={handleTypeChange} disabled={isUpdating}>
          <SelectTrigger className="h-7 w-fit gap-1.5 px-2 text-xs font-medium" aria-label="Type">
            <SelectValue>{<IssueTypeBadge type={issue.type} />}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="story"><IssueTypeBadge type="story" /></SelectItem>
            <SelectItem value="task"><IssueTypeBadge type="task" /></SelectItem>
            <SelectItem value="bug"><IssueTypeBadge type="bug" /></SelectItem>
            <SelectItem value="epic"><IssueTypeBadge type="epic" /></SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <IssueTypeBadge type={issue.type} />
      ),
    ],
    [
      'Assignee',
      canWrite ? (
        <Select value={issue.assignee?.id ?? 'unassigned'} onValueChange={handleAssigneeChange} disabled={isUpdating}>
          <SelectTrigger className="h-7 w-fit gap-1.5 px-2 text-xs font-medium" aria-label="Assignee">
            <SelectValue>{issue.assignee?.display_name ?? 'Unassigned'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => {
              const name = `${m.first_name} ${m.last_name}`.trim() || m.email;
              return (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : (
        <span>{issue.assignee?.display_name ?? 'Unassigned'}</span>
      ),
    ],
    [
      'Priority',
      canWrite ? (
        <Select value={issue.priority} onValueChange={handlePriorityChange} disabled={isUpdating}>
          <SelectTrigger className="h-7 w-fit gap-1.5 px-2 text-xs font-medium" aria-label="Priority">
            <SelectValue>
              {issue.priority === 'none' ? 'None' : <PriorityBadge priority={issue.priority} />}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        issue.priority === 'none' ? 'None' : <PriorityBadge priority={issue.priority} />
      ),
    ],
    [
      'Story points',
      isEditingPoints ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={pointsDraft}
            onChange={(e) => setPointsDraft(e.target.value)}
            className="h-7 w-20 text-xs"
            autoFocus
          />
          <Button size="icon-xs" variant="default" onClick={() => void handleSaveStoryPoints()} aria-label="Save story points">
            <Check className="size-3" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => setIsEditingPoints(false)} aria-label="Cancel story points">
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span>{issue.story_points ?? '—'}</span>
          {canWrite && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setPointsDraft(issue.story_points !== null ? String(issue.story_points) : '');
                setIsEditingPoints(true);
              }}
              title="Edit story points"
              aria-label="Edit story points"
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
      ),
    ],
    ['Reporter', issue.reporter.display_name],
    [
      'Due date',
      canWrite ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={issue.due_date ?? ''}
            onChange={(e) => void handleDueDateChange(e.target.value)}
            disabled={isUpdating}
            className="h-7 w-36 px-2 text-xs"
            aria-label="Due date"
          />
          {issue.due_date && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleDueDateChange('')}
              title="Clear due date"
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      ) : (
        <span>{issue.due_date ?? '—'}</span>
      ),
    ],
  ];

  return (
    <>
      <SheetHeader className="px-6 pt-5 pr-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">{issue.key}</span>
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground" title="Issue Revision Version">
              v{issue.version}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleMode && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onToggleMode}
                title={isModal ? 'Switch to side drawer mode' : 'Open in full modal pop-up mode'}
                aria-label={isModal ? 'Switch to side drawer mode' : 'Open in full modal pop-up mode'}
                className="h-7 px-2 gap-1.5 text-xs font-medium border border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 shadow-2xs transition-colors"
              >
                {isModal ? (
                  <>
                    <PanelRight className="size-3.5 text-indigo-500" aria-hidden="true" />
                    <span className="hidden sm:inline">Drawer</span>
                  </>
                ) : (
                  <>
                    <AppWindow className="size-3.5 text-indigo-500" aria-hidden="true" />
                    <span className="hidden sm:inline">Modal Pop-up</span>
                  </>
                )}
              </Button>
            )}
            {isModal && onToggleFullscreen && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Exit full screen' : 'Expand full screen'}
                aria-label={isFullscreen ? 'Exit full screen' : 'Expand full screen'}
                className="size-7 border border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 shadow-2xs transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="size-3.5 text-sky-500" aria-hidden="true" />
                ) : (
                  <Maximize2 className="size-3.5 text-sky-500" aria-hidden="true" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                void navigator.clipboard.writeText(`${issue.key}: ${issue.title}`);
                toast.success(`Copied ${issue.key} to clipboard`);
              }}
              title="Copy key and title"
              aria-label="Copy key and title"
              className="size-7 border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-2xs transition-colors"
            >
              <Copy className="size-3.5 text-emerald-500" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="size-7 border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-2xs transition-colors"
            >
              <X className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {isEditingTitle ? (
          <form onSubmit={handleSaveTitle} className="mt-1 flex items-center gap-1.5">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="h-8 text-base font-semibold"
              autoFocus
            />
            <Button type="submit" size="icon-xs" variant="default" disabled={!titleDraft.trim()} aria-label="Save title">
              <Check className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Cancel title"
              onClick={() => {
                setIsEditingTitle(false);
                setTitleDraft(issue.title);
              }}
            >
              <X className="size-3.5" />
            </Button>
          </form>
        ) : (
          <div className="group flex items-center gap-2">
            <SheetTitle className="text-lg leading-tight">{issue.title}</SheetTitle>
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setTitleDraft(issue.title);
                  setIsEditingTitle(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit title"
                aria-label="Edit title"
              >
                <Pencil className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}

        <SheetDescription className="flex flex-wrap items-center gap-2 mt-1">
          <IssueTypeBadge type={issue.type} />
          {status && <StageBadge stage={status} />}
          <span className="text-xs text-muted-foreground">{humanize(issue.type)} · {status?.name ?? 'Unknown status'}</span>
        </SheetDescription>
      </SheetHeader>

      {(() => {
        const blockedSection = issue.blocked ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-destructive">This issue is blocked</span>
                {issue.blocked_at && (
                  <span className="text-xs text-muted-foreground">Since {formatServerDateTime(issue.blocked_at)}</span>
                )}
              </div>
              <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                {issue.blocked_reason ?? 'No blocker reason specified.'}
              </p>
              {issue.blocked_by && (
                <p className="text-xs text-muted-foreground">Blocked by {issue.blocked_by.display_name}</p>
              )}
              {canWrite && (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="border-destructive/30 text-destructive hover:bg-destructive/20"
                    onClick={() => void handleUnblock()}
                    disabled={isUpdating}
                  >
                    Unblock issue
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : canWrite ? (
          <div>
            {!isBlockingOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setIsBlockingOpen(true)}
              >
                <AlertTriangle className="mr-1 size-3" />
                Mark as blocked
              </Button>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-2">
                <Label htmlFor="block-reason-input" className="text-xs font-semibold text-destructive">
                  Blocker reason (required)
                </Label>
                <Input
                  id="block-reason-input"
                  value={blockedReasonDraft}
                  onChange={(e) => setBlockedReasonDraft(e.target.value)}
                  placeholder="Why is this issue blocked? Who owns the blocker?"
                  className="h-8 text-xs bg-background"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setIsBlockingOpen(false);
                      setBlockedReasonDraft('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={!blockedReasonDraft.trim() || isUpdating}
                    onClick={() => void handleConfirmBlock()}
                  >
                    Confirm block
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null;

        const propertiesSection = (
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
            {fields.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        );

        const releasesSection = (
          <Section title="Releases & Fix Versions">
            <div className="space-y-2.5">
              {fixVersions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {fixVersions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs"
                    >
                      <Milestone className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium text-foreground">{version.name}</span>
                      <Badge
                        variant={version.state === 'released' ? 'default' : version.state === 'unreleased' ? 'secondary' : 'outline'}
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {humanize(version.state)}
                      </Badge>
                      {version.release_date && (
                        <span className="text-[11px] text-muted-foreground">({version.release_date})</span>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveFixVersion(version.id)}
                          disabled={isUpdating}
                          className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={`Remove ${version.name}`}
                          aria-label={`Remove fix version ${version.name}`}
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No fix versions assigned.</p>
              )}

              {canWrite && unassignedReleases.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <Select onValueChange={(relId) => void handleAddFixVersion(relId)} disabled={isUpdating}>
                    <SelectTrigger size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 size-3" />
                      <SelectValue placeholder="Add to release version…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedReleases.map((release) => (
                        <SelectItem key={release.id} value={release.id}>
                          {release.name} ({humanize(release.state)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Section>
        );

        const descriptionSection = (
          <Section
            title="Description"
            actions={
              canWrite && !isEditingDescription ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setDescriptionDraft(issue.description ?? '');
                    setIsEditingDescription(true);
                  }}
                  className="h-6 gap-1 px-2 text-xs border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-medium transition-colors"
                  aria-label="Edit description"
                >
                  <Pencil className="size-3 text-amber-500" />
                  Edit
                </Button>
              ) : null
            }
          >
            {isEditingDescription ? (
              <div className="space-y-2">
                <MarkdownEditor
                  id="issue-description-editor"
                  value={descriptionDraft}
                  onChange={setDescriptionDraft}
                  placeholder="Add a detailed description (markdown supported)..."
                  rows={6}
                  disabled={isUpdating}
                  ariaLabel="Issue description"
                  actions={
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingDescription(false)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveDescription()}
                        disabled={isUpdating}
                      >
                        {isUpdating && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                        Save description
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : issue.description ? (
              <p className="text-sm break-words whitespace-pre-wrap">{issue.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description.</p>
            )}
          </Section>
        );

        const childrenSection = issue.children.length > 0 ? (
          <Section title="Child issues">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {completedChildren} of {issue.children.length} completed
              </span>
              <span className="font-medium">
                {Math.round((completedChildren / issue.children.length) * 100)}%
              </span>
            </div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(completedChildren / issue.children.length) * 100}%` }}
              />
            </div>
            <ul className="space-y-1">
              {issue.children.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => onOpenIssue(child.id)}
                    className="rounded-sm text-left text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{child.key}</span> {child.title}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null;

        const prSection = issue.links.length > 0 ? (
          <Section title="Linked pull requests">
            <ul className="space-y-2">
              {issue.links.map((link) => (
                <li key={link.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {isWebUrl(link.url) ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words text-primary hover:underline"
                      >
                        {link.title ?? link.external_id}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="break-words">{link.title ?? link.external_id}</span>
                    )}
                    <span className="block font-mono text-xs text-muted-foreground">{link.external_id}</span>
                  </span>
                  <PullRequestBadge state={link.state} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null;

        const deploymentsSection = deployments.length > 0 ? (
          <Section title={`Deployments (${deployments.length})`}>
            <ul className="space-y-2">
              {deployments.map((dep) => (
                <li
                  key={dep.deployment_id}
                  className="flex items-center justify-between gap-3 text-sm rounded-md border p-2.5 bg-muted/20"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs capitalize text-foreground">{dep.environment}</span>
                      <DeploymentBadge environment={dep.environment} status={dep.status} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>{dep.commit_sha.slice(0, 7)}</span>
                      {dep.ref_name && <span>· {dep.ref_name}</span>}
                      {dep.deployed_at && <span>· {formatServerDateTime(dep.deployed_at)}</span>}
                    </div>
                  </div>
                  {dep.deployment_url && isWebUrl(dep.deployment_url) && (
                    <Button asChild variant="outline" size="xs">
                      <a href={dep.deployment_url} target="_blank" rel="noopener noreferrer">
                        View
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null;

        const timeTrackingSection = (
          <TimeTrackingPanel workspaceId={workspaceId} issue={issue} canWrite={canWrite} onIssueChange={changeIssue} />
        );

        const aiTriageSection = (
          <AITriagePanel workspaceId={workspaceId} issueId={issueId} onTriaged={reload} />
        );

        const threadSummarySection = (
          <ThreadSummaryPanel workspaceId={workspaceId} issueId={issueId} />
        );

        const attachmentsSection = (
          <Section title="Attachments & Files">
            <IssueAttachments workspaceId={workspaceId} issueId={issueId} canWrite={canWrite} />
          </Section>
        );

        const commentsSection = (
          <Section title={`Comments (${comments.length})`}>
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            <ol className="space-y-3">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  canEdit={canWrite && (!currentUserId || currentUserId === comment.author.id)}
                  workspaceId={workspaceId}
                  issueId={issueId}
                  onUpdate={updateComment}
                  onDelete={deleteComment}
                  onDeleteAttachment={deleteCommentAttachment}
                />
              ))}
            </ol>
            {canWrite && (
              <CommentForm
                workspaceId={workspaceId}
                issueId={issueId}
                onPost={postComment}
              />
            )}
          </Section>
        );

        return (
          <SheetBody className="space-y-6 px-6 py-5 flex-1 min-h-0 overflow-y-auto">
            {isModal ? (
              <div className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0">
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                  {descriptionSection}
                  {attachmentsSection}
                  {aiTriageSection}
                  {threadSummarySection}
                  {commentsSection}
                </div>
                <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:border-l lg:border-border lg:pl-8">
                  {blockedSection}
                  {propertiesSection}
                  {releasesSection}
                  {childrenSection}
                  {prSection}
                  {deploymentsSection}
                  {timeTrackingSection}
                </div>
              </div>
            ) : (
              <>
                {blockedSection}
                {propertiesSection}
                {releasesSection}
                {descriptionSection}
                {childrenSection}
                {prSection}
                {deploymentsSection}
                {timeTrackingSection}
                {aiTriageSection}
                {threadSummarySection}
                {attachmentsSection}
                {commentsSection}
              </>
            )}
          </SheetBody>
        );
      })()}
    </>
  );
};

interface IssueDrawerProps extends Omit<IssuePanelProps, 'issueId' | 'isModal' | 'isFullscreen' | 'onToggleFullscreen' | 'onToggleMode'> {
  /** The issue to show, or null for closed. */
  issueId: string | null;
  onClose: () => void;
}

/** The detail drawer / full modal: one issue, its time, its thread, and its AI summary. */
const IssueDrawer = ({ issueId, onClose, ...panel }: IssueDrawerProps) => {
  // The last issue shown stays mounted while the sheet/dialog slides out, instead of the panel
  // emptying at the start of the exit animation.
  const [shown, setShown] = useState(issueId);
  if (issueId && issueId !== shown) setShown(issueId);

  const dispatch = useAppDispatch();
  const ticketViewMode = useAppSelector((state) => state.ui.ticketViewMode);
  const isModal = ticketViewMode === 'modal';
  const [isFullscreen, setIsFullscreen] = useState(false);
  if ((!issueId || !isModal) && isFullscreen) {
    setIsFullscreen(false);
  }

  if (isModal) {
    return (
      <Dialog open={issueId !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          data-testid="issue-modal-content"
          className={cn(
            'flex flex-col p-0 transition-all duration-200 overflow-hidden bg-background shadow-2xl',
            'fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50',
            isFullscreen
              ? 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] xl:max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] rounded-xl'
              : 'w-full max-w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[88vh] max-h-[88vh] rounded-xl'
          )}
        >
          {shown && (
            <IssuePanel
              key={shown}
              issueId={shown}
              isModal={true}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
              onToggleMode={() => dispatch(setTicketViewMode('drawer'))}
              onClose={onClose}
              {...panel}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={issueId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col overflow-hidden"
      >
        {shown && (
          <IssuePanel
            key={shown}
            issueId={shown}
            isModal={false}
            isFullscreen={false}
            onToggleFullscreen={() => {}}
            onToggleMode={() => dispatch(setTicketViewMode('modal'))}
            onClose={onClose}
            {...panel}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};

export default IssueDrawer;
