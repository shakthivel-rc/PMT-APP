import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Flame,
  GitBranch,
  RefreshCw,
  Search,
} from 'lucide-react';
import { timelineApi } from '@/api/timeline';
import {
  canWriteIssues,
  type RescheduleRequest,
  type SpaceNode,
  type TimelineIssueItem,
  type TimelineResponse,
  type WorkspaceRole,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TimelineViewProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ workspaceId, space, role }) => {
  const canEdit = canWriteIssues(role);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [zoom, setZoom] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [groupBy, setGroupBy] = useState<'none' | 'epic' | 'list' | 'assignee'>('none');
  const [filterText, setFilterText] = useState('');
  const [enableCascade, setEnableCascade] = useState(true);
  const [cascadeMode, setCascadeMode] = useState<'push_all_dependents' | 'push_conflicts_only'>('push_all_dependents');
  
  // Reschedule dialog state
  const [rescheduleIssue, setRescheduleIssue] = useState<TimelineIssueItem | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timelineApi.getTimeline(workspaceId, space.id, {
        zoom,
        group_by: groupBy,
      });
      if (res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, space.id, zoom, groupBy]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Compute overall timeline date bounds
  const { startDate, endDate, totalDays } = useMemo(() => {
    const today = new Date();
    let minD = new Date(today);
    minD.setDate(minD.getDate() - 7);
    let maxD = new Date(today);
    maxD.setDate(maxD.getDate() + 30);

    if (data?.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item.start_date) {
          const d = new Date(item.start_date);
          if (d < minD) minD = d;
        }
        if (item.due_date) {
          const d = new Date(item.due_date);
          if (d > maxD) maxD = d;
        }
      }
    }

    const diffMs = maxD.getTime() - minD.getTime();
    const days = Math.max(30, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 7);
    return { startDate: minD, endDate: maxD, totalDays: days };
  }, [data]);

  // Filter items by search text
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!filterText.trim()) return data.items;
    const q = filterText.toLowerCase();
    return data.items.filter(
      (it) =>
        it.key.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q) ||
        (it.assignee_name && it.assignee_name.toLowerCase().includes(q))
    );
  }, [data, filterText]);

  const criticalPathSet = useMemo(() => {
    return new Set(data?.critical_path_issue_ids || []);
  }, [data]);

  const handleOpenReschedule = (issue: TimelineIssueItem) => {
    setRescheduleIssue(issue);
    setEditStartDate(issue.start_date || new Date().toISOString().slice(0, 10));
    setEditDueDate(
      issue.due_date ||
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    );
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleIssue) return;
    if (editDueDate < editStartDate) {
      toast.error('Due date must be on or after start date');
      return;
    }

    setRescheduling(true);
    try {
      const payload: RescheduleRequest = {
        start_date: editStartDate,
        due_date: editDueDate,
        cascade: enableCascade,
        cascade_mode: cascadeMode,
      };
      const res = await timelineApi.rescheduleIssue(workspaceId, rescheduleIssue.id, payload);
      if (res.data) {
        const count = res.data.cascaded_issues.length;
        toast.success(
          `Rescheduled ${rescheduleIssue.key}${count > 0 ? ` and cascaded ${count} dependent task(s)` : ''}`
        );
        setRescheduleIssue(null);
        fetchTimeline();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  // Helper to calculate X position (% of timeline) for a date string
  const getPositionPercent = useCallback(
    (dateStr: string | null): number => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      const diffDays = (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, Math.min(100, (diffDays / totalDays) * 100));
    },
    [startDate, totalDays]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background border rounded-lg shadow-sm overflow-hidden" data-testid="timeline-view">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search timeline..."
              className="pl-8 h-8 text-xs"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            {(['day', 'week', 'month', 'quarter'] as const).map((z) => (
              <Button
                key={z}
                variant={zoom === z ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs capitalize"
                onClick={() => setZoom(z)}
              >
                {z}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-muted-foreground font-medium">Group:</span>
            <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="assignee">Assignee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="cascade-toggle"
              checked={enableCascade}
              onCheckedChange={setEnableCascade}
            />
            <Label htmlFor="cascade-toggle" className="text-xs font-normal cursor-pointer">
              Cascade Shift
            </Label>
          </div>

          {enableCascade && (
            <Select value={cascadeMode} onValueChange={(v: any) => setCascadeMode(v)}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push_all_dependents">Push All</SelectItem>
                <SelectItem value="push_conflicts_only">Conflicts Only</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={fetchTimeline}>
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Critical Path Notice Banner */}
      {criticalPathSet.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          <Flame className="size-3.5 shrink-0 fill-rose-500 text-rose-500" />
          <span className="font-semibold">Critical Path Active:</span>
          <span>
            {criticalPathSet.size} linked issue(s) dictate the minimum total duration of this space.
          </span>
        </div>
      )}

      {/* Main Timeline Gantt Area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            <RefreshCw className="size-5 animate-spin mr-2" />
            Loading timeline & dependencies...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-sm text-muted-foreground gap-2">
            <Calendar className="size-8 stroke-muted-foreground/50" />
            <span>No issues scheduled for this view.</span>
            <span className="text-xs">Schedule start and due dates on issues to see Gantt bars.</span>
          </div>
        ) : (
          <div className="min-w-[900px] p-4">
            {/* Horizontal Date Scale Bar */}
            <div className="relative h-8 border-b text-[11px] text-muted-foreground flex items-center mb-3">
              <div className="w-64 shrink-0 font-medium pl-2">Task Details</div>
              <div className="flex-1 relative h-full flex items-center">
                <span className="absolute left-0">{startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span className="absolute left-1/4">
                  {new Date(startDate.getTime() + (totalDays * 0.25) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="absolute left-1/2 -translate-x-1/2">
                  {new Date(startDate.getTime() + (totalDays * 0.5) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="absolute left-3/4">
                  {new Date(startDate.getTime() + (totalDays * 0.75) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="absolute right-0">{endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            {/* Issue Rows */}
            <div className="space-y-2">
              {filteredItems.map((issue) => {
                const isCrit = criticalPathSet.has(issue.id);
                const hasDates = issue.start_date && issue.due_date;
                const leftPct = getPositionPercent(issue.start_date);
                const rightPct = getPositionPercent(issue.due_date);
                const widthPct = Math.max(3, rightPct - leftPct);

                return (
                  <div
                    key={issue.id}
                    className="flex items-center h-10 hover:bg-muted/30 rounded-md transition-colors group relative"
                  >
                    {/* Left Meta Column */}
                    <div
                      className="w-64 shrink-0 flex items-center justify-between pr-3 pl-2 cursor-pointer"
                      onClick={() => handleOpenReschedule(issue)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isCrit && <Flame className="size-3 text-rose-500 fill-rose-500 shrink-0" />}
                        <span className="text-xs font-semibold text-primary">{issue.key}</span>
                        <span className="text-xs truncate text-foreground/90">{issue.title}</span>
                      </div>
                      <StatusBadge tone={issue.status_category === 'done' ? 'success' : 'neutral'}>
                        {issue.status_name}
                      </StatusBadge>
                    </div>

                    {/* Right Gantt Bar Canvas */}
                    <div className="flex-1 relative h-7 bg-muted/20 rounded border border-border/40 overflow-hidden">
                      {hasDates ? (
                        <div
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onClick={() => handleOpenReschedule(issue)}
                          className={cn(
                            'absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between cursor-pointer shadow-sm text-[11px] font-medium transition-all hover:brightness-105',
                            isCrit
                              ? 'bg-rose-500 text-white border border-rose-600 shadow-rose-500/20'
                              : 'bg-primary/90 text-primary-foreground'
                          )}
                          title={`${issue.key}: ${issue.start_date} to ${issue.due_date} (Click to reschedule)`}
                        >
                          <span className="truncate">{issue.duration_days}d</span>
                          {issue.story_points && (
                            <span className="ml-1 text-[10px] opacity-80">{issue.story_points}pt</span>
                          )}
                        </div>
                      ) : (
                        <div
                          onClick={() => handleOpenReschedule(issue)}
                          className="absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground/60 italic cursor-pointer hover:text-foreground"
                        >
                          + Set schedule dates
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dependency list overview */}
            {data?.dependencies && data.dependencies.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <GitBranch className="size-3.5" />
                  Dependencies ({data.dependencies.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {data.dependencies.map((dep) => {
                    const src = data.items.find((i) => i.id === dep.source_issue_id);
                    const tgt = data.items.find((i) => i.id === dep.target_issue_id);
                    return (
                      <div
                        key={dep.id}
                        className={cn(
                          'p-2 rounded border text-xs flex items-center justify-between',
                          dep.is_conflict
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                            : 'bg-muted/40 border-border text-muted-foreground'
                        )}
                      >
                        <span className="font-medium text-foreground">{src?.key || '??'}</span>
                        <span className="text-[10px] uppercase font-semibold px-1 text-primary">
                          {dep.kind}
                        </span>
                        <span className="font-medium text-foreground">{tgt?.key || '??'}</span>
                        {dep.is_conflict && (
                          <span title="Scheduling conflict detected">
                            <AlertTriangle className="size-3.5 text-amber-500 ml-1" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reschedule Modal Dialog */}
      <Dialog open={Boolean(rescheduleIssue)} onOpenChange={(open) => !open && setRescheduleIssue(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Reschedule {rescheduleIssue?.key}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {rescheduleIssue?.title}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due-date" className="text-xs">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-md border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Cascade to Downstream Tasks:</span>
                <span className="text-primary font-semibold">
                  {enableCascade ? (cascadeMode === 'push_all_dependents' ? 'Push All' : 'Conflicts Only') : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, shifting this task automatically propagates downstream to dependent blockers.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleIssue(null)}
              disabled={rescheduling}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveReschedule}
              disabled={rescheduling || !canEdit}
            >
              {rescheduling && <RefreshCw className="size-3.5 animate-spin mr-1" />}
              Save & Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimelineView;
