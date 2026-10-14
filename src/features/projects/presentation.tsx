import { Bookmark, Bug, CheckSquare, Zap } from 'lucide-react';
import { ApiError } from '@/api/client';
import { StatusBadge, type Tone } from '@/components/StatusBadge';
import { formatDuration } from '@/lib/duration';

/*
 * The small vocabulary the board, the list view and the drawer share, so an issue's
 * priority, type, or PR state reads the same wherever it is drawn.
 */

/** Visual badge for issue types (bug, story, task, epic) with distinctive color and icon. */
export const IssueTypeBadge = ({ type }: { type: string }) => {
  const t = type.toLowerCase();
  switch (t) {
    case 'bug':
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap">
          <Bug className="size-3 shrink-0" aria-hidden="true" />
          <span>Bug</span>
        </span>
      );
    case 'story':
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
          <Bookmark className="size-3 shrink-0" aria-hidden="true" />
          <span>Story</span>
        </span>
      );
    case 'task':
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
          <CheckSquare className="size-3 shrink-0" aria-hidden="true" />
          <span>Task</span>
        </span>
      );
    case 'epic':
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 whitespace-nowrap">
          <Zap className="size-3 shrink-0" aria-hidden="true" />
          <span>Epic</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
          <span>{humanize(type)}</span>
        </span>
      );
  }
};

/*
 * Every lookup falls back rather than assuming the API's enums are closed: the server types
 * them as plain strings, and a value added there should render as itself, not as nothing.
 */

/** The API's lower-case enums, for display: `in_progress` → `In progress`. */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** What to show for a failure. `ApiError` messages come from the API and are written to be shown. */
export const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError && err.data && typeof err.data === 'object' && 'errors' in err.data) {
    const rawErrors = (err.data as { errors?: Array<{ loc?: string[]; msg?: string; issue?: string; field?: string }> }).errors;
    if (Array.isArray(rawErrors) && rawErrors.length > 0) {
      const messages = rawErrors.map((e) => {
        const field = e.field || (e.loc && e.loc.length > 0 ? e.loc[e.loc.length - 1] : undefined);
        const msg = e.issue || e.msg || 'Invalid value';
        const cleanMsg = msg.replace(/^Value error,\s*/i, '');
        return field && field !== 'body' ? `${humanize(field)}: ${cleanMsg}` : cleanMsg;
      });
      return messages.join('. ');
    }
  }
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.';
};

/**
 * A workspace route's 404. The API answers it for "does not exist" and "not a member" alike,
 * so the copy must not claim to know which.
 */
export const isNotFound = (err: unknown): boolean => err instanceof ApiError && err.status === 404;

const PRIORITY_TONE: Record<string, Tone> = { urgent: 'danger', high: 'warning', medium: 'info' };

/** Nothing for `none`: an unprioritised card is the norm, and a badge on every one is noise. */
export const PriorityBadge = ({ priority }: { priority: string }) =>
  priority === 'none' ? null : (
    <StatusBadge tone={PRIORITY_TONE[priority] ?? 'neutral'}>{humanize(priority)}</StatusBadge>
  );

const PR_TONE: Record<string, Tone> = { merged: 'success', open: 'info' };

export const PullRequestBadge = ({ state }: { state: string | null }) =>
  state ? (
    <StatusBadge tone={PR_TONE[state] ?? 'neutral'}>PR {state}</StatusBadge>
  ) : null;

/**
 * Time logged on a card, against its estimate when there is one: `3h 20m / 5h`, red once over.
 * Nothing on a card with neither — most cards, and a badge on each would be noise. The words
 * a screen reader hears say which number is which; the slash does not.
 */
export const TimeBadge = ({ spent, estimate }: { spent: number; estimate: number | null }) => {
  if (spent === 0 && estimate === null) return null;
  const over = estimate !== null && spent > estimate;
  return (
    <StatusBadge tone={over ? 'danger' : 'neutral'}>
      <span aria-hidden="true">
        {estimate === null ? formatDuration(spent) : `${formatDuration(spent)} / ${formatDuration(estimate)}`}
      </span>
      <span className="sr-only">
        {formatDuration(spent)} logged{estimate === null ? '' : ` of ${formatDuration(estimate)} estimated`}
        {over ? ', over the estimate' : ''}
      </span>
    </StatusBadge>
  );
};

const STAGE_TONES = new Set<string>(['neutral', 'info', 'primary', 'success', 'warning', 'danger']);

/** A stage's colour as a badge tone; anything the API adds later reads as neutral rather than as nothing. */
export const stageTone = (color: string | null | undefined): Tone =>
  color && STAGE_TONES.has(color) ? (color as Tone) : 'neutral';

/**
 * A stage, drawn with its colour AND its name — colour is never the only signal. A canceled
 * stage says so in words for a screen reader, because "Won't do" and "Done" can share a tone.
 */
export const StageBadge = ({ stage }: { stage: { name: string; color: string; category: string } }) => (
  <StatusBadge tone={stageTone(stage.color)}>
    {stage.name}
    {stage.category === 'canceled' && <span className="sr-only"> (canceled)</span>}
  </StatusBadge>
);

/** Blocked work stays in its stage; this makes it visible. The reason is the tooltip and the accessible name. */
export const BlockedBadge = ({ reason }: { reason: string | null }) => (
  <StatusBadge tone="danger">
    <span title={reason ?? undefined}>Blocked</span>
    {reason && <span className="sr-only">: {reason}</span>}
  </StatusBadge>
);
