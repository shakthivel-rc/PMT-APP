import type { IssueType, StatusCategory, UserRef } from './index';

/*
 * Typed dependencies between issues (`routes/dependencies.py` in pmt-api;
 * 09-restructuring.md §10). Always read from one issue's side: the same row is `blocks` from
 * its source and `is blocked by` from its target, so the payload says which end the reader is
 * on (`direction`) and gives the sentence to show (`label`). Cross-space links are the point:
 * a parent never crosses spaces, a dependency does.
 */

export type DependencyKind = 'blocks' | 'relates' | 'duplicates' | 'clones';

export interface DependencyIssue {
  id: string;
  /** Its current key — never an old one. */
  key: string;
  title: string;
  type: IssueType | string;
  status_id: string;
  status_name: string;
  /** A `blocks` whose blocker is closed (done or canceled) no longer blocks anything. */
  category: StatusCategory | string;
  space_id: string;
  list_id: string;
}

export interface DependencySummary {
  /** What `DELETE …/dependencies/{id}` takes. */
  id: string;
  kind: DependencyKind | string;
  direction: 'outward' | 'inward' | string;
  /** `blocks`, `is blocked by`, `relates to`, `duplicates`, `is duplicated by`, `clones`, `is cloned by`. */
  label: string;
  issue: DependencyIssue;
  created_at: string;
  created_by: UserRef;
}

/** Name the other issue by id, or by a key — an old key still resolves. A duplicate is a 409 with `data.dependency_id`. */
export interface DependencyCreate {
  kind: DependencyKind;
  target_issue_id?: string;
  target_key?: string;
}
