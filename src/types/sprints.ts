/*
 * Sprints (`routes/sprints.py` in pmt-api; docs/design/08-reports.md §5.1). Per project
 * (space), at most one active at a time. Starting one freezes its commitment and closing it
 * freezes what was completed — the two numbers the velocity chart draws.
 */

export type SprintState = 'planned' | 'active' | 'closed';

export interface SprintSummary {
  id: string;
  space_id: string;
  name: string;
  goal: string | null;
  state: SprintState | string;
  starts_on: string | null;
  ends_on: string | null;
  /** Frozen at start. */
  committed_points: number | null;
  /** Frozen at close. */
  completed_points: number | null;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
  issue_count: number;
  points: number;
  /** Of `issue_count`, how many are in a `done` stage — delivered. */
  done_issue_count: number;
  done_points: number;
  /**
   * Of `issue_count`, how many are in a `canceled` stage: closed but not delivered, so in
   * neither `done_issue_count` nor the points completed (09-restructuring.md §9).
   */
  canceled_issue_count: number;
}

export interface SprintCreate {
  name: string;
  goal?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
}

export type SprintUpdate = Partial<SprintCreate>;

export interface SprintStart {
  starts_on?: string | null;
  ends_on?: string | null;
}

export interface SprintClose {
  /** Where the unfinished issues go. */
  carry_over: 'backlog' | 'sprint';
  /** With `sprint`: a planned sprint of the same project. */
  target_sprint_id?: string | null;
}

export interface SprintCloseResult {
  sprint: SprintSummary;
  /** Done at close; they stay in the sprint. */
  completed_issues: number;
  /** Canceled at close: they stay in it too, are not carried over and are not in `completed_points`. */
  canceled_issues: number;
  carried_over: number;
  /** `done` stages only. */
  completed_points: number;
}

export interface SprintIssueChange {
  sprint: SprintSummary;
  changed: string[];
  unchanged: string[];
}
