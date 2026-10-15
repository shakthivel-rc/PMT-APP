import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Calendar,
  CheckSquare,
  Hash,
  Loader2,
  Plus,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setQuickCreateOpen } from '@/features/ui/uiSlice';
import { createIssueApi } from '@/api/issues';
import { fetchMembersApi, fetchWorkspaceTreeApi, fetchWorkspacesApi } from '@/api/workspaces';
import type { IssuePriority, IssueType, MemberSummary, WorkspaceSummary, WorkspaceTree } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '../presentation';

export const QuickCreateModal = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.quickCreateOpen);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  // Form State
  const [listId, setListId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('task');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const [isSubmitting, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load workspaces when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetchWorkspacesApi()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setWorkspaces(data);
          if (!selectedWorkspaceId || !data.some((w) => w.id === selectedWorkspaceId)) {
            setSelectedWorkspaceId(data[0].id);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(errorMessage(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedWorkspaceId]);

  // Load tree and members when workspace changes
  useEffect(() => {
    if (!open || !selectedWorkspaceId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingContext(true);
    });

    Promise.all([
      fetchWorkspaceTreeApi(selectedWorkspaceId),
      fetchMembersApi(selectedWorkspaceId).catch(() => []),
    ])
      .then(([treeData, membersData]) => {
        if (cancelled) return;
        setTree(treeData);
        setMembers(membersData);
        setLoadingContext(false);

        // Auto-select first active list
        for (const space of treeData.spaces) {
          if (space.archived || space.frozen) continue;
          if (space.lists.length > 0) {
            setListId(space.lists[0].id);
            break;
          }
          if (space.folders.length > 0 && space.folders[0].lists.length > 0) {
            setListId(space.folders[0].lists[0].id);
            break;
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadingContext(false);
          toast.error(errorMessage(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedWorkspaceId]);

  // Focus title input on modal open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Flatten active lists
  const availableLists = useMemo(() => {
    if (!tree) return [];
    const result: Array<{ id: string; label: string; spaceName: string }> = [];
    for (const space of tree.spaces) {
      if (space.archived || space.frozen) continue;
      for (const list of space.lists) {
        if (!list.archived) {
          result.push({ id: list.id, label: list.name, spaceName: space.name });
        }
      }
      for (const folder of space.folders) {
        if (folder.archived) continue;
        for (const list of folder.lists) {
          if (!list.archived) {
            result.push({ id: list.id, label: `${folder.name} / ${list.name}`, spaceName: space.name });
          }
        }
      }
    }
    return result;
  }, [tree]);

  const handleClose = () => {
    dispatch(setQuickCreateOpen(false));
    setTitle('');
    setDescription('');
    setFormError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedWorkspaceId) {
      setFormError('Please select a workspace');
      return;
    }
    if (!listId) {
      setFormError('Please select a destination list');
      return;
    }
    if (!title.trim()) {
      setFormError('Issue title is required');
      titleInputRef.current?.focus();
      return;
    }

    setFormError(null);
    startTransition(async () => {
      try {
        const payload = {
          list_id: listId,
          title: title.trim(),
          description: description.trim() || null,
          type: issueType,
          priority,
          assignee_id: assigneeId || null,
          story_points: storyPoints ? Number(storyPoints) : null,
          due_date: dueDate || null,
        };

        const res = await createIssueApi(selectedWorkspaceId, payload);
        toast.success(`Created ${res.value.key}: ${res.value.title}`);
        if (res.notice) {
          toast.info(res.notice);
        }
        handleClose();
      } catch (err) {
        setFormError(errorMessage(err));
      }
    });
  };

  // Allow Cmd+Enter or Ctrl+Enter inside the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden" onKeyDown={handleKeyDown}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Plus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">New Issue</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Capture tasks and bugs instantly across your workspaces.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <DialogBody className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {formError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {formError}
              </div>
            )}

            {/* Destination Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qc-workspace" className="text-xs font-medium text-muted-foreground">
                  Workspace
                </Label>
                <select
                  id="qc-workspace"
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  disabled={workspaces.length <= 1}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qc-list" className="text-xs font-medium text-muted-foreground">
                  Space & List
                </Label>
                <select
                  id="qc-list"
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  disabled={loadingContext || availableLists.length === 0}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {availableLists.length === 0 ? (
                    <option value="">{loadingContext ? 'Loading spaces...' : 'No active lists found'}</option>
                  ) : (
                    availableLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.spaceName} &rsaquo; {l.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="qc-title" className="text-xs font-medium text-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qc-title"
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="text-sm font-medium"
                required
              />
            </div>

            {/* Type & Priority & Assignee Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qc-type" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CheckSquare className="size-3.5" />
                  Type
                </Label>
                <select
                  id="qc-type"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as IssueType)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="story">Story</option>
                  <option value="epic">Epic</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qc-priority" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="size-3.5" />
                  Priority
                </Label>
                <select
                  id="qc-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qc-assignee" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <UserIcon className="size-3.5" />
                  Assignee
                </Label>
                <select
                  id="qc-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.first_name} {m.last_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="qc-description" className="text-xs font-medium text-muted-foreground">
                Description (Markdown)
              </Label>
              <Textarea
                id="qc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details, acceptance criteria, or context..."
                rows={4}
                className="resize-y text-sm font-normal"
              />
            </div>

            {/* Optional Estimates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="qc-points" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Hash className="size-3.5" />
                  Story Points
                </Label>
                <Input
                  id="qc-points"
                  type="number"
                  min="0"
                  step="1"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  placeholder="e.g. 3, 5, 8"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qc-due" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Due Date
                </Label>
                <Input
                  id="qc-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-3 border-t border-border flex items-center justify-between sm:justify-between bg-muted/20">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ⌘↵
              </kbd>
              <span>to submit</span>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()} className="gap-1.5">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Create Issue</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCreateModal;
