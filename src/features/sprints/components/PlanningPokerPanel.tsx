import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Users,
  Eye,
  Check,
  CheckCircle2,
  Clock,
  RotateCcw,
  Coffee,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { pokerApi } from '../../../api/poker';
import type { IssueCard, PokerSessionState, PokerVoteRequest } from '../../../types';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { cn } from '../../../lib/utils';

interface PlanningPokerPanelProps {
  workspaceId: string;
  sprintId: string;
  sprintIssues: IssueCard[];
  canManage: boolean;
  onStoryPointsAssigned?: () => void;
}

const FIBONACCI_CARDS = [0, 1, 2, 3, 5, 8, 13, 21];

export const PlanningPokerPanel: React.FC<PlanningPokerPanelProps> = ({
  workspaceId,
  sprintId,
  sprintIssues,
  canManage,
  onStoryPointsAssigned,
}) => {
  const [session, setSession] = useState<PokerSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [consensusInput, setConsensusInput] = useState<number>(0);

  const loadState = useCallback(async () => {
    try {
      const res = await pokerApi.getState(workspaceId, sprintId);
      setSession(res.data);
      if (res.data.median !== null && res.data.median !== undefined) {
        setConsensusInput(Math.round(res.data.median));
      } else if (res.data.average !== null && res.data.average !== undefined) {
        setConsensusInput(Math.round(res.data.average));
      }
    } catch {
      // 404 means no poker session started yet
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, sprintId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Pre-select first unestimated issue if none selected
  useEffect(() => {
    if (!selectedIssueId && sprintIssues.length > 0) {
      const unestimated = sprintIssues.find((i) => i.story_points === null || i.story_points === undefined);
      setSelectedIssueId(unestimated ? unestimated.id : sprintIssues[0].id);
    }
  }, [sprintIssues, selectedIssueId]);

  const handleStartSession = async (issueIdToStart: string) => {
    if (!issueIdToStart) {
      toast.error('Select an issue to estimate.');
      return;
    }
    setActionBusy(true);
    try {
      const res = await pokerApi.startSession(workspaceId, sprintId, issueIdToStart);
      setSession(res.data);
      toast.success('Planning poker round started.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start session');
    } finally {
      setActionBusy(false);
    }
  };

  const handleVote = async (vote: PokerVoteRequest) => {
    setActionBusy(true);
    try {
      const res = await pokerApi.submitVote(workspaceId, sprintId, vote);
      setSession(res.data);
      toast.success('Your estimate has been recorded.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit vote');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReveal = async () => {
    setActionBusy(true);
    try {
      const res = await pokerApi.revealVotes(workspaceId, sprintId);
      setSession(res.data);
      if (res.data.median !== null && res.data.median !== undefined) {
        setConsensusInput(Math.round(res.data.median));
      } else if (res.data.average !== null && res.data.average !== undefined) {
        setConsensusInput(Math.round(res.data.average));
      }
      toast.success('Votes revealed!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reveal votes');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAccept = async () => {
    if (consensusInput < 0) {
      toast.error('Points must be 0 or greater');
      return;
    }
    setActionBusy(true);
    try {
      const res = await pokerApi.acceptConsensus(workspaceId, sprintId, consensusInput);
      setSession(res.data);
      toast.success(`Consensus points (${consensusInput} pts) assigned!`);
      onStoryPointsAssigned?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept consensus');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">Loading Planning Poker…</span>
      </div>
    );
  }

  // 1. Idle state / No active session
  if (!session || session.status === 'completed') {
    return (
      <div className="space-y-4 pt-3 border-t">
        {session?.status === 'completed' && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>
                Last round completed for{' '}
                <strong>{session.active_issue_key || 'issue'}</strong>.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (session.active_issue_id) handleStartSession(session.active_issue_id);
              }}
              className="h-7 text-xs gap-1 border-emerald-300 dark:border-emerald-700"
            >
              <RotateCcw className="h-3 w-3" /> Re-estimate
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-dashed p-6 text-center space-y-4 bg-muted/10">
          <div className="size-10 mx-auto rounded-full bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Interactive Sprint Planning Poker</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Vote anonymously with the Fibonacci card deck to reach unanchored team consensus on issue story points.
            </p>
          </div>

          {canManage && sprintIssues.length > 0 ? (
            <div className="max-w-md mx-auto space-y-3 pt-2">
              <div className="text-left space-y-1.5">
                <Label className="text-xs">Select Issue to Estimate:</Label>
                <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Choose an issue…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sprintIssues.map((issue) => (
                      <SelectItem key={issue.id} value={issue.id} className="text-xs">
                        <span className="font-mono font-semibold mr-1.5">{issue.key}</span>
                        <span>{issue.title}</span>
                        {issue.story_points !== null && (
                          <span className="text-muted-foreground ml-1">({issue.story_points} pts)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                className="w-full text-xs font-semibold"
                disabled={actionBusy || !selectedIssueId}
                onClick={() => handleStartSession(selectedIssueId)}
              >
                {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Start Estimation Round
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {sprintIssues.length === 0
                ? 'Add issues to this sprint first to start planning poker.'
                : 'A project moderator can start an estimation round.'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Find caller's vote
  const myVote = session.voters.find((v) => v.point_vote !== null || v.special_vote !== null);
  const myPointChoice = myVote?.point_vote;
  const mySpecialChoice = myVote?.special_vote;

  const isVoting = session.status === 'voting';
  const isRevealed = session.status === 'revealed';

  return (
    <div className="space-y-4 pt-3 border-t">
      {/* Active Issue Header */}
      <div className="p-3 bg-card border rounded-lg flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded">
              {session.active_issue_key || 'ACTIVE'}
            </span>
            <Badge
              variant={isVoting ? 'default' : 'secondary'}
              className="text-[10px] font-sans font-medium capitalize"
            >
              {isVoting ? 'Voting Round' : 'Votes Revealed'}
            </Badge>
          </div>
          <p className="text-xs font-medium text-foreground truncate" title={session.active_issue_title || ''}>
            {session.active_issue_title || 'Issue estimation round'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isVoting && canManage && (
            <Button
              size="sm"
              variant="default"
              onClick={handleReveal}
              disabled={actionBusy}
              className="h-7 text-xs gap-1"
            >
              <Eye className="h-3.5 w-3.5" /> Reveal Cards
            </Button>
          )}

          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (session.active_issue_id) handleStartSession(session.active_issue_id);
              }}
              disabled={actionBusy}
              className="h-7 text-xs text-muted-foreground"
              title="Restart estimation round"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Re-vote
            </Button>
          )}
        </div>
      </div>

      {/* Fibonacci Voting Deck (Enabled during voting) */}
      {isVoting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Your Card Deck:</span>
            <span>
              {myPointChoice !== null && myPointChoice !== undefined
                ? `Selected: ${myPointChoice} pts`
                : mySpecialChoice
                  ? `Selected: ${mySpecialChoice}`
                  : 'Pick your estimate (hidden until reveal)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FIBONACCI_CARDS.map((pt) => {
              const isSelected = myPointChoice === pt;
              return (
                <button
                  key={pt}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleVote({ point_vote: pt })}
                  className={cn(
                    'h-12 w-9 sm:h-14 sm:w-10 rounded-lg border-2 font-mono font-bold text-sm flex flex-col items-center justify-center transition-all shadow-xs cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground scale-105 shadow-md'
                      : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50'
                  )}
                  aria-label={`Vote ${pt} points`}
                >
                  <span>{pt}</span>
                  <span className="text-[8px] font-sans font-normal opacity-70">pts</span>
                </button>
              );
            })}

            {/* Special Cards */}
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => handleVote({ special_vote: '?' })}
              className={cn(
                'h-12 w-9 sm:h-14 sm:w-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center transition-all shadow-xs cursor-pointer',
                mySpecialChoice === '?'
                  ? 'border-primary bg-primary text-primary-foreground scale-105'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              )}
              title="Unsure / Need more clarity"
              aria-label="Vote Unsure"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={actionBusy}
              onClick={() => handleVote({ special_vote: 'coffee' })}
              className={cn(
                'h-12 w-9 sm:h-14 sm:w-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center transition-all shadow-xs cursor-pointer',
                mySpecialChoice === 'coffee'
                  ? 'border-primary bg-primary text-primary-foreground scale-105'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              )}
              title="Need a coffee break"
              aria-label="Vote Coffee break"
            >
              <Coffee className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Voters Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Team Participation ({session.voted_count} / {session.total_voters})
          </span>
          {isVoting && <span className="text-[11px] font-normal text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Cards face down</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {session.voters.map((voter) => {
            const isLowest = isRevealed && voter.point_vote !== null && voter.point_vote === session.lowest_vote && session.lowest_vote !== session.highest_vote;
            const isHighest = isRevealed && voter.point_vote !== null && voter.point_vote === session.highest_vote && session.lowest_vote !== session.highest_vote;

            return (
              <div
                key={voter.user_id}
                className={cn(
                  'rounded-lg border p-2 flex items-center justify-between gap-2 transition-all bg-card shadow-2xs',
                  voter.has_voted && isVoting && 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20',
                  isLowest && 'ring-1 ring-amber-400 bg-amber-50/20 dark:bg-amber-950/20',
                  isHighest && 'ring-1 ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {voter.name || voter.user_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {voter.has_voted ? 'Voted' : 'Thinking…'}
                  </p>
                </div>

                {/* Card Display */}
                {isVoting ? (
                  <div
                    className={cn(
                      'size-7 rounded flex items-center justify-center font-mono text-xs font-bold border transition-colors',
                      voter.has_voted
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-muted text-muted-foreground border-border'
                    )}
                    title={voter.has_voted ? 'Card played (facedown)' : 'Awaiting vote'}
                  >
                    {voter.has_voted ? <Check className="h-3.5 w-3.5" /> : '?'}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'size-7 rounded flex items-center justify-center font-mono text-xs font-bold border',
                      voter.point_vote !== null && voter.point_vote !== undefined
                        ? 'bg-primary text-primary-foreground border-primary'
                        : voter.special_vote
                          ? 'bg-muted text-foreground border-border'
                          : 'bg-muted/40 text-muted-foreground border-dashed border-border'
                    )}
                  >
                    {voter.point_vote !== null && voter.point_vote !== undefined
                      ? voter.point_vote
                      : voter.special_vote === 'coffee'
                        ? <Coffee className="h-3 w-3" />
                        : voter.special_vote || '-'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Revealed Consensus Bar & Statistics */}
      {isRevealed && (
        <div className="space-y-3 p-3.5 bg-muted/30 border rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Estimation Analysis
              </span>
              <p className="text-[11px] text-muted-foreground">
                Review distribution and agree on final story points.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-center">
                <span className="text-[10px] uppercase font-sans text-muted-foreground block">Average</span>
                <span className="font-bold text-foreground text-sm">{session.average !== null ? session.average : '-'}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-sans text-muted-foreground block">Median</span>
                <span className="font-bold text-foreground text-sm">{session.median !== null ? session.median : '-'}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-sans text-muted-foreground block">Spread</span>
                <span className="font-bold text-foreground text-sm">
                  {session.lowest_vote !== null && session.highest_vote !== null
                    ? `${session.lowest_vote} – ${session.highest_vote}`
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Outlier Alert if spread > 3 */}
          {session.lowest_vote != null && session.highest_vote != null && session.highest_vote - session.lowest_vote >= 3 && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                High estimation divergence detected (min {session.lowest_vote} vs max {session.highest_vote}). Ask highest and lowest voters to share perspectives before committing.
              </span>
            </div>
          )}

          {/* Consensus Acceptance Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="consensus-points" className="text-xs font-semibold shrink-0">
                Consensus Points:
              </Label>
              <div className="w-24">
                <input
                  id="consensus-points"
                  type="number"
                  min="0"
                  max="100"
                  value={consensusInput}
                  onChange={(e) => setConsensusInput(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs font-mono font-bold rounded border bg-background text-foreground"
                />
              </div>
            </div>

            {canManage && (
              <Button
                size="sm"
                variant="default"
                disabled={actionBusy}
                onClick={handleAccept}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Accept Consensus ({consensusInput} pts)
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
