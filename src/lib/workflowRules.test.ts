import { describe, expect, it } from 'vitest';
import {
  allowedDestinations,
  categoryLabel,
  countsTowardWip,
  creatableStages,
  folderOf,
  isClosedCategory,
  isDeliveredCategory,
  moveAllowed,
  readOnlyReason,
} from './workflowRules';

/*
 * The same answers `utils/workflow_rules.py` gives in pmt-api — a drag checked here and
 * refused there (or the reverse) would be a board that lies.
 */

const stages = [{ id: 'todo' }, { id: 'doing' }, { id: 'review' }, { id: 'done' }, { id: 'canceled' }];
const restricted = {
  transition_mode: 'restricted',
  initial_status_id: 'todo',
  transitions: [
    { from_status_id: 'todo', to_status_id: 'doing' },
    { from_status_id: 'doing', to_status_id: 'review' },
    { from_status_id: 'review', to_status_id: 'doing' },
    { from_status_id: 'review', to_status_id: 'done' },
    // A global transition: from every stage.
    { from_status_id: null, to_status_id: 'canceled' },
  ],
};
const free = { transition_mode: 'any', initial_status_id: 'todo', transitions: restricted.transitions };

describe('categories', () => {
  it('treats done and canceled as closed, and only done as delivered', () => {
    expect([isClosedCategory('done'), isClosedCategory('canceled'), isClosedCategory('in_progress')]).toEqual([true, true, false]);
    expect([isDeliveredCategory('done'), isDeliveredCategory('canceled'), isDeliveredCategory(null)]).toEqual([true, false, false]);
  });

  it('names the categories the way the plan does, and shows unknown ones as themselves', () => {
    expect(['todo', 'in_progress', 'done', 'canceled', 'later'].map(categoryLabel)).toEqual([
      'Not started',
      'Active',
      'Completed',
      'Canceled',
      'later',
    ]);
  });

  it('counts stories, tasks and bugs toward WIP — never epics or subtasks', () => {
    expect(['story', 'task', 'bug', 'epic', 'subtask'].map(countsTowardWip)).toEqual([true, true, true, false, false]);
  });
});

describe('moves', () => {
  it('allows everything in a free workflow, the stored transitions notwithstanding', () => {
    expect(moveAllowed(free, 'todo', 'done')).toBe(true);
  });

  it('allows a reorder inside a stage, a stored transition and a global one — nothing else', () => {
    expect(moveAllowed(restricted, 'doing', 'doing')).toBe(true);
    expect(moveAllowed(restricted, 'todo', 'doing')).toBe(true);
    expect(moveAllowed(restricted, 'done', 'canceled')).toBe(true);
    expect(moveAllowed(restricted, 'todo', 'done')).toBe(false);
    expect(moveAllowed(restricted, 'doing', 'todo')).toBe(false);
  });

  it('lists where an issue can go, in board order and never itself', () => {
    expect(allowedDestinations(restricted, stages, 'review').map((s) => s.id)).toEqual(['doing', 'done', 'canceled']);
    expect(allowedDestinations(free, stages, 'todo').map((s) => s.id)).toEqual(['doing', 'review', 'done', 'canceled']);
  });

  it('creates only into the initial stage of a restricted workflow, anywhere in a free one', () => {
    expect(creatableStages(restricted, stages).map((s) => s.id)).toEqual(['todo']);
    expect(creatableStages(free, stages)).toHaveLength(5);
  });
});

describe('read-only containers', () => {
  const live = { archived: false, frozen: false, freeze_reason: null };

  it('says nothing about a writable list', () => {
    expect(readOnlyReason(live, { archived: false }, { archived: false })).toBeNull();
    expect(readOnlyReason(live)).toBeNull();
  });

  it('puts the space first, then the folder, then the list', () => {
    expect(readOnlyReason({ ...live, archived: true, frozen: true }, { archived: true })).toMatch(/space is archived/);
    expect(readOnlyReason({ ...live, frozen: true, freeze_reason: 'Wave 1' })).toBe(
      'This space is frozen while it is being reorganised: Wave 1',
    );
    expect(readOnlyReason({ ...live, frozen: true })).toBe('This space is frozen while it is being reorganised.');
    expect(readOnlyReason(live, { archived: true }, { archived: true })).toMatch(/folder is archived/);
    expect(readOnlyReason(live, null, { archived: true })).toMatch(/list is archived/);
  });

  it('finds a list’s folder, or none for a list on the space root', () => {
    const folder = { id: 'f1', name: 'Q4', position: 0, archived: true, lists: [] };
    expect(folderOf({ folders: [folder] }, { folder_id: 'f1' })).toBe(folder);
    expect(folderOf({ folders: [folder] }, { folder_id: null })).toBeNull();
    expect(folderOf({ folders: [] }, { folder_id: 'gone' })).toBeNull();
  });
});
