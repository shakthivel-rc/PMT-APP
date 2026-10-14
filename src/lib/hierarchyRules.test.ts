import { describe, expect, it } from 'vitest';
import { allowedParentTypes, childTypesOf, parentProblem, parentRequired, retypeProblem } from './hierarchyRules';

/*
 * The same answers `utils/hierarchy_rules.standard_parent_problem` gives in pmt-api, word for
 * word where it has words: a form that offered a parent the API then refused would be a form
 * that lies.
 */

describe('the standard convention', () => {
  it('puts stories, tasks and bugs under an epic, and subtasks under any of the three', () => {
    expect(allowedParentTypes('story')).toEqual(['epic']);
    expect(allowedParentTypes('bug')).toEqual(['epic']);
    expect(allowedParentTypes('subtask')).toEqual(['story', 'task', 'bug']);
    expect(allowedParentTypes('epic')).toEqual([]);
    // A type the API adds later offers no parent here rather than throwing.
    expect(allowedParentTypes('initiative' as never)).toEqual([]);
  });

  it('requires a parent for a subtask only', () => {
    expect(['epic', 'story', 'task', 'bug', 'subtask'].map((t) => parentRequired(t as never))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('explains every refusal the way the API does', () => {
    expect(parentProblem('task', 'epic')).toBeNull();
    expect(parentProblem('story', null)).toBeNull();
    expect(parentProblem('subtask', null)).toBe('A subtask needs a parent.');
    expect(parentProblem('epic', 'epic')).toBe('An epic cannot have a parent.');
    expect(parentProblem('task', 'story')).toBe('A task can sit under: epic.');
    expect(parentProblem('subtask', 'subtask')).toBe('A subtask can sit under: bug, story, task.');
    expect(parentProblem('nonsense' as never, null)).toBe('Unknown issue type nonsense.');
  });

  it('offers the child types a parent can take', () => {
    expect(childTypesOf('epic')).toEqual(['story', 'task', 'bug']);
    expect(childTypesOf('story')).toEqual(['subtask']);
    expect(childTypesOf('subtask')).toEqual([]);
  });
});

describe('retyping', () => {
  it('checks the issue against its parent and every child against the new type', () => {
    expect(retypeProblem('bug', 'epic', ['subtask'])).toBeNull();
    expect(retypeProblem('epic', 'epic', [])).toBe('An epic cannot have a parent.');
    expect(retypeProblem('epic', null, ['subtask'])).toBe('Its subtask children cannot sit under an epic.');
    expect(retypeProblem('subtask', 'story', ['subtask'])).toBe('Its subtask children cannot sit under a subtask.');
  });
});
