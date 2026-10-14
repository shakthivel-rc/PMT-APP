import type { StageColor, StatusCategory, TransitionMode, UserRef, WipPolicy, MergeMode } from './index';

/*
 * Customisable workflows (`routes/workflow.py` in pmt-api; docs/design/09-restructuring.md
 * §4). Mirrors `schemas/responses/workflow.py` (payloads) and `schemas/workflow.py` (bodies)
 * field for field, with the models' own names.
 *
 * A draft names stages by REF: an existing stage's id, or `new:<anything>` for a stage the
 * draft adds. Transitions use the JSON key `from` — literally — because that is what the API
 * reads; `from_` exists only on the Python side. Problems come back with a stable `code` from
 * the tables of §4.4 and the refs they are about, so the editor can place each one beside the
 * field it concerns.
 */

/** One live stage, with what it holds now. */
export interface WorkflowStage {
  id: string;
  name: string;
  category: StatusCategory | string;
  color: StageColor | string;
  position: number;
  counts_toward_wip: boolean;
  wip_limit: number | null;
  /** Live issues in it now, of every type. */
  issue_count: number;
  /** Of those, the story, task and bug issues — what a WIP limit is compared with. */
  wip_count: number;
}

export interface WorkflowTransitionSummary {
  id: string;
  /** Null for a global transition, allowed from every stage. */
  from_status_id: string | null;
  to_status_id: string;
}

export interface WorkflowMergeAction {
  mode: MergeMode | string;
  /** Null with `none` — and with `status` only when the target is no longer live (merges then fail visibly). */
  target_status_id: string | null;
}

/** A member granted workflow-edit permission. Admins and owners can always edit and are not listed. */
export interface WorkflowEditor {
  user: UserRef;
  /** Their workspace role now; a grant to someone who has since become a guest has no effect. */
  role: string;
}

/** A space's workflow, as the editor starts from it. */
export interface WorkflowDefinition {
  space_id: string;
  /** Send it back as `base_version` when publishing. */
  version: number;
  transition_mode: TransitionMode | string;
  initial_status_id: string | null;
  wip_policy: WipPolicy | string;
  merge_action: WorkflowMergeAction;
  /** Live stages, in board order. */
  stages: WorkflowStage[];
  /** Consulted only in `restricted` mode, and kept in `any` mode so switching back restores them. */
  transitions: WorkflowTransitionSummary[];
  /** Whether YOU may change this workflow. */
  can_edit: boolean;
  editors: WorkflowEditor[];
}

/** An error (publishing is refused while any exists) or a warning. */
export interface WorkflowProblem {
  /** Stable, from 09-restructuring.md §4.4: `unreachable_stage`, `wip_over_limit`, … */
  code: string;
  /** One sentence for the person editing, naming the stages by name. */
  message: string;
  /** Draft refs or removed stage ids the problem is about, for the editor to highlight. */
  refs: string[];
}

export type StageChange = 'added' | 'renamed' | 'updated' | 'unchanged';

/** A stage of the draft, resolved. */
export interface WorkflowPreviewStage {
  ref: string;
  /** The existing stage it keeps, or null for a new one. */
  id: string | null;
  name: string;
  category: StatusCategory | string;
  color: StageColor | string;
  /** Its board position after publishing, from 0. */
  position: number;
  counts_toward_wip: boolean;
  wip_limit: number | null;
  change: StageChange | string;
  previous_name: string | null;
  previous_category: string | null;
  /** Live issues in it now (0 for a new stage); those moving in are counted under `removed`. */
  issue_count: number;
}

/** A live stage the draft leaves out: soft-deleted, its history kept. */
export interface WorkflowPreviewRemoval {
  id: string;
  name: string;
  category: StatusCategory | string;
  /** Live issues that will move out of it. */
  issue_count: number;
  /** Where they move, as a draft ref. */
  replacement_ref: string | null;
  replacement_name: string | null;
}

/** A kept stage whose category changes: its current issues AND its history are re-labelled in every report. */
export interface WorkflowCategoryChange {
  id: string;
  name: string;
  from_category: string;
  to_category: string;
  issue_count: number;
}

export interface WorkflowPreviewMoves {
  total: number;
  /** Of those, how many land in a closed stage. */
  into_closed: number;
  /** Of those, how many are in the active sprint. */
  in_active_sprint: number;
}

/** A transition as it will be stored, with names. */
export interface WorkflowPreviewTransition {
  /** Draft ref, or null for any stage. */
  from: string | null;
  to: string;
  from_name: string | null;
  to_name: string | null;
}

/** The GitHub merge action, revalidated against the draft. */
export interface WorkflowPreviewIntegration {
  mode: MergeMode | string;
  target_ref: string | null;
  target_name: string | null;
  /** False when the target would be refused. */
  valid: boolean;
  /** What a merge will do, in a sentence. */
  message: string;
  /** Open stages from which no transition leads to the target: a merge there fails visibly. */
  unreachable_from: string[];
}

/** Everything publishing the draft would do, and everything wrong with it. */
export interface WorkflowPreview {
  valid: boolean;
  errors: WorkflowProblem[];
  warnings: WorkflowProblem[];
  stages: WorkflowPreviewStage[];
  removed: WorkflowPreviewRemoval[];
  category_changes: WorkflowCategoryChange[];
  moves: WorkflowPreviewMoves;
  transitions: WorkflowPreviewTransition[];
  integration: WorkflowPreviewIntegration;
  /** Publishing must confirm this number (`confirmed_affected_issues`). */
  affected_issue_count: number;
  /** Publishing needs `acknowledge_reporting_changes: true`. */
  requires_reporting_ack: boolean;
}

export interface WorkflowPublishResult {
  workflow: WorkflowDefinition;
  /** Each with a `status_changed` event by the publisher. */
  moved_issues: number;
  version: number;
}

// ---- templates --------------------------------------------------------------------------

export interface WorkflowTemplateStage {
  name: string;
  category: StatusCategory;
  color?: StageColor | null;
  counts_toward_wip?: boolean | null;
  wip_limit?: number | null;
}

export interface WorkflowTemplateTransition {
  /** Index of the stage it leaves, or null for any stage. */
  from: number | null;
  /** Index of the stage it enters. */
  to: number;
}

/** A template's workflow: stages by position; initial, transitions and merge target as indexes. */
export interface TemplateDefinition {
  transition_mode: TransitionMode;
  wip_policy: WipPolicy;
  stages: WorkflowTemplateStage[];
  initial: number;
  transitions: WorkflowTemplateTransition[];
  /** Index of the merge target, or null for "link only". */
  merge_target: number | null;
}

export interface WorkflowTemplateSummary {
  /** `builtin:<key>` for a built-in; an opaque id otherwise. */
  id: string;
  /** `default`, `delivery`, `support`, or null. */
  key: string | null;
  name: string;
  description: string | null;
  /** Built-ins belong to every workspace and cannot be deleted. */
  builtin: boolean;
  created_by: UserRef | null;
  created_at: string | null;
  definition: TemplateDefinition;
}

export interface WorkflowTemplateDeleted {
  id: string;
}

// ---- request bodies ---------------------------------------------------------------------

/** Omitted colour, WIP flag and limit on an existing stage keep the stored values; null resets them. */
export interface WorkflowDraftStage {
  ref: string;
  name: string;
  category: StatusCategory | string;
  color?: StageColor | string | null;
  counts_toward_wip?: boolean | null;
  wip_limit?: number | null;
}

export interface WorkflowDraftTransition {
  /** A ref, or null for "from any stage". The JSON key is literally `from`. */
  from: string | null;
  to: string;
}

export interface WorkflowDraftMergeAction {
  mode: MergeMode;
  target: string | null;
}

export interface WorkflowDraft {
  /** The `version` the draft started from; a stale one is a 409 `{current_version}`. */
  base_version: number;
  transition_mode: TransitionMode;
  wip_policy: WipPolicy;
  stages: WorkflowDraftStage[];
  initial: string | null;
  transitions: WorkflowDraftTransition[];
  /** Removed stage id → the ref of the stage its issues move to. */
  replacements: Record<string, string>;
  merge_action: WorkflowDraftMergeAction;
}

export interface WorkflowPublish extends WorkflowDraft {
  /** Must equal the preview's `affected_issue_count`; a changed count is a 409 `{affected_issue_count}`. */
  confirmed_affected_issues: number;
  /** Required when the preview says `requires_reporting_ack`. */
  acknowledge_reporting_changes: boolean;
}

/** Save a space's workflow (`from_space_id`) or a definition as a workspace template. */
export interface WorkflowTemplateCreate {
  name: string;
  description?: string | null;
  from_space_id?: string | null;
  definition?: TemplateDefinition | null;
}

export interface WorkflowEditorsUpdate {
  /** Replaces the set. A 422 carries `data.not_members` and `data.guests`. */
  user_ids: string[];
}
