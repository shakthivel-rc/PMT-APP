import { Fragment, useEffect, useRef, useState, useTransition, type DragEvent, type FormEvent } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { BoardColumn, IssueCard, StatusSummary } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { errorMessage, humanize, IssueTypeBadge, PriorityBadge, PullRequestBadge, TimeBadge } from '../presentation';

interface BoardViewProps {
  columns: BoardColumn[];
  /** False for guests: no dragging, no Move-to menu, no quick-add. */
  canWrite: boolean;
  /** `dropIndex` is a gap in the destination column as drawn; see `boardPosition.ts`. */
  onMove: (cardId: string, statusId: string, dropIndex: number) => void;
  /** Rejects on failure, so the quick-add input can keep what was typed. */
  onAdd: (statusId: string, title: string) => Promise<unknown>;
  onOpen: (issueId: string) => void;
}

/**
 * The gap a pointer at `y` is over: before the first card whose vertical midpoint is below
 * it, or after the last. Measured against the cards as drawn — the dragged one included —
 * which is the frame `neighboursAt` expects.
 */
function gapAt(list: HTMLElement, y: number): number {
  const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-card-id]'));
  const index = cards.findIndex((card) => {
    const box = card.getBoundingClientRect();
    return y < box.top + box.height / 2;
  });
  return index === -1 ? cards.length : index;
}

/** A thin bar where a dragged card would land. Decorative: the drop itself is the signal. */
const DropMarker = () => <li aria-hidden="true" className="h-0.5 shrink-0 rounded-full bg-primary" />;

const QuickAdd = ({ status, onAdd }: { status: StatusSummary; onAdd: BoardViewProps['onAdd'] }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mx-2 mb-2 justify-start text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5 mr-1 text-primary" aria-hidden="true" />
        Add issue
      </Button>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = title.trim();
    if (!text || isPending) return;
    startTransition(async () => {
      try {
        await onAdd(status.id, text);
        // Stays open for the next one: quick-add is usually several titles in a row.
        setTitle('');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="px-2 pb-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        // `readOnly`, not `disabled`: a disabled input drops focus, and the next title
        // could not be typed straight after Enter.
        readOnly={isPending}
        aria-busy={isPending || undefined}
        aria-label={`New issue title in ${status.name}`}
        placeholder="Issue title, then Enter"
        maxLength={500}
        className="bg-card"
      />
    </form>
  );
};

interface CardProps {
  card: IssueCard;
  statuses: StatusSummary[];
  canWrite: boolean;
  dragging: boolean;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onMoveTo: (card: IssueCard, status: StatusSummary) => void;
  onOpen: (issueId: string) => void;
}

const IssueCardItem = ({ card, statuses, canWrite, dragging, onDragStart, onDragEnd, onMoveTo, onOpen }: CardProps) => (
  <li
    data-card-id={card.id}
    draggable={canWrite}
    onDragStart={(e) => {
      // Firefox starts no drag without data. The key is what lands if the card is dropped
      // into another application, which is the useful thing for it to be.
      e.dataTransfer.setData('text/plain', card.key);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(card.id);
    }}
    onDragEnd={onDragEnd}
    className={cn(
      'group rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-all duration-150 hover:shadow-md hover:border-foreground/20',
      canWrite && 'cursor-grab active:cursor-grabbing',
      dragging && 'opacity-50 scale-[0.98]',
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">{card.key}</span>
      {canWrite && (
        // Drag and drop is pointer-only, so this menu is the keyboard (and switch, and
        // screen-reader) route to the same move. It sends the card to the bottom of the
        // chosen column — the one position that needs no second decision.
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-move-trigger variant="ghost" size="icon-xs" aria-label={`Move ${card.key} to…`}>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to…</DropdownMenuLabel>
            {statuses
              .filter((status) => status.id !== card.status_id)
              .map((status) => (
                <DropdownMenuItem key={status.id} onSelect={() => onMoveTo(card, status)}>
                  {status.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className="mt-1.5 block w-full rounded-sm text-left text-sm font-medium break-words hover:text-primary hover:underline transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {card.title}
    </button>
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <IssueTypeBadge type={card.type} />
      <PriorityBadge priority={card.priority} />
      {card.story_points !== null && <StatusBadge tone="info">{card.story_points} pts</StatusBadge>}
      <TimeBadge spent={card.time_spent_seconds} estimate={card.time_estimate_seconds} />
      <PullRequestBadge state={card.pull_request_state} />
      {card.assignee && (
        <span className="ml-auto" title={card.assignee.display_name}>
          <span aria-hidden="true">
            <UserAvatar name={card.assignee.display_name} className="size-6 text-[10px]" />
          </span>
          <span className="sr-only">Assigned to {card.assignee.display_name}</span>
        </span>
      )}
    </div>
  </li>
);

const categoryColors = (category: string) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('done')) {
    return {
      border: 'border-t-2 border-t-emerald-500',
      dot: 'bg-emerald-500',
    };
  }
  if (cat.includes('review')) {
    return {
      border: 'border-t-2 border-t-violet-500',
      dot: 'bg-violet-500',
    };
  }
  if (cat.includes('progress')) {
    return {
      border: 'border-t-2 border-t-amber-500',
      dot: 'bg-amber-500',
    };
  }
  if (cat.includes('cancel')) {
    return {
      border: 'border-t-2 border-t-rose-500',
      dot: 'bg-rose-500',
    };
  }
  return {
    border: 'border-t-2 border-t-sky-500',
    dot: 'bg-sky-500',
  };
};

/**
 * One column per status, left to right, with native HTML5 drag and drop between and within
 * them. No drag library: the platform's events are enough for a list of cards, and every
 * library would be a new dependency in the bundle.
 */
const BoardView = ({ columns, canWrite, onMove, onAdd, onOpen }: BoardViewProps) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const [marker, setMarker] = useState<{ statusId: string; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const refocus = useRef<string | null>(null);
  const statuses = columns.map((column) => column.status);

  // A card moved from the menu is re-created in its new column, so the menu's trigger — where
  // focus would return — no longer exists and focus would fall to <body>. Put it on the same
  // card's trigger in its new place instead.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    Array.from(document.querySelectorAll<HTMLElement>('[data-card-id]'))
      .find((el) => el.dataset.cardId === id)
      ?.querySelector<HTMLElement>('[data-move-trigger]')
      ?.focus();
  }, [columns]);

  const endDrag = () => {
    setDragging(null);
    setMarker(null);
  };

  const moveTo = (card: IssueCard, status: StatusSummary) => {
    const target = columns.find((column) => column.status.id === status.id);
    refocus.current = card.id;
    setAnnouncement(`${card.key} moved to ${status.name}.`);
    onMove(card.id, status.id, target?.cards.length ?? 0);
  };

  // Only a card from this board is a valid drop. Without the check a file or a text selection
  // dragged in from elsewhere would show the marker and then be dropped into nothing.
  const dragOver = (statusId: string) => (e: DragEvent<HTMLOListElement>) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const index = gapAt(e.currentTarget, e.clientY);
    if (marker?.statusId !== statusId || marker.index !== index) setMarker({ statusId, index });
  };

  const drop = (statusId: string) => (e: DragEvent<HTMLOListElement>) => {
    e.preventDefault();
    if (dragging) onMove(dragging, statusId, gapAt(e.currentTarget, e.clientY));
    endDrag();
  };

  return (
    <div className="flex min-h-0 flex-1 w-full gap-4 overflow-x-auto pb-2">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {columns.map(({ status, cards }) => {
        const markerAt = marker?.statusId === status.id ? marker.index : -1;
        const colors = categoryColors(status.category);
        return (
          <section
            key={status.id}
            aria-labelledby={`column-${status.id}`}
            className={cn(
              'flex max-h-full min-w-[280px] flex-1 shrink-0 flex-col rounded-xl border bg-muted/40 shadow-2xs transition-all duration-200',
              colors.border,
            )}
          >
            <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('size-2 rounded-full shrink-0', colors.dot)} aria-hidden="true" />
                <h3 id={`column-${status.id}`} className="truncate text-sm font-semibold">
                  {status.name}
                </h3>
              </div>
              {/* The category is what automations and reports go by; shown quietly, since
                  the column name already says what a person needs. */}
              <span className="shrink-0 text-xs text-muted-foreground">
                {humanize(status.category)} · {cards.length}
              </span>
            </header>
            <ol
              aria-labelledby={`column-${status.id}`}
              onDragOver={dragOver(status.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMarker(null);
              }}
              onDrop={drop(status.id)}
              className={cn(
                'flex min-h-20 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-2',
                markerAt !== -1 && 'bg-accent/40',
              )}
            >
              {cards.map((card, index) => (
                <Fragment key={card.id}>
                  {markerAt === index && <DropMarker />}
                  <IssueCardItem
                    card={card}
                    statuses={statuses}
                    canWrite={canWrite}
                    dragging={dragging === card.id}
                    onDragStart={setDragging}
                    onDragEnd={endDrag}
                    onMoveTo={moveTo}
                    onOpen={onOpen}
                  />
                </Fragment>
              ))}
              {markerAt === cards.length && <DropMarker />}
            </ol>
            {canWrite && <QuickAdd status={status} onAdd={onAdd} />}
          </section>
        );
      })}
    </div>
  );
};

export default BoardView;
