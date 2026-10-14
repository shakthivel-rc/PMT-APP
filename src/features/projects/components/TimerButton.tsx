import { useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { elapsedAt, startTimer, stopTimer, timerFailure } from '@/features/time/timerSlice';
import { formatClock, formatDuration } from '@/lib/duration';
import { useNowSeconds } from '@/lib/useNow';
import { Button } from '@/components/ui/button';

const Clock = () => {
  const now = useNowSeconds();
  const state = useAppSelector((s) => s.timer);
  return <span className="font-mono tabular-nums">{formatClock(elapsedAt(state, now))}</span>;
};

interface TimerButtonProps {
  workspaceId: string;
  issueId: string;
  issueKey: string;
}

/**
 * Start or stop *the* timer on this issue. There is one timer per person, so starting here
 * while it runs on another issue stops and saves that one first — the API does it in one
 * transaction and says what it saved, which is passed on rather than silently swallowed.
 */
const TimerButton = ({ workspaceId, issueId, issueKey }: TimerButtonProps) => {
  const dispatch = useAppDispatch();
  const timer = useAppSelector((s) => s.timer.timer);
  const [busy, setBusy] = useState(false);
  const runningHere = timer?.issue.id === issueId;

  const toggle = async () => {
    setBusy(true);
    try {
      if (runningHere) {
        const { entry } = await dispatch(stopTimer()).unwrap();
        if (entry) toast.success(`Logged ${formatDuration(entry.duration_seconds)} on ${issueKey}.`);
      } else {
        const { result } = await dispatch(startTimer({ workspaceId, issueId })).unwrap();
        const saved = result.stopped_entry;
        if (saved) {
          toast.success(`Saved ${formatDuration(saved.duration_seconds)} on ${saved.issue.key}; the timer moved to ${issueKey}.`);
        }
      }
    } catch (err) {
      toast.error(timerFailure(err, 'The timer could not be changed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={runningHere ? 'default' : 'outline'}
      onClick={() => void toggle()}
      disabled={busy}
      aria-label={runningHere ? `Stop timer on ${issueKey}` : `Start timer on ${issueKey}`}
      className={
        runningHere
          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-medium gap-1.5'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 shadow-2xs font-medium gap-1.5 transition-colors'
      }
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : runningHere ? (
        <Square className="size-4 fill-current" aria-hidden="true" />
      ) : (
        <Play className="size-4 text-emerald-500 fill-emerald-500/30" aria-hidden="true" />
      )}
      {runningHere ? <Clock /> : 'Start timer'}
    </Button>
  );
};

export default TimerButton;
