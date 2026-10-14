import { Link } from 'react-router-dom';
import { ExternalLink, Square, Timer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { discardTimer, elapsedAt, stopTimer, timerFailure } from '@/features/time/timerSlice';
import { formatClock, formatDuration } from '@/lib/duration';
import { useNowSeconds } from '@/lib/useNow';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/*
 * The header's running-timer button and its menu: Stop, Open issue, Discard. Loaded only
 * while a timer runs (see TimerIndicator.tsx) — its icons, the ticking clock and the menu's
 * handlers stay out of the initial chunk, which every visit downloads.
 */

/** Re-renders once a second — only this leaf, never the header around it. */
const Elapsed = () => {
  const now = useNowSeconds();
  const state = useAppSelector((s) => s.timer);
  return (
    // `timer` has an implicit aria-live of "off", so a screen reader is not read the time
    // every second; the menu's label says what is running.
    <span role="timer" className="font-mono text-sm tabular-nums">
      {formatClock(elapsedAt(state, now))}
    </span>
  );
};

const RunningTimerMenu = () => {
  const dispatch = useAppDispatch();
  const timer = useAppSelector((s) => s.timer.timer);
  if (!timer) return null;
  const { issue } = timer;

  const stop = async () => {
    try {
      const { entry, capped } = await dispatch(stopTimer()).unwrap();
      if (!entry) toast.info('The timer was discarded: its issue is gone, or no longer yours to log on.');
      else if (capped) toast.warning(`Logged one day on ${issue.key}, the most one entry holds. Edit it to the real figure.`);
      else toast.success(`Logged ${formatDuration(entry.duration_seconds)} on ${issue.key}.`);
    } catch (err) {
      toast.error(timerFailure(err, 'The timer could not be stopped. Try again.'));
    }
  };

  const discard = async () => {
    try {
      await dispatch(discardTimer()).unwrap();
      toast.info(`Timer on ${issue.key} discarded. Nothing was logged.`);
    } catch (err) {
      toast.error(timerFailure(err, 'The timer could not be discarded. Try again.'));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label={`Timer running on ${issue.key}`}>
          <Timer className="size-4 text-primary" aria-hidden="true" />
          <Elapsed />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col font-normal">
          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
          <span className="truncate font-medium">{issue.title}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void stop()}>
          <Square className="size-4" aria-hidden="true" />
          Stop and log time
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to={`/projects/${encodeURIComponent(issue.workspace_id)}/lists/${encodeURIComponent(issue.list_id)}?issue=${encodeURIComponent(issue.id)}`}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open issue
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void discard()}>
          <Trash2 className="size-4" aria-hidden="true" />
          Discard timer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RunningTimerMenu;
