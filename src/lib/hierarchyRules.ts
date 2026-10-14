import type { IssueType } from '@/types';

/*
 * Which issue types may sit under which — the standard convention of 09-restructuring.md
 * §2.1, mirrored from `utils/hierarchy_rules.py` in pmt-api so a form can offer only the
 * parents the API will accept and say why before anything is sent:
 *
 *     Epic > Story / Task / Bug > Subtask
 *
 * Story, Task and Bug are peers under an optional epic; a subtask is execution detail under
 * one of them and always has a parent. Older trees the legacy rules allowed (a task under a
 * story, a bug under a subtask) keep working until someone changes them — the API re-checks a
 * relationship only when it is created or changed — so these rules decide what a form OFFERS,
 * never whether an existing tree may be drawn.
 */

const STANDARD_PARENT_TYPES: Record<IssueType, readonly IssueType[]> = {
  epic: [],
  story: ['epic'],
  task: ['epic'],
  bug: ['epic'],
  subtask: ['story', 'task', 'bug'],
};

const article = (word: string) => ('aeiou'.includes(word.charAt(0)) ? 'An' : 'A');

/** The parent types an issue of `type` may have (empty: none — it is top level). */
export const allowedParentTypes = (type: IssueType): readonly IssueType[] => STANDARD_PARENT_TYPES[type] ?? [];

/** Whether an issue of `type` must have a parent: only a subtask — a subtask of nothing is a task. */
export const parentRequired = (type: IssueType): boolean => type === 'subtask';

/**
 * Why an issue of `childType` may not sit under one of `parentType` (null: no parent), in the
 * API's own words, or null when it may.
 */
export function parentProblem(childType: IssueType, parentType: IssueType | null): string | null {
  const allowed = STANDARD_PARENT_TYPES[childType];
  if (!allowed) return `Unknown issue type ${childType}.`;
  if (parentType === null) return parentRequired(childType) ? `${article(childType)} ${childType} needs a parent.` : null;
  if (allowed.includes(parentType)) return null;
  if (allowed.length === 0) return `${article(childType)} ${childType} cannot have a parent.`;
  return `${article(childType)} ${childType} can sit under: ${[...allowed].sort().join(', ')}.`;
}

/** The types a new child of an issue of `parentType` may have — what "Add child" offers. */
export const childTypesOf = (parentType: IssueType): IssueType[] =>
  (Object.keys(STANDARD_PARENT_TYPES) as IssueType[]).filter((type) => STANDARD_PARENT_TYPES[type].includes(parentType));

/**
 * Why `issueType` cannot change to `nextType` given its parent and its children, or null when
 * it can. The API asks the same two questions of a type change: does the issue still fit
 * under its parent, and does every child still fit under it.
 */
export function retypeProblem(
  nextType: IssueType,
  parentType: IssueType | null,
  childTypes: readonly IssueType[],
): string | null {
  const own = parentProblem(nextType, parentType);
  if (own) return own;
  const misfit = childTypes.find((child) => parentProblem(child, nextType) !== null);
  return misfit ? `Its ${misfit} children cannot sit under ${article(nextType).toLowerCase()} ${nextType}.` : null;
}
