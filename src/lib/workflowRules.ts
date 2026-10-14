import type { FolderNode, ListNode, SpaceNode } from '@/types';

/*
 * The workflow questions the board, the drawer and the planning views all ask, answered the
 * way the API answers them — `utils/workflow_rules.py` in pmt-api is the original, and these
 * mirror it rule for rule. They exist so a drag can be checked before it is sent and a status
 * menu can offer only the stages the issue can reach; the API still decides, and a refusal it
 * sends is shown as it is.
 */

/** Closed: neither on the backlog nor active work. Only `done` of the two is delivered. */
export const isClosedCategory = (category: string | null | undefined): boolean =>
  category === 'done' || category === 'canceled';

/** Delivered — what velocity, burndown "completed", cycle time and release notes count. */
export const isDeliveredCategory = (category: string | null | undefined): boolean => category === 'done';

/** How the restructuring plan names the categories, for labels and menus. Unknown values show as themselves. */
const CATEGORY_LABELS: Record<string, string> = {
  todo: 'Not started',
  in_progress: 'Active',
  done: 'Completed',
  canceled: 'Canceled',
};

export const categoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category;

/**
 * Epics are outcomes, not work in progress, and a subtask is part of an item that is already
 * counted — counting both would show a team of four "at 11 of 4" because one story has seven
 * subtasks. The API's `ColumnWip.count` counts exactly these.
 */
export const countsTowardWip = (type: string): boolean => type === 'story' || type === 'task' || type === 'bug';

/** The part of a workflow a move is checked against: a board, or a space's workflow summary. */
export interface FlowRules {
  transition_mode: string;
  transitions: { from_status_id: string | null; to_status_id: string }[];
}

/**
 * May an issue in `fromId` move to `toId`? Staying put (a reorder) is always allowed; in a
 * free workflow so is everything; in a restricted one only a stored transition from that
 * stage — or a global one, whose `from_status_id` is null — allows it.
 */
export function moveAllowed(rules: FlowRules, fromId: string, toId: string): boolean {
  if (fromId === toId || rules.transition_mode !== 'restricted') return true;
  return rules.transitions.some(
    (t) => t.to_status_id === toId && (t.from_status_id === null || t.from_status_id === fromId),
  );
}

/** The stages an issue in `fromId` can move to, in the order of `stages` (board order), itself excluded. */
export function allowedDestinations<T extends { id: string }>(rules: FlowRules, stages: T[], fromId: string): T[] {
  return stages.filter((stage) => stage.id !== fromId && moveAllowed(rules, fromId, stage.id));
}

/**
 * The stages a new issue may be created in. A restricted workflow creates only into its
 * initial stage (the API refuses any other with a 422); a free one into any live stage —
 * which is what lets the board's quick-add create into the column it sits in.
 */
export function creatableStages<T extends { id: string }>(
  rules: FlowRules & { initial_status_id: string | null },
  stages: T[],
): T[] {
  if (rules.transition_mode !== 'restricted') return stages;
  return stages.filter((stage) => stage.id === rules.initial_status_id);
}

/**
 * Why nothing in this container can be changed, or null when it can be. A list is read-only
 * when it, its folder or its space is archived, or while its space is frozen — the API's
 * write guard asks the same four questions, in the same order of precedence, and answers 423.
 */
export function readOnlyReason(
  space: Pick<SpaceNode, 'archived' | 'frozen' | 'freeze_reason'>,
  folder?: Pick<FolderNode, 'archived'> | null,
  list?: Pick<ListNode, 'archived'> | null,
): string | null {
  if (space.archived) return 'This space is archived: it is read-only, its history kept.';
  if (space.frozen) {
    return space.freeze_reason
      ? `This space is frozen while it is being reorganised: ${space.freeze_reason}`
      : 'This space is frozen while it is being reorganised.';
  }
  if (folder?.archived) return 'This folder is archived: its lists are read-only.';
  if (list?.archived) return 'This list is archived: it is read-only, its history kept.';
  return null;
}

/** The folder a list sits in, from its space — or null for a list on the space root. */
export function folderOf(space: Pick<SpaceNode, 'folders'>, list: Pick<ListNode, 'folder_id'>): FolderNode | null {
  return list.folder_id ? (space.folders.find((folder) => folder.id === list.folder_id) ?? null) : null;
}
