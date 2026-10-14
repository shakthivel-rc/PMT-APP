import { Suspense, useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  Cloud,
  Coins,
  ExternalLink,
  GitBranch,
  GitMerge,
  Loader2,
  Settings,
  Shield,
  Snowflake,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsApi } from '@/api/aiAgents';
import {
  addMemberApi,
  archiveSpaceApi,
  fetchMembersApi,
  fetchRepositoriesApi,
  fetchSpaceApi,
  freezeSpaceApi,
  linkRepositoryApi,
  removeMemberApi,
  unarchiveSpaceApi,
  unfreezeSpaceApi,
  updateMemberApi,
  updateSpaceApi,
} from '@/api/workspaces';
import { fetchWorkflowEditorsApi, setWorkflowEditorsApi } from '@/api/workflow';
import { useAppSelector } from '@/app/hooks';
import { assignableRoles, canManageMember } from '@/lib/workspaceRules';
import {
  canManageWorkspace,
  type BacklogHygieneResponse,
  type MemberSummary,
  type RepositorySummary,
  type SpaceDetail,
  type SpaceNode,
  type SpaceUpdate,
  type WorkspaceRole,
} from '@/types';
import type { WorkflowEditor as WorkflowEditorType } from '@/types/workflow';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';
import { spaceKeyProblem } from '../fieldRules';
import { errorMessage, humanize } from '../presentation';
import { StorageSection } from './StorageSection';

const WorkflowEditor = lazyWithRetry(
  () => import('@/features/workflow/components/WorkflowEditor'),
  'WorkflowEditor',
);

export interface SpaceSettingsProps {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
  onChanged: () => Promise<unknown>;
}

type SettingsSection = 'workflow' | 'general' | 'ai' | 'budget' | 'members' | 'storage' | 'integrations' | 'danger';

/**
 * General space details & project charter editing form.
 */
const GeneralSection = ({
  workspaceId,
  space,
  manage,
  onChanged,
}: {
  workspaceId: string;
  space: SpaceNode;
  manage: boolean;
  onChanged: () => Promise<unknown>;
}) => {
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(space.name);
  const [key, setKey] = useState(space.key);
  const [description, setDescription] = useState(space.description ?? '');
  const [ownerId, setOwnerId] = useState<string>(space.owner?.id ?? '');
  const [deliveryMethod, setDeliveryMethod] = useState<string>(space.delivery_method ?? '');

  // Charter fields
  const [objective, setObjective] = useState('');
  const [successMeasure, setSuccessMeasure] = useState('');
  const [reuseJustification, setReuseJustification] = useState('');
  const [scope, setScope] = useState('');

  const [keyError, setKeyError] = useState<string | null>(null);
  const [isUpdating, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSpaceApi(workspaceId, space.id),
      fetchMembersApi(workspaceId),
    ])
      .then(([spaceDet, memberList]) => {
        if (!cancelled) {
          setDetail(spaceDet);
          setName(spaceDet.name);
          setKey(spaceDet.key);
          setDescription(spaceDet.description ?? '');
          setOwnerId(spaceDet.owner?.id ?? '');
          setDeliveryMethod(spaceDet.delivery_method ?? '');
          setObjective(spaceDet.charter?.objective ?? '');
          setSuccessMeasure(spaceDet.charter?.success_measure ?? '');
          setReuseJustification(spaceDet.charter?.reuse_justification ?? '');
          setScope(spaceDet.charter?.scope ?? '');
          setMembers(memberList.filter((m) => m.role !== 'guest'));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, space.id]);

  const handleKeyChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 10);
    setKey(upper);
    const prob = spaceKeyProblem(upper);
    setKeyError(prob ? prob.message : null);
  };

  const handleUpdateGeneral = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const prob = spaceKeyProblem(key);
    if (prob) {
      setKeyError(prob.message);
      return;
    }

    startTransition(async () => {
      try {
        const payload: SpaceUpdate = {
          name: name.trim(),
          key: key.trim(),
          description: description.trim() || null,
          owner_id: ownerId || null,
          delivery_method: (deliveryMethod as 'scrum' | 'kanban') || null,
          charter: {
            objective: objective.trim() || null,
            success_measure: successMeasure.trim() || null,
            reuse_justification: reuseJustification.trim() || null,
            scope: scope.trim() || null,
          },
        };

        const updated = await updateSpaceApi(workspaceId, space.id, payload);
        setDetail(updated);
        await onChanged();
        toast.success('Space details and charter updated.');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const aliases = detail?.key_aliases ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Project Settings & Charter</CardTitle>
        <CardDescription>
          Manage project identifiers (name, prefix), accountable owner, delivery method (Scrum/Kanban), and charter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdateGeneral} className="grid max-w-2xl gap-5">
          {/* Space Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="space-name">Space Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!manage || space.archived || space.frozen}
              maxLength={100}
              required
            />
          </div>

          {/* Key Prefix & Aliases */}
          <div className="grid gap-1.5">
            <Label htmlFor="space-key">Issue Key Prefix</Label>
            <Input
              id="space-key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              disabled={!manage || space.archived || space.frozen}
              className="font-mono uppercase max-w-xs"
              maxLength={10}
              required
            />
            {keyError && <p className="text-xs text-danger">{keyError}</p>}
            <p className="text-xs text-muted-foreground">
              Prefix used for issue numbering (e.g. {key || 'PRJ'}-1, {key || 'PRJ'}-2). Changing the key updates all
              issue keys while keeping former keys as aliases.
            </p>
            {aliases.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Previous aliases:</span>
                {aliases.map((alias) => (
                  <span key={alias} className="font-mono rounded bg-muted px-1.5 py-0.5 font-medium">
                    {alias}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Space Owner & Delivery Method */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="space-owner">Accountable Owner</Label>
              <Select
                value={ownerId || 'none'}
                onValueChange={(val) => setOwnerId(val === 'none' ? '' : val)}
                disabled={!manage || space.archived || space.frozen}
              >
                <SelectTrigger id="space-owner">
                  <SelectValue placeholder="No designated owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No designated owner</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {`${m.first_name} ${m.last_name}`.trim() || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="space-delivery">Delivery Method</Label>
              <Select
                value={deliveryMethod || 'none'}
                onValueChange={(val) => setDeliveryMethod(val === 'none' ? '' : val)}
                disabled={!manage || space.archived || space.frozen}
              >
                <SelectTrigger id="space-delivery">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="scrum">Scrum (Sprints & Burndowns)</SelectItem>
                  <SelectItem value="kanban">Kanban (Continuous Flow)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="space-desc">Description</Label>
            <Textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!manage || space.archived || space.frozen}
              placeholder="What this space is for, high-level deliverables and background..."
              rows={3}
            />
          </div>

          {/* Project Charter Section */}
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <div>
              <h4 className="text-sm font-semibold">Project Charter (Creation Checklist)</h4>
              <p className="text-xs text-muted-foreground">
                Document business intent, targets, and criteria for this space.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="charter-objective" className="text-xs">Business Objective</Label>
                <Input
                  id="charter-objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  disabled={!manage || space.archived || space.frozen}
                  placeholder="e.g. Customers can refund a card payment without calling support"
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="charter-metric" className="text-xs">Success Measure</Label>
                <Input
                  id="charter-metric"
                  value={successMeasure}
                  onChange={(e) => setSuccessMeasure(e.target.value)}
                  disabled={!manage || space.archived || space.frozen}
                  placeholder="e.g. Refund tickets down 50% within a quarter of launch"
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="charter-scope" className="text-xs">Scope & Boundary</Label>
                <Input
                  id="charter-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  disabled={!manage || space.archived || space.frozen}
                  placeholder="e.g. Card refunds, partial refunds, customer confirmation email"
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="charter-reuse" className="text-xs">Why an Existing Space Will Not Do</Label>
                <Input
                  id="charter-reuse"
                  value={reuseJustification}
                  onChange={(e) => setReuseJustification(e.target.value)}
                  disabled={!manage || space.archived || space.frozen}
                  placeholder="e.g. Payments has its own cadence and distinct sprint delivery team"
                />
              </div>
            </div>
          </div>

          {manage && !space.archived && !space.frozen && (
            <Button type="submit" disabled={isUpdating} className="w-fit">
              {isUpdating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save Changes
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * Space Budget & Financial Tracking Section.
 */
const BudgetSection = ({
  workspaceId,
  space,
  manage,
  onChanged,
}: {
  workspaceId: string;
  space: SpaceNode;
  manage: boolean;
  onChanged: () => Promise<unknown>;
}) => {
  const [budgetAmount, setBudgetAmount] = useState<string>(
    space.budget_amount != null ? String(space.budget_amount) : '',
  );
  const [alertThreshold, setAlertThreshold] = useState<number>(
    space.budget_alert_threshold ?? 80,
  );
  const [saving, startSaving] = useTransition();

  const spent = space.budget_spent ?? 0;
  const ceiling = space.budget_amount != null ? Number(space.budget_amount) : null;
  const percentage = ceiling && ceiling > 0 ? Math.min(Math.round((spent / ceiling) * 100), 100) : 0;
  const isOverBudget = ceiling !== null && ceiling > 0 && spent >= ceiling;
  const isWarning = ceiling !== null && ceiling > 0 && spent >= (ceiling * alertThreshold) / 100 && !isOverBudget;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!manage || space.archived || space.frozen) return;

    startSaving(async () => {
      try {
        const payload: SpaceUpdate = {
          budget_amount: budgetAmount.trim() === '' ? null : Number(budgetAmount),
          budget_alert_threshold: alertThreshold,
        };

        await updateSpaceApi(workspaceId, space.id, payload);
        await onChanged();
        toast.success('Space budget settings updated.');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget & Cost Tracking</CardTitle>
        <CardDescription>
          Establish a financial budget ceiling for this project space and track burn rate as team members log time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Progress & Status */}
        {ceiling !== null && ceiling > 0 ? (
          <div className="mb-6 rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-medium">Budget Spent</span>
                <p className="text-xl font-bold tracking-tight">
                  ${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">
                    of ${ceiling.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </p>
              </div>

              <div>
                {isOverBudget ? (
                  <StatusBadge tone="danger">Exceeded ({percentage}%)</StatusBadge>
                ) : isWarning ? (
                  <StatusBadge tone="warning">Threshold Reached ({percentage}%)</StatusBadge>
                ) : (
                  <StatusBadge tone="success">On Track ({percentage}%)</StatusBadge>
                )}
              </div>
            </div>

            {/* Visual Gauge / Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300',
                  isOverBudget ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-success',
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Alert threshold set to {alertThreshold}%. Warning triggers when spent cost reaches this limit.
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No budget ceiling set for this space. Costs accumulate automatically based on workspace hourly rates.
            {spent > 0 && (
              <p className="mt-1 font-medium text-foreground">
                Current cost logged: ${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="grid max-w-xl gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="space-budget-amount">Budget Amount ($)</Label>
            <Input
              id="space-budget-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 25000.00"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              disabled={!manage || space.archived || space.frozen}
            />
            <p className="text-2xs text-muted-foreground">
              Total project expenditure ceiling. Leave empty for unlimited.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="space-budget-threshold">Alert Threshold ({alertThreshold}%)</Label>
            <Input
              id="space-budget-threshold"
              type="number"
              min="10"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              disabled={!manage || space.archived || space.frozen}
            />
            <p className="text-2xs text-muted-foreground">
              Warning status triggers when spent cost reaches this percentage of total budget.
            </p>
          </div>

          {manage && !space.archived && !space.frozen && (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save Budget Settings
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * Phase 3 Autonomous AI Agents & Workflows Governance Section.
 */
const AIAgentsSection = ({
  workspaceId,
  space,
  manage,
  onChanged,
}: {
  workspaceId: string;
  space: SpaceNode;
  manage: boolean;
  onChanged: () => Promise<unknown>;
}) => {
  const [triageEnabled, setTriageEnabled] = useState(space.ai_triage_enabled ?? true);
  const [standupEnabled, setStandupEnabled] = useState(space.ai_standup_enabled ?? true);
  const [retroEnabled, setRetroEnabled] = useState(space.ai_retrospective_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hygieneReport, setHygieneReport] = useState<BacklogHygieneResponse | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSpaceApi(workspaceId, space.id, {
        ai_triage_enabled: triageEnabled,
        ai_standup_enabled: standupEnabled,
        ai_retrospective_enabled: retroEnabled,
      });
      toast.success('AI Autonomous Agent governance settings saved');
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err) || 'Failed to save AI agent settings');
    } finally {
      setSaving(false);
    }
  };

  const handleScanHygiene = async () => {
    setScanning(true);
    try {
      const res = await aiAgentsApi.getBacklogHygiene(workspaceId, space.id, 90);
      setHygieneReport(res.data);
      if (res.data.stale_count === 0) {
        toast.success('Backlog hygiene check passed: no stale items found (>90 days)');
      } else {
        toast.info(`Found ${res.data.stale_count} stale backlog items requiring review`);
      }
    } catch (err) {
      toast.error('Failed to scan backlog hygiene');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Autonomous AI Agents & Workflows</CardTitle>
          </div>
          <CardDescription>
            Configure proactive background agents that eliminate team administrative friction.
            All autonomous actions operate strictly under Tier 0/1 permissions (comments, linking, triage tags) and never delete or archive data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Auto-Triage & Deduplication */}
            <div className="flex items-start gap-4 rounded-xl border p-4 bg-muted/20">
              <input
                id="toggle-ai-triage"
                type="checkbox"
                checked={triageEnabled}
                onChange={(e) => setTriageEnabled(e.target.checked)}
                disabled={!manage || space.archived || space.frozen}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <Label htmlFor="toggle-ai-triage" className="text-sm font-semibold cursor-pointer">
                  Autonomous Bug Triage & Deduplication
                </Label>
                <p className="text-xs text-muted-foreground">
                  Scans incoming issues for semantic duplicates (&gt;85% similarity), links related dependencies, evaluates active team WIP to suggest owners, and extracts structured reproduction steps.
                </p>
              </div>
            </div>

            {/* Daily Standup & Trajectory Forecast */}
            <div className="flex items-start gap-4 rounded-xl border p-4 bg-muted/20">
              <input
                id="toggle-ai-standup"
                type="checkbox"
                checked={standupEnabled}
                onChange={(e) => setStandupEnabled(e.target.checked)}
                disabled={!manage || space.archived || space.frozen}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <Label htmlFor="toggle-ai-standup" className="text-sm font-semibold cursor-pointer">
                  Automated Daily Standup & Trajectory Forecast
                </Label>
                <p className="text-xs text-muted-foreground">
                  Synthesizes daily activity matrices (completed work, in-flight tickets, blockers) and projects active sprint burndown velocity health.
                </p>
              </div>
            </div>

            {/* Automated Sprint Retrospectives */}
            <div className="flex items-start gap-4 rounded-xl border p-4 bg-muted/20">
              <input
                id="toggle-ai-retro"
                type="checkbox"
                checked={retroEnabled}
                onChange={(e) => setRetroEnabled(e.target.checked)}
                disabled={!manage || space.archived || space.frozen}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <Label htmlFor="toggle-ai-retro" className="text-sm font-semibold cursor-pointer">
                  Automated Sprint Retrospectives
                </Label>
                <p className="text-xs text-muted-foreground">
                  Generates an executive post-mortem upon sprint closure highlighting high-velocity delivery wins, scope creep (mid-sprint additions), and cycle time outliers.
                </p>
              </div>
            </div>

            {manage && !space.archived && !space.frozen && (
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                  Save AI Agent Settings
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Backlog Hygiene Scan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Backlog Hygiene Scanner
              </CardTitle>
              <CardDescription>
                Detects issues in this space inactive for more than 90 days and suggests actionable tidy recommendations.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleScanHygiene}
              disabled={scanning}
            >
              {scanning && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Scan Backlog
            </Button>
          </div>
        </CardHeader>
        {hygieneReport && (
          <CardContent>
            {hygieneReport.items.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-success p-3 rounded-lg border border-success/30 bg-success/10">
                <CheckCircle2 className="size-4 shrink-0" />
                Backlog is spotless! No inactive issues found past {hygieneReport.threshold_days} days.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {hygieneReport.stale_count} Stale Backlog Item(s)
                </div>
                <div className="rounded-lg border overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <thead className="bg-muted text-muted-foreground text-left">
                      <tr>
                        <th className="p-2.5 font-medium">Key</th>
                        <th className="p-2.5 font-medium">Title</th>
                        <th className="p-2.5 font-medium">Inactive</th>
                        <th className="p-2.5 font-medium">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {hygieneReport.items.map((item) => (
                        <tr key={item.issue_id} className="hover:bg-muted/50 transition-colors">
                          <td className="p-2.5 font-mono font-medium text-primary">{item.key}</td>
                          <td className="p-2.5 font-medium text-foreground">{item.title}</td>
                          <td className="p-2.5 text-muted-foreground">{item.days_inactive} days</td>
                          <td className="p-2.5 text-foreground">{item.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

const nameOf = (m: MemberSummary) => `${m.first_name} ${m.last_name}`.trim() || m.email;

/**
 * Members & Permissions management: team members and delegated workflow editors.
 */
const MembersSection = ({
  workspaceId,
  space,
  role,
  manage,
}: {
  workspaceId: string;
  space: SpaceNode;
  role: WorkspaceRole;
  manage: boolean;
}) => {
  const me = useAppSelector((state) => state.auth.user?.id);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [editors, setEditors] = useState<WorkflowEditorType[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite member state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<WorkspaceRole>('member');
  const [isAdding, startAddTransition] = useTransition();

  // Workflow editor grant state
  const [selectedEditorId, setSelectedEditorId] = useState('');
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);

  // Remove member state
  const [confirmingRemove, setConfirmingRemove] = useState<MemberSummary | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMembersApi(workspaceId),
      fetchWorkflowEditorsApi(workspaceId, space.id),
    ])
      .then(([memList, edList]) => {
        if (!cancelled) {
          setMembers(memList);
          setEditors(edList);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, space.id]);

  const callerRole = members.find((m) => m.user_id === me)?.role ?? role;
  const offeredRoles = assignableRoles(callerRole);

  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    startAddTransition(async () => {
      try {
        const added = await addMemberApi(workspaceId, { email: newEmail.trim(), role: newRole });
        setMembers((prev) => [...prev, added]);
        setNewEmail('');
        setNewRole('member');
        toast.success(`${added.email} added as ${humanize(added.role)}.`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  const handleRoleChange = async (member: MemberSummary, nextRole: WorkspaceRole) => {
    try {
      const updated = await updateMemberApi(workspaceId, member.user_id, { role: nextRole });
      setMembers((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
      toast.success(`${nameOf(updated)} is now ${humanize(updated.role)}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleExecuteRemove = () => {
    if (!confirmingRemove) return;
    startRemoveTransition(async () => {
      try {
        await removeMemberApi(workspaceId, confirmingRemove.user_id);
        setMembers((prev) => prev.filter((m) => m.user_id !== confirmingRemove.user_id));
        setEditors((prev) => prev.filter((e) => e.user.id !== confirmingRemove.user_id));
        toast.success(`${nameOf(confirmingRemove)} removed from project.`);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setConfirmingRemove(null);
      }
    });
  };

  const handleAddEditor = async () => {
    if (!selectedEditorId) return;
    const nextUserIds = Array.from(new Set([...editors.map((e) => e.user.id), selectedEditorId]));
    try {
      const updated = await setWorkflowEditorsApi(workspaceId, space.id, nextUserIds);
      setEditors(updated);
      setSelectedEditorId('');
      toast.success('Workflow editor granted.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleExecuteRevoke = async () => {
    if (!confirmingRevoke) return;
    const nextUserIds = editors.map((e) => e.user.id).filter((id) => id !== confirmingRevoke);
    try {
      const updated = await setWorkflowEditorsApi(workspaceId, space.id, nextUserIds);
      setEditors(updated);
      toast.success('Workflow editor permission revoked.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirmingRevoke(null);
    }
  };

  const targetEditor = editors.find((e) => e.user.id === confirmingRevoke);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Members Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden="true" />
            <CardTitle>Project Members</CardTitle>
          </div>
          <CardDescription>
            Manage team members and their roles. Members can be assigned to issues, participate in sprint boards, and log time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {manage && !space.archived && !space.frozen && (
            <form onSubmit={handleAddMember} className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-1.5 flex-1 min-w-56">
                <Label htmlFor="add-member-email">Invite by Email</Label>
                <Input
                  id="add-member-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  required
                />
              </div>
              <div className="grid gap-1.5 w-40">
                <Label htmlFor="add-member-role">Role</Label>
                <Select value={newRole} onValueChange={(val) => setNewRole(val as WorkspaceRole)}>
                  <SelectTrigger id="add-member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {offeredRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {humanize(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isAdding || !newEmail.trim()}>
                {isAdding && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Add Member
              </Button>
            </form>
          )}

          <div className="divide-y divide-border rounded-lg border">
            {members.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No members found.</div>
            ) : (
              members.map((m) => {
                const canManageThis = manage && canManageMember(callerRole, m.role) && !space.archived && !space.frozen;
                const isOwn = m.user_id === me;

                return (
                  <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{nameOf(m)}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManageThis && !isOwn ? (
                        <Select
                          value={m.role}
                          onValueChange={(val) => handleRoleChange(m, val as WorkspaceRole)}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs" aria-label={`Role for ${nameOf(m)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {offeredRoles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {humanize(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge tone={m.role === 'admin' || m.role === 'owner' ? 'primary' : 'neutral'}>
                          {humanize(m.role)}
                        </StatusBadge>
                      )}

                      {canManageThis && !isOwn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:bg-danger-subtle hover:text-danger h-8 px-2 text-xs"
                          onClick={() => setConfirmingRemove(m)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delegated Workflow Editors Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" aria-hidden="true" />
            <CardTitle>Delegated Workflow Editors</CardTitle>
          </div>
          <CardDescription>
            Admins and workspace owners can always edit workflows. Granting workflow-edit permissions allows team members
            to customize stages without needing full workspace admin privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {manage && !space.archived && !space.frozen && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-56 flex-1">
                <select
                  aria-label="Select member to grant edit permissions"
                  value={selectedEditorId}
                  onChange={(e) => setSelectedEditorId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Select a member to grant edit permissions...</option>
                  {members
                    .filter((m) => m.role !== 'guest' && !editors.some((e) => e.user.id === m.user_id))
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {nameOf(m)} ({m.email})
                      </option>
                    ))}
                </select>
              </div>
              <Button onClick={handleAddEditor} disabled={!selectedEditorId}>
                Grant Workflow Access
              </Button>
            </div>
          )}

          <div className="divide-y divide-border rounded-lg border">
            {editors.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No individual workflow editors granted. Only workspace admins can modify this workflow.
              </div>
            ) : (
              editors.map((editor) => (
                <div key={editor.user.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-semibold text-sm">{editor.user.display_name}</p>
                    <p className="text-xs text-muted-foreground">Workspace role: {humanize(editor.role)}</p>
                  </div>
                  {manage && !space.archived && !space.frozen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-subtle hover:text-danger"
                      onClick={() => setConfirmingRevoke(editor.user.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirm Remove Member Dialog */}
      {confirmingRemove && (
        <ConfirmDialog
          open={Boolean(confirmingRemove)}
          onOpenChange={(open) => !open && setConfirmingRemove(null)}
          title={`Remove ${nameOf(confirmingRemove)} from project?`}
          description="They will lose access to this workspace and project immediately. Issues assigned to them will stay assigned."
          confirmLabel="Remove Member"
          destructive
          loading={isRemoving}
          onConfirm={handleExecuteRemove}
        />
      )}

      {/* Confirm Revoke Workflow Editor Dialog */}
      {confirmingRevoke && (
        <ConfirmDialog
          open={Boolean(confirmingRevoke)}
          onOpenChange={(open) => !open && setConfirmingRevoke(null)}
          title={`Revoke workflow editing from ${targetEditor?.user.display_name ?? 'this user'}?`}
          description="They will no longer be able to publish workflow status changes for this space."
          confirmLabel="Revoke Access"
          destructive
          onConfirm={handleExecuteRevoke}
        />
      )}
    </div>
  );
};

/**
 * GitHub integration repository links.
 */
const IntegrationsSection = ({
  workspaceId,
  manage,
}: {
  workspaceId: string;
  manage: boolean;
}) => {
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [repoName, setRepoName] = useState('');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLinking, startTransition] = useTransition();

  const normalizeGithubRepo = (input: string): string => {
    let clean = input.trim();
    clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
    clean = clean.replace(/^git@github\.com:/i, '');
    clean = clean.replace(/\.git$/i, '');
    clean = clean.replace(/^\/+|\/+$/g, '');
    return clean;
  };

  useEffect(() => {
    let cancelled = false;
    fetchRepositoriesApi(workspaceId)
      .then((rows) => {
        if (!cancelled) {
          setRepos(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleLinkRepo = (e: FormEvent) => {
    e.preventDefault();
    const raw = repoName.trim();
    if (!raw) return;

    const normalized = normalizeGithubRepo(raw);
    if (!normalized.includes('/')) {
      const msg = "Please enter the repository in 'owner/repo' format (e.g. your-org/jenkins-copilot-triage or facebook/react).";
      setRepoError(msg);
      toast.error(msg);
      return;
    }

    if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(normalized)) {
      const msg = "Invalid format. Expected 'owner/repo' (letters, numbers, hyphens, underscores).";
      setRepoError(msg);
      toast.error(msg);
      return;
    }

    setRepoError(null);
    startTransition(async () => {
      try {
        const linked = await linkRepositoryApi(workspaceId, {
          full_name: normalized,
        });
        setRepos((prev) => [...prev, linked]);
        setRepoName('');
        toast.success(`Repository ${linked.full_name} linked.`);
      } catch (err) {
        const msg = errorMessage(err);
        setRepoError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>GitHub Repository Links</CardTitle>
        </div>
        <CardDescription>
          Link GitHub repositories to this workspace to enable pull request tracking, branch associations, and automated
          PR merge workflow transitions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {manage && (
          <form onSubmit={handleLinkRepo} className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5 flex-1 min-w-64">
                <Label htmlFor="repo-name">Repository Full Name</Label>
                <Input
                  id="repo-name"
                  value={repoName}
                  onChange={(e) => {
                    setRepoName(e.target.value);
                    if (repoError) setRepoError(null);
                  }}
                  onBlur={() => {
                    if (repoName.trim()) {
                      setRepoName(normalizeGithubRepo(repoName));
                    }
                  }}
                  placeholder="owner/repo-name (e.g. jenkins/jenkins-copilot-triage or facebook/react)"
                  required
                />
              </div>
              <Button type="submit" disabled={isLinking || !repoName.trim()}>
                {isLinking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Link Repository
              </Button>
            </div>
            {repoError ? (
              <p className="text-xs text-destructive font-medium">{repoError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Enter as <strong>owner/repository</strong> (e.g.{' '}
                <code className="font-mono text-foreground/80">jenkins/jenkins-copilot-triage</code> or{' '}
                <code className="font-mono text-foreground/80">facebook/react</code>), or paste the full GitHub URL.
              </p>
            )}
          </form>
        )}

        <div className="divide-y divide-border rounded-lg border">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading repositories...</div>
          ) : repos.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No repositories linked to this workspace yet. Link a GitHub repository above.
            </div>
          ) : (
            repos.map((repo) => (
              <div key={repo.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-sm font-semibold">{repo.full_name}</span>
                  <StatusBadge tone="neutral">GitHub</StatusBadge>
                </div>
                <a
                  href={`https://github.com/${repo.full_name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  View on GitHub
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Danger zone section for freeze and archive actions.
 */
const DangerZoneSection = ({
  workspaceId,
  space,
  manage,
  onChanged,
}: {
  workspaceId: string;
  space: SpaceNode;
  manage: boolean;
  onChanged: () => Promise<unknown>;
}) => {
  const [freezeReason, setFreezeReason] = useState(space.freeze_reason ?? '');
  const [isUpdatingState, startStateTransition] = useTransition();

  const [confirmFreezeOpen, setConfirmFreezeOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  const executeToggleFreeze = () => {
    startStateTransition(async () => {
      try {
        if (space.frozen) {
          const res = await unfreezeSpaceApi(workspaceId, space.id);
          await onChanged();
          toast.success(`Space unfrozen. Replayed ${res.replay?.replayed ?? 0} deferred deliveries.`);
        } else {
          await freezeSpaceApi(workspaceId, space.id, { reason: freezeReason.trim() || 'Maintenance' });
          await onChanged();
          toast.success('Space is now frozen (read-only).');
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setConfirmFreezeOpen(false);
      }
    });
  };

  const executeToggleArchive = () => {
    startStateTransition(async () => {
      try {
        if (space.archived) {
          await unarchiveSpaceApi(workspaceId, space.id);
          await onChanged();
          toast.success('Space unarchived and restored to active state.');
        } else {
          await archiveSpaceApi(workspaceId, space.id);
          await onChanged();
          toast.success('Space archived (read-only).');
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setConfirmArchiveOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Freeze Space */}
      <Card className="border-warning/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-warning">
            <Snowflake className="size-5" aria-hidden="true" />
            <CardTitle>Freeze Space (Temporary Read-Only)</CardTitle>
          </div>
          <CardDescription>
            Freezing temporarily pauses all writes, issue creation, and updates while restructuring work is underway.
            Inbound GitHub webhook deliveries are queued and deferred until unfrozen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!space.frozen ? (
            <div className="grid gap-1.5 max-w-lg">
              <Label htmlFor="freeze-reason">Freeze Reason</Label>
              <Input
                id="freeze-reason"
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="e.g. Migration in progress"
                disabled={!manage}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning">
              <strong>Currently Frozen:</strong> {space.freeze_reason || 'Reorganisation in progress'}
            </div>
          )}

          {manage && (
            <Button
              variant={space.frozen ? 'outline' : 'destructive'}
              onClick={() => {
                if (space.frozen) {
                  executeToggleFreeze();
                } else {
                  setConfirmFreezeOpen(true);
                }
              }}
              disabled={isUpdatingState || space.archived}
            >
              {isUpdatingState && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {space.frozen ? 'Unfreeze Space' : 'Freeze Space'}
            </Button>
          )}

          <ConfirmDialog
            open={confirmFreezeOpen}
            onOpenChange={setConfirmFreezeOpen}
            title={`Freeze space "${space.name}"?`}
            description="All writes, transitions, and new issues will be paused for team members until unfrozen. Inbound GitHub PR updates will be deferred."
            confirmLabel="Freeze Space"
            loading={isUpdatingState}
            onConfirm={executeToggleFreeze}
          />
        </CardContent>
      </Card>

      {/* Archive Space */}
      <Card className="border-danger/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-danger">
            <Archive className="size-5" aria-hidden="true" />
            <CardTitle>Archive Space (Permanent Read-Only)</CardTitle>
          </div>
          <CardDescription>
            Archiving marks the space as closed and read-only. History, reports, and time tracking remain accessible,
            but new work cannot be scheduled. Sprints must be closed before archiving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {space.archived && (
            <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
              This space is currently archived and read-only.
            </div>
          )}

          {manage && (
            <Button
              variant={space.archived ? 'outline' : 'destructive'}
              onClick={() => {
                if (space.archived) {
                  executeToggleArchive();
                } else {
                  setConfirmArchiveOpen(true);
                }
              }}
              disabled={isUpdatingState || space.frozen}
            >
              {isUpdatingState && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {space.archived ? 'Unarchive Space' : 'Archive Space'}
            </Button>
          )}

          <ConfirmDialog
            open={confirmArchiveOpen}
            onOpenChange={setConfirmArchiveOpen}
            title={`Archive space "${space.name}"?`}
            description="The space and all its lists will become permanently read-only. History and reports will be retained. Any active sprints must be completed before archiving."
            confirmLabel="Archive Space"
            destructive
            loading={isUpdatingState}
            onConfirm={executeToggleArchive}
          />
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Centralized Project / Space Settings Hub.
 */
export const SpaceSettings = ({ workspaceId, space, role, onChanged }: SpaceSettingsProps) => {
  const [section, setSection] = useState<SettingsSection>('workflow');
  const manage = canManageWorkspace(role);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Settings Navigation Sidebar */}
      <aside className="w-full shrink-0 lg:w-60">
        <div className="rounded-xl border bg-card p-2 shadow-2xs">
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Space Settings</h3>
          </div>
          <nav aria-label="Settings navigation" className="space-y-1">
            <button
              type="button"
              onClick={() => setSection('workflow')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'workflow'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Workflow className="size-4 shrink-0" aria-hidden="true" />
              Workflows & Statuses
            </button>

            <button
              type="button"
              onClick={() => setSection('general')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'general'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Settings className="size-4 shrink-0" aria-hidden="true" />
              General & Charter (Project Settings)
            </button>

            <button
              type="button"
              onClick={() => setSection('ai')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'ai'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Autonomous AI Agents
            </button>

            <button
              type="button"
              onClick={() => setSection('budget')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'budget'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Coins className="size-4 shrink-0" aria-hidden="true" />
              Budget & Cost Tracking
            </button>

            <button
              type="button"
              onClick={() => setSection('members')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'members'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Users className="size-4 shrink-0" aria-hidden="true" />
              Members & Permissions
            </button>

            <button
              type="button"
              onClick={() => setSection('storage')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'storage'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Cloud className="size-4 shrink-0" aria-hidden="true" />
              Storage & Cloud (MCP)
            </button>

            <button
              type="button"
              onClick={() => setSection('integrations')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === 'integrations'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <GitMerge className="size-4 shrink-0" aria-hidden="true" />
              Integrations (GitHub)
            </button>

            {manage && (
              <button
                type="button"
                onClick={() => setSection('danger')}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  section === 'danger'
                    ? 'bg-danger-subtle text-danger font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-danger'
                }`}
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                Danger Zone
              </button>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Settings Content Area */}
      <div className="min-w-0 flex-1">
        {section === 'workflow' && (
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <WorkflowEditor workspaceId={workspaceId} space={space} role={role} onPublished={onChanged} />
          </Suspense>
        )}

        {section === 'general' && (
          <GeneralSection
            key={space.id + space.name}
            workspaceId={workspaceId}
            space={space}
            manage={manage}
            onChanged={onChanged}
          />
        )}

        {section === 'ai' && (
          <AIAgentsSection
            key={space.id + '-ai'}
            workspaceId={workspaceId}
            space={space}
            manage={manage}
            onChanged={onChanged}
          />
        )}

        {section === 'budget' && (
          <BudgetSection
            key={space.id + '-budget'}
            workspaceId={workspaceId}
            space={space}
            manage={manage}
            onChanged={onChanged}
          />
        )}

        {section === 'members' && (
          <MembersSection key={space.id} workspaceId={workspaceId} space={space} role={role} manage={manage} />
        )}

        {section === 'storage' && (
          <StorageSection workspaceId={workspaceId} manage={manage} />
        )}

        {section === 'integrations' && (
          <IntegrationsSection workspaceId={workspaceId} manage={manage} />
        )}

        {section === 'danger' && manage && (
          <DangerZoneSection
            key={`${space.id}-${space.frozen}-${space.archived}`}
            workspaceId={workspaceId}
            space={space}
            manage={manage}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
};

export default SpaceSettings;
