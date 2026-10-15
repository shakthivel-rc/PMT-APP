import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Edit2,
  FolderKanban,
  GitMerge,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Sliders,
  Star,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchWorkflowApi,
  fetchWorkflowTemplatesApi,
  previewWorkflowApi,
  publishWorkflowApi,
} from '@/api/workflow';
import type { SpaceNode, StageColor, TransitionMode, WipPolicy, WorkspaceRole } from '@/types';
import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowDraftStage,
  WorkflowPreview,
  WorkflowTemplateSummary,
} from '@/types/workflow';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { categoryLabel } from '@/lib/workflowRules';
import { errorMessage } from '../../projects/presentation';
import StageFormDialog from './StageFormDialog';
import StageRemovalDialog from './StageRemovalDialog';
import WorkflowPublishDialog from './WorkflowPublishDialog';

export interface WorkflowEditorProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
  /** Re-reads the workspace tree once a publish lands, so every board draws the new stages. */
  onPublished: () => Promise<unknown>;
}

export const WorkflowEditor = ({ workspaceId, space, role: _role, onPublished }: WorkflowEditorProps) => {
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Draft state
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [preview, setPreview] = useState<WorkflowPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dialog controls
  const [stageFormOpen, setStageFormOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowDraftStage | null>(null);
  const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
  const [stageToRemove, setStageToRemove] = useState<WorkflowDraftStage | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Sub-view tab
  const [activeSubTab, setActiveSubTab] = useState<'stages' | 'transitions' | 'policy'>('stages');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const initDraftFromDefinition = useCallback((def: WorkflowDefinition): WorkflowDraft => {
    return {
      base_version: def.version,
      transition_mode: (def.transition_mode as TransitionMode) || 'any',
      wip_policy: (def.wip_policy as WipPolicy) || 'warn',
      stages: def.stages.map((s) => ({
        ref: s.id,
        name: s.name,
        category: s.category,
        color: s.color,
        counts_toward_wip: s.counts_toward_wip,
        wip_limit: s.wip_limit,
      })),
      initial: def.initial_status_id,
      transitions: def.transitions.map((t) => ({
        from: t.from_status_id,
        to: t.to_status_id,
      })),
      replacements: {},
      merge_action: {
        mode: (def.merge_action.mode as 'status' | 'none') || 'status',
        target: def.merge_action.target_status_id,
      },
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchWorkflowApi(workspaceId, space.id),
      fetchWorkflowTemplatesApi(workspaceId).catch(() => []),
    ])
      .then(([wf, tmpls]) => {
        if (!cancelled) {
          setDefinition(wf);
          setTemplates(tmpls);
          setDraft(initDraftFromDefinition(wf));
          setIsDirty(false);
          setPreview(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(errorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, space.id, initDraftFromDefinition]);

  // Run preview validation when draft changes
  const runPreview = useCallback(
    async (currentDraft: WorkflowDraft): Promise<WorkflowPreview | null> => {
      try {
        setPreviewError(null);
        const prev = await previewWorkflowApi(workspaceId, space.id, currentDraft);
        setPreview(prev);
        return prev;
      } catch (err) {
        setPreviewError(errorMessage(err));
        return null;
      }
    },
    [workspaceId, space.id],
  );

  const updateDraft = useCallback((updater: (prev: WorkflowDraft) => WorkflowDraft) => {
    setDraft((prev) => {
      if (!prev) return null;
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }, []);

  // Stage Reordering
  const handleMoveStage = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= draft.stages.length) return;
    const nextStages = [...draft.stages];
    const [moved] = nextStages.splice(index, 1);
    nextStages.splice(newIndex, 0, moved);
    updateDraft((d) => ({ ...d, stages: nextStages }));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex: number) => {
    if (!draft || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    const nextStages = [...draft.stages];
    const [moved] = nextStages.splice(draggedIndex, 1);
    nextStages.splice(dropIndex, 0, moved);
    setDraggedIndex(null);
    updateDraft((d) => ({ ...d, stages: nextStages }));
  };

  // Add / Edit stage
  const handleSaveStage = (savedStage: WorkflowDraftStage) => {
    if (!draft) return;
    const existingIndex = draft.stages.findIndex((s) => s.ref === savedStage.ref);
    if (existingIndex >= 0) {
      // Update
      const nextStages = [...draft.stages];
      nextStages[existingIndex] = savedStage;
      updateDraft((d) => ({ ...d, stages: nextStages }));
    } else {
      // Create new
      const nextStages = [...draft.stages, savedStage];
      // If no initial stage or initial is unset, set this one if it's open
      const nextInitial = draft.initial ?? (savedStage.category !== 'done' && savedStage.category !== 'canceled' ? savedStage.ref : null);
      updateDraft((d) => ({ ...d, stages: nextStages, initial: nextInitial }));
    }
    setStageFormOpen(false);
    setEditingStage(null);
  };

  // Stage Removal
  const handleRequestRemoveStage = (stage: WorkflowDraftStage) => {
    if (!draft || !definition) return;
    if (draft.stages.length <= 1) {
      toast.error('A workflow must have at least one stage.');
      return;
    }

    // Check if stage is live and has issues
    const liveStage = definition.stages.find((s) => s.id === stage.ref);
    if (liveStage && liveStage.issue_count > 0) {
      setStageToRemove(stage);
      setRemovalDialogOpen(true);
      return;
    }

    // Immediate removal if 0 issues or newly added stage
    executeRemoveStage(stage.ref, null);
  };

  const executeRemoveStage = (removedRef: string, replacementRef: string | null) => {
    if (!draft) return;
    const nextStages = draft.stages.filter((s) => s.ref !== removedRef);
    const nextReplacements = { ...draft.replacements };
    if (replacementRef && !removedRef.startsWith('new:')) {
      nextReplacements[removedRef] = replacementRef;
    } else {
      delete nextReplacements[removedRef];
    }

    // Remove transitions to or from this stage
    const nextTransitions = draft.transitions.filter((t) => t.from !== removedRef && t.to !== removedRef);

    // If initial stage is being removed, fallback to first open stage
    let nextInitial = draft.initial;
    if (nextInitial === removedRef) {
      const firstOpen = nextStages.find((s) => s.category !== 'done' && s.category !== 'canceled');
      nextInitial = firstOpen?.ref ?? nextStages[0]?.ref ?? null;
    }

    // If merge target was removed, fallback to null or first done stage
    const nextMergeAction = { ...draft.merge_action };
    if (nextMergeAction.target === removedRef) {
      const firstDone = nextStages.find((s) => s.category === 'done');
      nextMergeAction.target = firstDone?.ref ?? null;
      if (!nextMergeAction.target) nextMergeAction.mode = 'none';
    }

    updateDraft((d) => ({
      ...d,
      stages: nextStages,
      replacements: nextReplacements,
      transitions: nextTransitions,
      initial: nextInitial,
      merge_action: nextMergeAction,
    }));
    setRemovalDialogOpen(false);
    setStageToRemove(null);
  };

  // Template reset
  const handleApplyTemplate = (tmpl: WorkflowTemplateSummary) => {
    if (!definition) return;
    const def = tmpl.definition;
    const newStages: WorkflowDraftStage[] = def.stages.map((st, i) => {
      // Match existing stage by name if possible to preserve IDs
      const matchingLive = definition.stages.find((live) => live.name.toLowerCase() === st.name.toLowerCase());
      return {
        ref: matchingLive ? matchingLive.id : `new:stage_tmpl_${i}_${Date.now()}`,
        name: st.name,
        category: st.category,
        color: st.color ?? null,
        counts_toward_wip: st.counts_toward_wip ?? null,
        wip_limit: st.wip_limit ?? null,
      };
    });

    const newTransitions = def.transitions.map((t) => ({
      from: t.from === null ? null : newStages[t.from]?.ref ?? null,
      to: newStages[t.to]?.ref ?? newStages[0]?.ref ?? '',
    }));

    const initialRef = def.initial !== null ? newStages[def.initial]?.ref ?? newStages[0]?.ref ?? null : newStages[0]?.ref ?? null;

    setDraft({
      base_version: definition.version,
      transition_mode: (def.transition_mode as TransitionMode) || 'any',
      wip_policy: (def.wip_policy as WipPolicy) || 'warn',
      stages: newStages,
      initial: initialRef,
      transitions: newTransitions,
      replacements: {},
      merge_action: {
        mode: def.merge_target !== null ? 'status' : 'none',
        target: def.merge_target !== null ? (newStages[def.merge_target]?.ref ?? null) : null,
      },
    });
    setIsDirty(true);
    toast.info(`Loaded template "${tmpl.name}". Review and publish to apply.`);
  };

  // Publishing
  const handleOpenPublish = async () => {
    if (!draft) return;
    startTransition(async () => {
      const prev = await runPreview(draft);
      if (prev) {
        setPublishDialogOpen(true);
      }
    });
  };

  const handleConfirmPublish = async (acknowledgeReporting: boolean) => {
    if (!draft || !preview) return;
    try {
      setIsPublishing(true);
      const res = await publishWorkflowApi(workspaceId, space.id, {
        ...draft,
        confirmed_affected_issues: preview.affected_issue_count,
        acknowledge_reporting_changes: acknowledgeReporting,
      });
      toast.success('Workflow published successfully!');
      setPublishDialogOpen(false);
      setDefinition(res.workflow);
      setDraft(initDraftFromDefinition(res.workflow));
      setIsDirty(false);
      setPreview(null);
      await onPublished();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsPublishing(false);
    }
  };

  const availableRemovalTargets = useMemo(() => {
    if (!draft || !stageToRemove) return [];
    return draft.stages
      .filter((s) => s.ref !== stageToRemove.ref)
      .map((s) => ({ ref: s.ref, name: s.name }));
  }, [draft, stageToRemove]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (loadError || !definition || !draft) {
    return <FormMessage>{loadError ?? 'Could not load space workflow.'}</FormMessage>;
  }

  const canEdit = definition.can_edit;
  const stageNames = draft.stages.map((s) => s.name);

  return (
    <div className="flex flex-col gap-6 pb-24 sm:pb-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="size-5 text-primary" aria-hidden="true" />
            <h3 className="text-lg font-bold">Space Workflow Configuration</h3>
            <StatusBadge tone="neutral">v{definition.version}</StatusBadge>
            {isDirty && <StatusBadge tone="warning">Unsaved Draft</StatusBadge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Customize stages (board columns), reporting categories, WIP limits, and transition rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Layers className="size-4" aria-hidden="true" />
                  Preset Templates
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm">
                <DropdownMenuLabel>Workflow Templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {templates.map((tmpl) => (
                  <DropdownMenuItem key={tmpl.id} onSelect={() => handleApplyTemplate(tmpl)}>
                    <div className="flex flex-col">
                      <span className="font-medium">{tmpl.name}</span>
                      {tmpl.description && <span className="text-xs text-muted-foreground">{tmpl.description}</span>}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(initDraftFromDefinition(definition));
                setIsDirty(false);
                setPreview(null);
                toast.info('Discarded draft changes.');
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Discard
            </Button>
          )}

          {canEdit && (
            <Button size="sm" onClick={handleOpenPublish} disabled={isPending || (!isDirty && !preview)}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Review & Publish
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-info/40 bg-info-subtle p-3 text-sm text-info">
          <strong>Read-only view:</strong> You do not have permission to modify this space's workflow. Only space admins
          or delegated workflow editors can publish changes.
        </div>
      )}

      {previewError && <FormMessage>{previewError}</FormMessage>}

      {/* Navigation sub-tabs */}
      <div className="flex overflow-x-auto border-b border-border">
        <button
          type="button"
          onClick={() => setActiveSubTab('stages')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeSubTab === 'stages'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderKanban className="size-4" aria-hidden="true" />
          Stages & Board Columns ({draft.stages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('transitions')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeSubTab === 'transitions'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Workflow className="size-4" aria-hidden="true" />
          Transition Rules ({draft.transition_mode === 'restricted' ? 'Restricted' : 'Free'})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('policy')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeSubTab === 'policy'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="size-4" aria-hidden="true" />
          WIP & Automations
        </button>
      </div>

      {/* TAB 1: STAGES */}
      {activeSubTab === 'stages' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Stages define the columns displayed on board views in left-to-right order. Drag or use arrows to reorder.
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto shrink-0"
                onClick={() => {
                  setEditingStage(null);
                  setStageFormOpen(true);
                }}
                disabled={draft.stages.length >= 20}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Stage
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {draft.stages.map((stage, index) => {
              const liveData = definition.stages.find((s) => s.id === stage.ref);
              const isInitial = draft.initial === stage.ref;
              const hasProblem = preview?.errors.some((e) => e.refs.includes(stage.ref));

              return (
                <div
                  key={stage.ref}
                  draggable={canEdit}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-2xs transition-all ${
                    draggedIndex === index ? 'opacity-40' : ''
                  } ${hasProblem ? 'border-danger' : 'border-border'}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Drag Handle */}
                    {canEdit && (
                      <div className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing shrink-0">
                        <GripVertical className="size-4" aria-hidden="true" />
                      </div>
                    )}

                    {/* Order & Reorder arrows */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="font-mono text-xs font-semibold text-muted-foreground w-5 text-center">
                        {index + 1}
                      </span>
                      {canEdit && (
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={index === 0}
                            onClick={() => handleMoveStage(index, -1)}
                            aria-label={`Move ${stage.name} up`}
                          >
                            <ArrowUp className="size-3" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={index === draft.stages.length - 1}
                            onClick={() => handleMoveStage(index, 1)}
                            aria-label={`Move ${stage.name} down`}
                          >
                            <ArrowDown className="size-3" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Stage Badge & Name */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{stage.name}</span>
                        <StatusBadge tone={(stage.color as StageColor) || 'neutral'}>
                          {categoryLabel(stage.category)}
                        </StatusBadge>
                        {isInitial && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            <Star className="size-3 fill-primary" aria-hidden="true" /> Initial
                          </span>
                        )}
                        {stage.wip_limit && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            WIP Limit: {stage.wip_limit}
                          </span>
                        )}
                      </div>
                      {liveStageData(liveData)}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                      {/* Set as initial */}
                      {!isInitial && stage.category !== 'done' && stage.category !== 'canceled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => updateDraft((d) => ({ ...d, initial: stage.ref }))}
                          title="Set as initial stage for new issues"
                        >
                          <Star className="size-3.5 mr-1" aria-hidden="true" />
                          Make initial
                        </Button>
                      )}

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setEditingStage(stage);
                          setStageFormOpen(true);
                        }}
                        aria-label={`Edit ${stage.name}`}
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-danger hover:bg-danger-subtle hover:text-danger"
                        onClick={() => handleRequestRemoveStage(stage)}
                        aria-label={`Delete ${stage.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSITIONS */}
      {activeSubTab === 'transitions' && (
        <Card>
          <CardHeader>
            <CardTitle>Transition Rules & Path Restrictions</CardTitle>
            <CardDescription>
              Control whether issues can move freely between any columns or must follow specified transition paths.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {canEdit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="transition_mode"
                    value="any"
                    checked={draft.transition_mode === 'any'}
                    onChange={(e) => updateDraft((d) => ({ ...d, transition_mode: e.target.value as TransitionMode }))}
                    className="mt-1 size-4"
                  />
                  <div>
                    <span className="font-semibold text-sm">Flexible (Any-to-Any)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Team members can drag and drop issues between any columns freely. Recommended for Agile / Kanban.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="transition_mode"
                    value="restricted"
                    checked={draft.transition_mode === 'restricted'}
                    onChange={(e) => updateDraft((d) => ({ ...d, transition_mode: e.target.value as TransitionMode }))}
                    className="mt-1 size-4"
                  />
                  <div>
                    <span className="font-semibold text-sm">Restricted (Strict Paths)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Only explicit transitions configured below will be allowed. Unlisted moves will be blocked.
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-sm">
                Current mode: <strong>{draft.transition_mode === 'restricted' ? 'Restricted Flow' : 'Flexible'}</strong>
              </p>
            )}

            {draft.transition_mode === 'restricted' && (
              <div className="rounded-lg border p-4 space-y-4">
                <h4 className="text-sm font-semibold">Allowed Transitions by Destination Stage</h4>
                <div className="divide-y divide-border">
                  {draft.stages.map((toStage) => {
                    const isGlobal = draft.transitions.some((t) => t.from === null && t.to === toStage.ref);
                    const incomingFrom = draft.transitions
                      .filter((t) => t.to === toStage.ref && t.from !== null)
                      .map((t) => t.from);

                    return (
                      <div key={toStage.ref} className="py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Into "{toStage.name}"</span>
                          {canEdit && (
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isGlobal}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateDraft((d) => {
                                    const next = d.transitions.filter((t) => !(t.from === null && t.to === toStage.ref));
                                    if (checked) {
                                      next.push({ from: null, to: toStage.ref });
                                    }
                                    return { ...d, transitions: next };
                                  });
                                }}
                                className="rounded"
                              />
                              Allow from any status (Global)
                            </label>
                          )}
                        </div>

                        {!isGlobal && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {draft.stages
                              .filter((fromStage) => fromStage.ref !== toStage.ref)
                              .map((fromStage) => {
                                const isAllowed = incomingFrom.includes(fromStage.ref);
                                return (
                                  <button
                                    key={fromStage.ref}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => {
                                      updateDraft((d) => {
                                        let next = [...d.transitions];
                                        if (isAllowed) {
                                          next = next.filter(
                                            (t) => !(t.from === fromStage.ref && t.to === toStage.ref),
                                          );
                                        } else {
                                          next.push({ from: fromStage.ref, to: toStage.ref });
                                        }
                                        return { ...d, transitions: next };
                                      });
                                    }}
                                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                      isAllowed
                                        ? 'border-primary bg-primary/10 font-semibold text-primary'
                                        : 'border-border text-muted-foreground hover:bg-muted'
                                    }`}
                                  >
                                    From {fromStage.name} {isAllowed ? '✓' : '+'}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: WIP & AUTOMATION */}
      {activeSubTab === 'policy' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* WIP Policy */}
          <Card>
            <CardHeader>
              <CardTitle>Work In Progress (WIP) Policy</CardTitle>
              <CardDescription>Determine what happens when a column's card limit is exceeded.</CardDescription>
            </CardHeader>
            <CardContent>
              {canEdit ? (
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="wip_policy"
                    value="warn"
                    checked={draft.wip_policy === 'warn'}
                    onChange={(e) => updateDraft((d) => ({ ...d, wip_policy: e.target.value as WipPolicy }))}
                    className="mt-1 size-4"
                  />
                  <div>
                    <span className="font-semibold text-sm">Warn on Exceed (Soft)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Highlight column header in warning colors when limit is surpassed, but allow team to move work.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="wip_policy"
                    value="block"
                    checked={draft.wip_policy === 'block'}
                    onChange={(e) => updateDraft((d) => ({ ...d, wip_policy: e.target.value as WipPolicy }))}
                    className="mt-1 size-4"
                  />
                  <div>
                    <span className="font-semibold text-sm">Block Moves (Strict)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prevent cards from moving into the stage once capacity is reached.
                    </p>
                  </div>
                </label>
              </div>
              ) : (
                <p className="text-sm">
                  Policy: <strong>{draft.wip_policy === 'block' ? 'Block Moves' : 'Warn on Exceed'}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* GitHub Merge Action */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="size-4" aria-hidden="true" />
                GitHub Merge Action
              </CardTitle>
              <CardDescription>
                When a linked pull request is merged, automatically advance the issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="merge-mode">On PR Merge</Label>
                <Select
                  disabled={!canEdit}
                  value={draft.merge_action.mode}
                  onValueChange={(val: 'status' | 'none') =>
                    updateDraft((d) => ({
                      ...d,
                      merge_action: {
                        mode: val,
                        target: val === 'status' ? d.merge_action.target ?? d.stages.find((s) => s.category === 'done')?.ref ?? null : null,
                      },
                    }))
                  }
                >
                  <SelectTrigger id="merge-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Link PR only (Do not move issue)</SelectItem>
                    <SelectItem value="status">Move issue to status...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.merge_action.mode === 'status' && (
                <div className="grid gap-2">
                  <Label htmlFor="merge-target">Target Status</Label>
                  <Select
                    disabled={!canEdit}
                    value={draft.merge_action.target ?? ''}
                    onValueChange={(targetRef) =>
                      updateDraft((d) => ({
                        ...d,
                        merge_action: { ...d.merge_action, target: targetRef },
                      }))
                    }
                  >
                    <SelectTrigger id="merge-target">
                      <SelectValue placeholder="Select destination stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {draft.stages
                        .filter((s) => s.category !== 'canceled')
                        .map((s) => (
                          <SelectItem key={s.ref} value={s.ref}>
                            {s.name} ({categoryLabel(s.category)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Target must not be a canceled stage.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      <StageFormDialog
        key={editingStage?.ref ?? (stageFormOpen ? 'new' : 'closed')}
        open={stageFormOpen}
        stage={editingStage}
        existingNames={stageNames}
        onSave={handleSaveStage}
        onCancel={() => {
          setStageFormOpen(false);
          setEditingStage(null);
        }}
      />

      {stageToRemove && (
        <StageRemovalDialog
          open={removalDialogOpen}
          stageName={stageToRemove.name}
          issueCount={definition.stages.find((s) => s.id === stageToRemove.ref)?.issue_count ?? 0}
          availableTargets={availableRemovalTargets}
          onConfirm={(targetRef) => executeRemoveStage(stageToRemove.ref, targetRef)}
          onCancel={() => {
            setRemovalDialogOpen(false);
            setStageToRemove(null);
          }}
        />
      )}

      <WorkflowPublishDialog
        open={publishDialogOpen}
        preview={preview}
        isPublishing={isPublishing}
        onConfirm={handleConfirmPublish}
        onCancel={() => setPublishDialogOpen(false)}
      />
    </div>
  );
};

function liveStageData(liveStage: WorkflowDefinition['stages'][number] | undefined) {
  if (!liveStage) {
    return <p className="text-[11px] text-primary mt-0.5">New stage (Will be created on publish)</p>;
  }
  return (
    <p className="text-[11px] text-muted-foreground mt-0.5">
      {liveStage.issue_count} live {liveStage.issue_count === 1 ? 'issue' : 'issues'} ({liveStage.wip_count} active WIP)
    </p>
  );
}

export default WorkflowEditor;
