import { parseServerDate } from './datetime';

/*
 * Work-item age: how long an issue has been in its current stage, from the API's
 * `status_entered_at`. What a Kanban team inspects daily, and what makes ageing work visible
 * on a card without opening it (restructuring plan, "Kanban policy").
 */

const DAY = 86_400;
const HOUR = 3_600;

/** Whole seconds in the stage at `nowSeconds`, or null when the API has no entry time. Never negative. */
export function secondsInStage(enteredAt: string | null | undefined, nowSeconds: number): number | null {
  if (!enteredAt) return null;
  const entered = parseServerDate(enteredAt);
  if (Number.isNaN(entered.getTime())) return null;
  return Math.max(0, nowSeconds - Math.floor(entered.getTime() / 1000));
}

/** `3d`, `5h`, `<1h` — short enough for a card. */
export function formatAge(seconds: number): string {
  if (seconds >= DAY) return `${Math.floor(seconds / DAY)}d`;
  if (seconds >= HOUR) return `${Math.floor(seconds / HOUR)}h`;
  return '<1h';
}

/** Whole days in the stage, for thresholds such as "ageing after 3 days". */
export const daysInStage = (seconds: number): number => Math.floor(seconds / DAY);
