import type { IssuePriority, IssueType, StatusCategory, UserRef } from './index';

/*
 * Saved board filters (`routes/saved_views.py` in pmt-api; 09-restructuring.md §5.4). The
 * stored `filters` always come back complete, defaults filled. They are the shared filter
 * vocabulary; the board's query parameters are singular and repeatable (`assignee_id`,
 * `type`, `priority`), so `lib/viewFilters.ts` maps one to the other, and `sprint` and
 * `status_categories` are applied on this side.
 */

export type ViewType = 'board' | 'list' | 'backlog';
export type ViewScopeKind = 'list' | 'space' | 'sprint';
export type ViewVisibility = 'private' | 'workspace';

export interface ViewFilters {
  /** Account ids, `me`, or `none` for unassigned work. */
  assignee_ids: string[];
  types: IssueType[];
  priorities: IssuePriority[];
  q: string | null;
  /** true: only blocked; false: only unblocked; null: either. */
  blocked: boolean | null;
  /** `none` (backlog), `active`, or a sprint id; null: any. */
  sprint: string | null;
  status_categories: StatusCategory[];
  epic_id: string | null;
}

export interface SavedViewSummary {
  id: string;
  name: string;
  view_type: ViewType | string;
  scope_kind: ViewScopeKind | string;
  scope_id: string;
  /** Null when the scope has since been deleted: the view has nothing to open. */
  scope_name: string | null;
  filters: ViewFilters;
  visibility: ViewVisibility | string;
  owner: UserRef;
  /** Its owner only. */
  can_edit: boolean;
  /** Its owner, or an admin when it is shared with the workspace. */
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedViewCreate {
  name: string;
  view_type?: ViewType;
  scope_kind: ViewScopeKind;
  scope_id: string;
  filters?: Partial<ViewFilters>;
  visibility?: ViewVisibility;
}

export type SavedViewUpdate = Partial<SavedViewCreate>;
