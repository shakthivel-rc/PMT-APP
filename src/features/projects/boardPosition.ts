import type { BoardColumn, IssueCard, IssueMove } from '@/types';

/**
 * Where a dropped card lands, as the API wants to hear it: by its neighbours.
 *
 * The board never computes a rank. Ranks are opaque strings the server derives from the two
 * cards either side of the drop, which is why a move names those cards rather than a number:
 * an index would be stale the moment anyone else moved a card in the same column.
 *
 * Kept free of React and the DOM so the one piece of arithmetic a board gets wrong — the
 * off-by-one when a card moves down its own column — is tested on its own.
 */

export interface Neighbours {
  /** The card directly ABOVE the landing spot, or null at the top. */
  after_id: string | null;
  /** The card directly BELOW the landing spot, or null at the bottom. */
  before_id: string | null;
}

/**
 * The landing index among the column's cards once the dragged one is taken out.
 *
 * `dropIndex` is measured against the column *as drawn* — the gap before `cards[dropIndex]`,
 * or `cards.length` for the bottom — and the drawn column still contains the dragged card
 * when the drag stays within it. Every gap below that card therefore shifts up by one once
 * it is lifted out; forgetting that is the classic "moves one further than dropped" bug.
 */
function landingIndex(cards: readonly Pick<IssueCard, 'id'>[], draggedId: string, dropIndex: number): number {
  const from = cards.findIndex((card) => card.id === draggedId);
  const index = from !== -1 && from < dropIndex ? dropIndex - 1 : dropIndex;
  const remaining = from === -1 ? cards.length : cards.length - 1;
  return Math.max(0, Math.min(index, remaining));
}

/** The cards either side of a drop into `cards` at `dropIndex`. */
export function neighboursAt(
  cards: readonly Pick<IssueCard, 'id'>[],
  draggedId: string,
  dropIndex: number,
): Neighbours {
  const rest = cards.filter((card) => card.id !== draggedId);
  const index = landingIndex(cards, draggedId, dropIndex);
  return { after_id: rest[index - 1]?.id ?? null, before_id: rest[index]?.id ?? null };
}

export interface PlannedMove {
  /** The board with the card already in its new place — the optimistic state. */
  columns: BoardColumn[];
  /** The body for `POST …/issues/{id}/move`. */
  move: IssueMove;
}

/**
 * Apply a drop locally and say what to tell the server.
 *
 * Null when the drop changes nothing — a card let go where it already sat, or an id or
 * column that is not on this board — so the caller sends no request and has nothing to roll
 * back. Columns the move does not touch keep their identity.
 */
export function planMove(
  columns: readonly BoardColumn[],
  cardId: string,
  toStatusId: string,
  dropIndex: number,
): PlannedMove | null {
  const source = columns.find((column) => column.cards.some((card) => card.id === cardId));
  const target = columns.find((column) => column.status.id === toStatusId);
  if (!source || !target) return null;

  const from = source.cards.findIndex((card) => card.id === cardId);
  const index = landingIndex(target.cards, cardId, dropIndex);
  if (source === target && index === from) return null;

  const moved = { ...source.cards[from], status_id: toStatusId };
  return {
    move: { status_id: toStatusId, ...neighboursAt(target.cards, cardId, dropIndex) },
    columns: columns.map((column) => {
      if (column !== source && column !== target) return column;
      const rest = column.cards.filter((card) => card.id !== cardId);
      if (column !== target) return { ...column, cards: rest };
      return { ...column, cards: [...rest.slice(0, index), moved, ...rest.slice(index)] };
    }),
  };
}

/** Swap in the server's copy of a card — its new rank and version — wherever it sits. */
export function replaceCard(columns: readonly BoardColumn[], next: IssueCard): BoardColumn[] {
  return columns.map((column) =>
    column.cards.some((card) => card.id === next.id)
      ? { ...column, cards: column.cards.map((card) => (card.id === next.id ? next : card)) }
      : column,
  );
}

/**
 * Merge a few changed fields into one card wherever it sits — the drawer's report that time
 * was logged or the estimate changed. Unlike `replaceCard` it needs no whole card, because
 * the drawer only knows what it changed.
 */
export function patchCard(
  columns: readonly BoardColumn[],
  cardId: string,
  patch: Partial<IssueCard>,
): BoardColumn[] {
  return columns.map((column) =>
    column.cards.some((card) => card.id === cardId)
      ? { ...column, cards: column.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)) }
      : column,
  );
}
