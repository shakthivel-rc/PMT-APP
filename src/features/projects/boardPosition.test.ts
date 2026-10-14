import { describe, it, expect } from 'vitest';
import { neighboursAt, planMove, replaceCard } from './boardPosition';
import { makeBoard, makeIssueCard } from '@/test/fixtures';

const column = (...ids: string[]) => ids.map((id) => ({ id }));

describe('neighboursAt', () => {
  const abc = column('a', 'b', 'c');

  it('names the cards either side of a drop from another column', () => {
    expect(neighboursAt(abc, 'x', 0)).toEqual({ after_id: null, before_id: 'a' });
    expect(neighboursAt(abc, 'x', 1)).toEqual({ after_id: 'a', before_id: 'b' });
    expect(neighboursAt(abc, 'x', 3)).toEqual({ after_id: 'c', before_id: null });
  });

  it('lands in an empty column with no neighbours at all', () => {
    expect(neighboursAt([], 'x', 0)).toEqual({ after_id: null, before_id: null });
  });

  it('accounts for the dragged card still being drawn when it moves DOWN its own column', () => {
    // Dropping `a` in the gap before `c` (index 2 as drawn) puts it between b and c — not
    // after c, which is where forgetting the lift-out would put it.
    expect(neighboursAt(abc, 'a', 2)).toEqual({ after_id: 'b', before_id: 'c' });
    expect(neighboursAt(abc, 'a', 3)).toEqual({ after_id: 'c', before_id: null });
  });

  it('needs no correction when the card moves UP its own column', () => {
    expect(neighboursAt(abc, 'c', 0)).toEqual({ after_id: null, before_id: 'a' });
    expect(neighboursAt(abc, 'c', 1)).toEqual({ after_id: 'a', before_id: 'b' });
  });

  it('never names the dragged card as its own neighbour', () => {
    expect(neighboursAt(abc, 'b', 1)).toEqual({ after_id: 'a', before_id: 'c' });
    expect(neighboursAt(abc, 'b', 2)).toEqual({ after_id: 'a', before_id: 'c' });
  });

  it('clamps an index outside the column to its ends', () => {
    expect(neighboursAt(abc, 'x', -4)).toEqual({ after_id: null, before_id: 'a' });
    expect(neighboursAt(abc, 'x', 99)).toEqual({ after_id: 'c', before_id: null });
    expect(neighboursAt(abc, 'a', 99)).toEqual({ after_id: 'c', before_id: null });
  });
});

describe('planMove', () => {
  const ids = (columns: ReturnType<typeof makeBoard>['columns']) =>
    columns.map((c) => c.cards.map((card) => card.id));

  it('moves a card to another column and says so in the request body', () => {
    const board = makeBoard();
    const plan = planMove(board.columns, 'i1', 's-doing', 0)!;

    expect(plan.move).toEqual({ status_id: 's-doing', after_id: null, before_id: 'i3' });
    expect(ids(plan.columns)).toEqual([['i2'], ['i1', 'i3'], [], []]);
    // The optimistic copy is in its new column, so the Move-to menu and the list view agree.
    expect(plan.columns[1].cards[0].status_id).toBe('s-doing');
  });

  it('reorders within a column', () => {
    const plan = planMove(makeBoard().columns, 'i1', 's-todo', 2)!;
    expect(plan.move).toEqual({ status_id: 's-todo', after_id: 'i2', before_id: null });
    expect(ids(plan.columns)[0]).toEqual(['i2', 'i1']);
  });

  it('plans nothing for a drop where the card already sits', () => {
    const { columns } = makeBoard();
    // Both gaps either side of `i1` are "where it already is".
    expect(planMove(columns, 'i1', 's-todo', 0)).toBeNull();
    expect(planMove(columns, 'i1', 's-todo', 1)).toBeNull();
  });

  it('plans nothing for a card or a column that is not on the board', () => {
    const { columns } = makeBoard();
    expect(planMove(columns, 'nope', 's-todo', 0)).toBeNull();
    expect(planMove(columns, 'i1', 's-nope', 0)).toBeNull();
  });

  it('leaves the columns the move does not touch as they were', () => {
    const { columns } = makeBoard();
    const plan = planMove(columns, 'i1', 's-done', 0)!;
    expect(plan.columns[1]).toBe(columns[1]);
    expect(plan.columns[2]).toBe(columns[2]);
  });
});

describe('replaceCard', () => {
  it('swaps in the server copy wherever the card sits, and leaves other columns alone', () => {
    const { columns } = makeBoard();
    const next = replaceCard(columns, makeIssueCard({ id: 'i3', status_id: 's-doing', rank: 'z9', version: 2 }));
    expect(next[1].cards[0]).toMatchObject({ rank: 'z9', version: 2 });
    expect(next[0]).toBe(columns[0]);
  });
});
