import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsApi } from '@/api/aiAgents';
import { Button } from '@/components/ui/button';
import type { SprintRetrospective } from '@/types';
import type { SprintSummary } from '@/types/sprints';

export interface SprintRetroPanelProps {
  workspaceId: string;
  sprint: SprintSummary;
  canManage: boolean;
}

export const SprintRetroPanel = ({
  workspaceId,
  sprint,
  canManage,
}: SprintRetroPanelProps) => {
  const [retro, setRetro] = useState<SprintRetrospective | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadRetro = async () => {
    setLoading(true);
    try {
      const res = await aiAgentsApi.getSprintRetrospective(workspaceId, sprint.id);
      setRetro(res.data);
    } catch (err) {
      toast.error('Could not load sprint retrospective');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await aiAgentsApi.generateSprintRetrospective(workspaceId, sprint.id);
      setRetro(res.data);
      toast.success('Retrospective post-mortem regenerated');
    } catch (err) {
      toast.error('Failed to regenerate retrospective');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    void loadRetro();
  }, [workspaceId, sprint.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p>Synthesizing sprint post-mortem intelligence...</p>
      </div>
    );
  }

  if (!retro) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        No retrospective available for this sprint.
      </div>
    );
  }

  const completionPct = retro.metrics.completion_rate_pct ?? 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Executive Summary Card */}
      <div className="rounded-xl border bg-card p-4 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Autonomous Sprint Retrospective
              </h4>
              <p className="text-2xs text-muted-foreground">
                Synthesized at {new Date(retro.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {canManage && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleRegenerate}
              disabled={generating}
              className="text-2xs"
            >
              {generating ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="size-3 mr-1" />
              )}
              Regenerate
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border">
          {retro.summary}
        </p>

        {/* Metrics Overview Bar */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <div className="text-2xs font-medium text-muted-foreground uppercase">
              Completion Rate
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {completionPct}%
            </div>
            <div className="text-3xs text-muted-foreground">
              {retro.metrics.completed_points ?? 0} / {retro.metrics.committed_points ?? 0} pts
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <div className="text-2xs font-medium text-muted-foreground uppercase">
              Scope Creep
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {retro.metrics.scope_creep_count ?? 0}
            </div>
            <div className="text-3xs text-muted-foreground">Added mid-sprint</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <div className="text-2xs font-medium text-muted-foreground uppercase">
              Total Issues
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {retro.metrics.total_issues_count ?? 0}
            </div>
            <div className="text-3xs text-muted-foreground">Managed in sprint</div>
          </div>
        </div>
      </div>

      {/* 3 Pillars Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Wins Column */}
        <div className="rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Award className="size-3.5" />
            <span>Key Wins & Milestones</span>
          </div>
          <ul className="space-y-1.5 text-xs text-foreground/90">
            {retro.wins.map((win, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-2xs leading-snug">{win}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scope Creep Column */}
        <div className="rounded-xl border bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Layers className="size-3.5" />
            <span>Scope Churn & Creep</span>
          </div>
          <ul className="space-y-1.5 text-xs text-foreground/90">
            {retro.scope_creep.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <AlertTriangle className="size-3 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-2xs leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cycle Time Outliers Column */}
        <div className="rounded-xl border bg-sky-50/40 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
            <Clock className="size-3.5" />
            <span>Cycle Time Outliers</span>
          </div>
          <ul className="space-y-1.5 text-xs text-foreground/90">
            {retro.cycle_time_outliers.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <TrendingUp className="size-3 text-sky-500 shrink-0 mt-0.5" />
                <span className="text-2xs leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
