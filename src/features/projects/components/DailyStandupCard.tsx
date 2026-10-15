import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsApi } from '@/api/aiAgents';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type { DailyStandup } from '@/types';

export interface DailyStandupCardProps {
  workspaceId: string;
}

export const DailyStandupCard = ({ workspaceId }: DailyStandupCardProps) => {
  const [standup, setStandup] = useState<DailyStandup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const loadStandup = async () => {
    setLoading(true);
    try {
      const res = await aiAgentsApi.getDailyStandup(workspaceId);
      setStandup(res.data);
    } catch (err) {
      // Standup optional on initial load
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await aiAgentsApi.generateDailyStandup(workspaceId);
      setStandup(res.data);
      toast.success('Daily standup synthesis refreshed');
    } catch (err) {
      toast.error('Failed to generate daily standup');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleMember = (userId: string) => {
    setExpandedMembers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  useEffect(() => {
    if (workspaceId) {
      void loadStandup();
    }
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card/60 p-4 shadow-2xs mb-6 flex items-center justify-center py-6 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary mr-2" />
        <span>Loading daily standup briefing...</span>
      </div>
    );
  }

  if (!standup) {
    return null;
  }

  const forecast = standup.velocity_forecast;
  const healthTone: 'success' | 'warning' | 'danger' =
    forecast?.health_status === 'healthy'
      ? 'success'
      : forecast?.health_status === 'at_risk'
        ? 'warning'
        : 'danger';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-2xs mb-6 transition-all duration-200">
      {/* Top Header */}
      <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", briefingOpen && "pb-3 border-b")}>
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground break-words">
                Autonomous Daily Standup & Trajectory Forecast
              </h3>
              {forecast && (
                <StatusBadge tone={healthTone}>
                  {forecast.health_status.toUpperCase()} VELOCITY
                </StatusBadge>
              )}
            </div>
            <p className="text-2xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
              <Calendar className="size-3 shrink-0" />
              <span>{standup.standup_date}</span>
              <span>·</span>
              <span>{standup.team_updates.length} active contributors</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            size="xs"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-2xs h-7"
          >
            {refreshing ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="size-3 mr-1" />
            )}
            Refresh Standup
          </Button>

          <Button
            size="xs"
            variant="ghost"
            onClick={() => setBriefingOpen(!briefingOpen)}
            className="text-2xs h-7"
            aria-label={briefingOpen ? 'Minimize standup briefing' : 'Expand standup briefing'}
          >
            {briefingOpen ? 'Minimize' : 'Briefing'}
            {briefingOpen ? (
              <ChevronDown className="size-3 ml-1" />
            ) : (
              <ChevronRight className="size-3 ml-1" />
            )}
          </Button>

          {briefingOpen && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              className="text-2xs h-7"
            >
              {expanded ? 'Collapse Details' : 'View Member Updates'}
              {expanded ? (
                <ChevronDown className="size-3 ml-1" />
              ) : (
                <ChevronRight className="size-3 ml-1" />
              )}
            </Button>
          )}
        </div>
      </div>

      {briefingOpen && (
        <>
          {/* Summary Narrative */}
      <div className="pt-3">
        <p className="text-xs text-muted-foreground leading-relaxed break-words">
          {standup.summary}
        </p>
      </div>

      {/* Sprint Velocity Forecast Metrics */}
      {forecast && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1 min-w-0 overflow-hidden">
            <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">
              Active Sprint
            </span>
            <div className="text-xs font-bold text-foreground truncate">
              {forecast.active_sprint_name || 'Current Sprint'}
            </div>
            <p className="text-3xs text-muted-foreground truncate">
              {forecast.working_days_left} working days remaining
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1 min-w-0 overflow-hidden">
            <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">
              Remaining Points
            </span>
            <div className="text-xs font-bold text-foreground truncate">
              {forecast.remaining_points} pts
            </div>
            <p className="text-3xs text-muted-foreground truncate">
              Required: {forecast.required_rate} pts/day
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1 min-w-0 overflow-hidden">
            <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">
              Burn Rate
            </span>
            <div className="text-xs font-bold text-foreground flex items-center gap-1 truncate">
              <Flame className="size-3 text-amber-500 shrink-0" />
              <span className="truncate">{forecast.current_burn_rate} pts/day</span>
            </div>
            <p className="text-3xs text-muted-foreground truncate">Historical pace</p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1 min-w-0 overflow-hidden">
            <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">
              Carryover Risk
            </span>
            <div className={cn('text-xs font-bold truncate', forecast.carryover_risk ? 'text-danger' : 'text-success')}>
              {forecast.carryover_risk ? `${forecast.projected_carryover_pct}% Risk` : 'Minimal'}
            </div>
            <p className="text-3xs text-muted-foreground truncate">
              {forecast.carryover_risk ? 'Points projected to slip' : 'On track for delivery'}
            </p>
          </div>
        </div>
      )}

      {/* Expanded Team Members Breakdown */}
      {expanded && (
        <div className="pt-4 border-t mt-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team Member Activity Synthesis
          </h4>

          {standup.team_updates.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No individual worklogs recorded in the last 24 hours.
            </p>
          ) : (
            <div className="space-y-2">
              {standup.team_updates.map((update) => {
                const isMemberOpen = expandedMembers[update.user_id] ?? true;
                return (
                  <div
                    key={update.user_id}
                    className="rounded-lg border bg-muted/10 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMember(update.user_id)}
                      className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isMemberOpen ? (
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold text-foreground">
                          {update.user_name}
                        </span>
                        {update.blockers.length > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-3xs font-medium text-danger">
                            <AlertCircle className="size-2.5" />
                            <span>{update.blockers.length} Blocker</span>
                          </span>
                        )}
                      </div>

                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-medium text-primary">
                        {update.hours_logged}h logged
                      </span>
                    </button>

                    {isMemberOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2.5 text-xs border-t bg-background/50">
                        {/* Completed Yesterday */}
                        {update.completed_yesterday.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-3xs font-semibold uppercase tracking-wider text-success flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Completed Yesterday
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-2xs text-muted-foreground">
                              {update.completed_yesterday.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* In Flight Today */}
                        {update.in_flight_today.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-3xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                              <Clock className="size-3" /> In Flight Today
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-2xs text-muted-foreground">
                              {update.in_flight_today.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Blockers */}
                        {update.blockers.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-3xs font-semibold uppercase tracking-wider text-danger flex items-center gap-1">
                              <AlertCircle className="size-3" /> Reported Blockers
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-2xs text-danger">
                              {update.blockers.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
