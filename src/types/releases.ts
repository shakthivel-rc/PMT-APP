import type { IssueCard, IssueType } from './index';

/*
 * Releases and fix versions (`routes/releases.py` in pmt-api; 09-restructuring.md §10).
 * Progress and notes are computed from the issues on every read: canceled work is never
 * counted as delivered, and `done + canceled + open == issues` always holds.
 */

export type ReleaseState = 'unreleased' | 'released' | 'archived';

export interface ReleaseProgress {
  issues: number;
  done: number;
  canceled: number;
  open: number;
}

/** A release as an issue's fix version — enough to draw the chip. */
export interface FixVersion {
  id: string;
  space_id: string;
  name: string;
  state: ReleaseState | string;
  start_date: string | null;
  /** Planned, or — once released — actual. */
  release_date: string | null;
  released_at: string | null;
}

export interface ReleaseSummary extends FixVersion {
  /** Plain text. Rendered as text. */
  description: string | null;
  created_at: string;
  updated_at: string;
  progress: ReleaseProgress;
}

export interface ReleaseDetail extends ReleaseSummary {
  /** In key order, at most 500. */
  issues: IssueCard[];
  truncated: boolean;
}

export interface ReleaseOutcome {
  release: ReleaseSummary;
  moved_issue_ids: string[];
  moved_to: ReleaseSummary | null;
}

export interface ReleaseNoteItem {
  id: string;
  key: string;
  title: string;
  type: IssueType | string;
  outcome: 'done' | 'canceled' | 'open' | string;
}

export interface ReleaseNotesSection {
  /** An issue type for delivered work; `canceled` or `open` for what did not ship. */
  type: string;
  title: string;
  issues: ReleaseNoteItem[];
}

export interface ReleaseNotes {
  release: ReleaseSummary;
  /** Plain text, ready to paste. */
  text: string;
  /** The same, structured; empty sections left out. */
  sections: ReleaseNotesSection[];
}

export interface ReleaseCreate {
  /** Unique among the space's releases, ignoring case. */
  name: string;
  description?: string | null;
  start_date?: string | null;
  release_date?: string | null;
}

/**
 * `state` moves: archived from any state; unreleased from any (un-release, un-archive);
 * released only back from archived for one that shipped. Releasing itself is `shipReleaseApi`.
 */
export interface ReleaseUpdate {
  name?: string;
  description?: string | null;
  start_date?: string | null;
  release_date?: string | null;
  state?: ReleaseState;
}

export interface ReleaseShip {
  /** Omitted: today, in the workspace's report time zone. */
  release_date?: string | null;
  /** Move the release's open issues to this unreleased release of the same space. */
  move_open_to_release_id?: string | null;
}

/** REPLACES the set: include archived releases already on the issue, or they are removed. */
export interface FixVersionsSet {
  release_ids: string[];
}
