import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { initiativesApi } from '@/api/initiatives';
import {
  canManageWorkspace,
  type InitiativeCreate,
  type InitiativeDetailResponse,
  type InitiativeHealth,
  type InitiativeResponse,
  type InitiativeStatus,
  type InitiativeUpdate,
  type SpaceNode,
  type WorkspaceRole,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, type Tone } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InitiativesViewProps {
  workspaceId: string;
  role: WorkspaceRole;
  spaces?: SpaceNode[];
}

export const InitiativesView: React.FC<InitiativesViewProps> = ({ workspaceId, role, spaces = [] }) => {
  const canManage = canManageWorkspace(role);
  const [loading, setLoading] = useState(true);
  const [initiatives, setInitiatives] = useState<InitiativeResponse[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInitiative, setSelectedInitiative] = useState<InitiativeDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'overview' | 'settings'>('overview');

  // Settings / Edit Form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<InitiativeStatus>('active');
  const [editQuarter, setEditQuarter] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Delete Confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQuarter, setNewQuarter] = useState('2026-Q4');
  const [newBudget, setNewBudget] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Link Issues Dialog state
  const [showLinkIssue, setShowLinkIssue] = useState(false);
  const [issueIdsInput, setIssueIdsInput] = useState('');
  const [linkingIssues, setLinkingIssues] = useState(false);

  const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    return fallback;
  };

  const fetchInitiatives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await initiativesApi.listInitiatives(workspaceId);
      if (res.data) {
        setInitiatives(res.data);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load portfolio initiatives'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    initiativesApi.listInitiatives(workspaceId)
      .then((res) => {
        if (!active) return;
        if (res.data) setInitiatives(res.data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast.error(getErrorMessage(err, 'Failed to load portfolio initiatives'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const populateEditForm = (item: InitiativeDetailResponse) => {
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditStatus(item.status);
    setEditQuarter(item.target_quarter || '');
    setEditBudget(item.budget_amount != null ? String(item.budget_amount) : '');
    setEditStartDate(item.start_date ? item.start_date.slice(0, 10) : '');
    setEditTargetDate(item.target_date ? item.target_date.slice(0, 10) : '');
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setModalTab('overview');
    try {
      const res = await initiativesApi.getInitiative(workspaceId, id);
      if (res.data) {
        setSelectedInitiative(res.data);
        populateEditForm(res.data);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load initiative details'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKey.trim() || !newTitle.trim()) {
      toast.error('Key and title are required');
      return;
    }

    setCreating(true);
    try {
      const payload: InitiativeCreate = {
        key: newKey.trim(),
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        target_quarter: newQuarter.trim() || null,
        budget_amount: newBudget ? parseFloat(newBudget) : null,
        start_date: newStartDate || null,
        target_date: newTargetDate || null,
        space_ids: selectedSpaceIds,
      };
      const res = await initiativesApi.createInitiative(workspaceId, payload);
      if (res.data) {
        toast.success(`Created initiative ${res.data.key}`);
        setShowCreate(false);
        setNewKey('');
        setNewTitle('');
        setNewDesc('');
        setNewBudget('');
        setNewStartDate('');
        setNewTargetDate('');
        setSelectedSpaceIds([]);
        fetchInitiatives();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to create initiative'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInitiative) return;
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setSavingSettings(true);
    try {
      const payload: InitiativeUpdate = {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        status: editStatus,
        target_quarter: editQuarter.trim() || null,
        budget_amount: editBudget ? parseFloat(editBudget) : null,
        start_date: editStartDate || null,
        target_date: editTargetDate || null,
      };
      const res = await initiativesApi.updateInitiative(workspaceId, selectedInitiative.id, payload);
      if (res.data) {
        setSelectedInitiative(res.data);
        populateEditForm(res.data);
        toast.success('Initiative settings saved successfully');
        fetchInitiatives();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update initiative settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await initiativesApi.deleteInitiative(workspaceId, id);
      toast.success('Initiative deleted');
      if (selectedInitiative?.id === id) {
        setSelectedInitiative(null);
      }
      setConfirmDeleteId(null);
      fetchInitiatives();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to delete initiative'));
    } finally {
      setDeleting(false);
    }
  };

  const handleLinkIssues = async () => {
    if (!selectedInitiative || !issueIdsInput.trim()) return;
    setLinkingIssues(true);
    try {
      const ids = issueIdsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await initiativesApi.linkIssues(workspaceId, selectedInitiative.id, ids);
      if (res.data) {
        setSelectedInitiative(res.data);
        setShowLinkIssue(false);
        setIssueIdsInput('');
        toast.success(`Linked ${ids.length} issue(s)`);
        fetchInitiatives();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to link issues'));
    } finally {
      setLinkingIssues(false);
    }
  };

  const handleUnlinkIssue = async (issueId: string) => {
    if (!selectedInitiative) return;
    try {
      const res = await initiativesApi.unlinkIssue(workspaceId, selectedInitiative.id, issueId);
      if (res.data) {
        setSelectedInitiative(res.data);
        toast.success('Unlinked issue');
        fetchInitiatives();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to unlink issue'));
    }
  };

  const filtered = initiatives.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.key.toLowerCase().includes(search.toLowerCase()) ||
      (i.description && i.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getHealthBadge = (health: InitiativeHealth) => {
    switch (health) {
      case 'on_track':
        return <StatusBadge tone="success"><CheckCircle2 className="size-3 mr-1" /> On Track</StatusBadge>;
      case 'at_risk':
        return <StatusBadge tone="warning"><AlertCircle className="size-3 mr-1" /> At Risk</StatusBadge>;
      case 'off_track':
        return <StatusBadge tone="danger"><AlertCircle className="size-3 mr-1" /> Off Track</StatusBadge>;
      default:
        return <StatusBadge tone="neutral"><Clock className="size-3 mr-1" /> Planned</StatusBadge>;
    }
  };

  const getStatusBadge = (status: InitiativeStatus) => {
    const toneMap: Record<InitiativeStatus, Tone> = {
      active: 'primary',
      completed: 'success',
      cancelled: 'danger',
      planned: 'neutral',
    };
    return (
      <StatusBadge tone={toneMap[status] || 'neutral'} className="capitalize">
        {status}
      </StatusBadge>
    );
  };

  // Rollup Aggregations across all initiatives for summary banner
  const totalBudget = initiatives.reduce((sum, item) => sum + (item.rollup.budget_amount || 0), 0);
  const totalSpent = initiatives.reduce((sum, item) => sum + (item.rollup.actual_spent_amount || 0), 0);
  const totalPoints = initiatives.reduce((sum, item) => sum + (item.rollup.total_points || 0), 0);
  const totalCompletedPoints = initiatives.reduce((sum, item) => sum + (item.rollup.completed_points || 0), 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-5 max-w-7xl w-full mx-auto" data-testid="initiatives-view">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-4 sm:p-5 rounded-xl border border-border shadow-2xs">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="size-5 text-primary shrink-0" />
            <span>Cross-Space Portfolio Initiatives</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Strategic portfolio initiatives uniting epics, features, and multi-team spaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filter initiatives..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8.5 h-8.5 text-xs bg-background"
            />
          </div>

          {canManage && (
            <Button size="sm" className="h-8.5 gap-1.5 shadow-2xs" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              <span>New Initiative</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="size-8.5 p-0 shrink-0"
            onClick={fetchInitiatives}
            title="Refresh initiatives"
            aria-label="Refresh initiatives"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Portfolio Rollup Summary Metric Cards */}
      {!loading && initiatives.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
            <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Initiatives</span>
              <Layers className="size-3.5 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
              {initiatives.length}
            </div>
            <div className="text-2xs text-muted-foreground mt-0.5">
              {initiatives.filter((i) => i.rollup.health === 'on_track').length} On Track
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
            <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Points Delivered</span>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-primary mt-1">
              {totalCompletedPoints} <span className="text-xs text-muted-foreground font-normal">/ {totalPoints}</span>
            </div>
            <div className="text-2xs text-muted-foreground mt-0.5">
              {totalPoints > 0 ? Math.round((totalCompletedPoints / totalPoints) * 100) : 0}% completion rate
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
            <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Portfolio Budget</span>
              <DollarSign className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
              ${totalBudget.toLocaleString()}
            </div>
            <div className="text-2xs text-muted-foreground mt-0.5">
              Allocated across spaces
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
            <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Financial Burn</span>
              <TrendingUp className="size-3.5 text-info" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
              ${totalSpent.toLocaleString()}
            </div>
            <div className="text-2xs text-muted-foreground mt-0.5">
              {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of budget spent
            </div>
          </div>
        </div>
      )}

      {/* Main content grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground bg-card rounded-xl border border-border">
          <RefreshCw className="size-5 animate-spin mr-2 text-primary" />
          Loading portfolio initiatives...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border p-8 text-center bg-card shadow-2xs">
          <Layers className="size-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No initiatives found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Initiatives span across spaces to aggregate epics into high-level business goals with financial budget tracking.
          </p>
          {canManage && (
            <Button size="sm" className="mt-4 gap-1.5 shadow-2xs" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              Create First Initiative
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filtered.map((init) => {
            const rollup = init.rollup;
            return (
              <div
                key={init.id}
                className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-2xs"
                onClick={() => openDetail(init.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                      {init.key}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {getHealthBadge(rollup.health)}
                      {getStatusBadge(init.status)}
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {init.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed min-h-[2rem]">
                    {init.description || <span className="italic opacity-60">No description provided</span>}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                        Delivery Progress
                      </span>
                      <span className="font-semibold font-mono text-foreground">{rollup.progress_percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted/70 rounded-full overflow-hidden p-0.5 border border-border/40">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, rollup.progress_percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-2xs text-muted-foreground pt-0.5">
                      <span>{rollup.completed_points} / {rollup.total_points} pts</span>
                      <span>{rollup.completed_issues} / {rollup.total_issues} tasks</span>
                    </div>
                  </div>

                  {/* Budget Burn */}
                  {rollup.budget_amount && rollup.budget_amount > 0 ? (
                    <div className="mt-3.5 p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                        <DollarSign className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        Spend / Budget:
                      </span>
                      <span className="font-semibold font-mono text-foreground">
                        ${rollup.actual_spent_amount.toLocaleString()} / ${rollup.budget_amount.toLocaleString()}
                        {rollup.budget_burn_percentage !== null && (
                          <span className="ml-1.5 text-2xs text-muted-foreground font-normal">
                            ({rollup.budget_burn_percentage}%)
                          </span>
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-2xs font-medium bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
                    <Calendar className="size-3 text-muted-foreground/70" />
                    <span>{init.target_quarter || 'No Target'}</span>
                  </div>
                  {init.owner_name && (
                    <span className="truncate max-w-[130px] text-2xs font-medium text-foreground/80">
                      {init.owner_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Initiative Detail & Settings Modal */}
      <Dialog open={Boolean(selectedInitiative)} onOpenChange={(open) => !open && setSelectedInitiative(null)}>
        <DialogContent className="sm:max-w-2xl max-w-[calc(100%-2rem)]">
          <DialogHeader className="border-b border-border pb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 pr-6 sm:pr-0">
                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                  {selectedInitiative?.key}
                </span>
                <DialogTitle className="text-base font-semibold truncate text-foreground">
                  {selectedInitiative?.title}
                </DialogTitle>
                {detailLoading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
              </div>
              {selectedInitiative && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {getHealthBadge(selectedInitiative.rollup.health)}
                  {getStatusBadge(selectedInitiative.status)}
                </div>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Cross-space portfolio initiative aggregating epics, delivery velocity, and budgets.
            </DialogDescription>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-border/50 mt-2">
              <button
                type="button"
                onClick={() => setModalTab('overview')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  modalTab === 'overview'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Overview
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setModalTab('settings')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                    modalTab === 'settings'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Settings className="size-3" />
                  Initiative Settings
                </button>
              )}
            </div>
          </DialogHeader>

          {selectedInitiative && (
            <DialogBody className="space-y-4 py-4">
              {modalTab === 'overview' ? (
                <>
                  {selectedInitiative.description && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground leading-relaxed">
                      {selectedInitiative.description}
                    </div>
                  )}

                  {/* Progress & Financial Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Story Points Progress
                      </span>
                      <div className="text-xl font-bold font-mono text-primary">
                        {selectedInitiative.rollup.progress_percentage}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedInitiative.rollup.completed_points} of {selectedInitiative.rollup.total_points} pts delivered ({selectedInitiative.rollup.completed_issues}/{selectedInitiative.rollup.total_issues} tasks)
                      </p>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden mt-2 border border-border/40">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, selectedInitiative.rollup.progress_percentage)}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Financial Cost Burn
                      </span>
                      <div className="text-xl font-bold font-mono text-foreground">
                        ${selectedInitiative.rollup.actual_spent_amount.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Budget: ${selectedInitiative.rollup.budget_amount ? selectedInitiative.rollup.budget_amount.toLocaleString() : 'Not set'}
                        {selectedInitiative.rollup.budget_burn_percentage !== null && (
                          <span className="ml-1.5 font-medium text-foreground">
                            ({selectedInitiative.rollup.budget_burn_percentage}% burn)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Contributing Spaces */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Building2 className="size-3.5" />
                      Contributing Spaces ({selectedInitiative.contributing_spaces.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedInitiative.contributing_spaces.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No spaces mapped yet.</span>
                      ) : (
                        selectedInitiative.contributing_spaces.map((sp) => (
                          <span key={sp.id} className="text-xs px-2.5 py-1 rounded-md bg-muted/70 text-foreground font-medium border border-border/60">
                            {sp.key}: {sp.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Linked Issues */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <LinkIcon className="size-3.5" />
                        Linked Epics & Issues ({selectedInitiative.linked_issues.length})
                      </h4>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6.5 px-2.5 text-xs gap-1 shadow-2xs"
                          onClick={() => setShowLinkIssue(true)}
                        >
                          <Plus className="size-3" />
                          Link Issue
                        </Button>
                      )}
                    </div>

                    {selectedInitiative.linked_issues.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/10">
                        No epics or tasks linked to this initiative yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {selectedInitiative.linked_issues.map((iss) => (
                          <div
                            key={iss.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs hover:bg-muted/30 transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold font-mono text-primary shrink-0">{iss.key}</span>
                              <span className="truncate font-medium text-foreground">{iss.title}</span>
                              <span className="text-2xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border/40 shrink-0">
                                {iss.space_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <StatusBadge tone={iss.status_category === 'done' ? 'success' : 'neutral'}>
                                {iss.status_name}
                              </StatusBadge>
                              {iss.story_points && (
                                <span className="text-xs font-mono font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                                  {iss.story_points} pt
                                </span>
                              )}
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleUnlinkIssue(iss.id)}
                                  title="Unlink from initiative"
                                  aria-label={`Unlink ${iss.key}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Settings / Edit Mode */
                <form id="initiative-settings-form" onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-init-title" className="text-xs font-medium">Initiative Title</Label>
                    <Input
                      id="edit-init-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Modern Cloud Infrastructure"
                      className="h-8.5 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-init-desc" className="text-xs font-medium">Description</Label>
                    <Textarea
                      id="edit-init-desc"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Strategic goals and cross-space outcomes..."
                      className="text-xs h-20 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-init-status" className="text-xs font-medium">Status</Label>
                      <Select
                        value={editStatus}
                        onValueChange={(val) => setEditStatus(val as InitiativeStatus)}
                      >
                        <SelectTrigger id="edit-init-status" className="h-8.5 text-xs">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-init-quarter" className="text-xs font-medium">Target Quarter</Label>
                      <Input
                        id="edit-init-quarter"
                        value={editQuarter}
                        onChange={(e) => setEditQuarter(e.target.value)}
                        placeholder="2026-Q4"
                        className="h-8.5 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-init-budget" className="text-xs font-medium">Budget ($)</Label>
                      <Input
                        id="edit-init-budget"
                        type="number"
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        placeholder="50000"
                        className="h-8.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-init-start" className="text-xs font-medium">Start Date</Label>
                      <Input
                        id="edit-init-start"
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="h-8.5 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-init-target" className="text-xs font-medium">Target Date</Label>
                      <Input
                        id="edit-init-target"
                        type="date"
                        value={editTargetDate}
                        onChange={(e) => setEditTargetDate(e.target.value)}
                        className="h-8.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" size="sm" disabled={savingSettings} className="gap-1.5 shadow-2xs">
                      {savingSettings && <RefreshCw className="size-3.5 animate-spin" />}
                      Save Settings
                    </Button>
                  </div>

                  {/* Danger Zone */}
                  <div className="mt-6 pt-4 border-t border-destructive/20 rounded-lg p-3.5 bg-destructive/5 space-y-2">
                    <h5 className="text-xs font-bold text-destructive uppercase tracking-wider">Danger Zone</h5>
                    <p className="text-2xs text-muted-foreground">
                      Deleting this initiative will remove all portfolio rollups and space mappings. Linked issues will remain untouched.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-1 gap-1.5"
                      onClick={() => setConfirmDeleteId(selectedInitiative.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete Initiative
                    </Button>
                  </div>
                </form>
              )}
            </DialogBody>
          )}

          <DialogFooter className="border-t border-border pt-3">
            {canManage && modalTab === 'overview' && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 mr-auto"
                onClick={() => selectedInitiative && setConfirmDeleteId(selectedInitiative.id)}
              >
                <Trash2 className="size-3.5" />
                Delete Initiative
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSelectedInitiative(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Initiative Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Plus className="size-4 text-primary" />
              Create Portfolio Initiative
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a cross-space strategic portfolio initiative with target milestones and budget.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3.5 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <Label htmlFor="init-key" className="text-xs font-medium">Key</Label>
                <Input
                  id="init-key"
                  placeholder="INIT-1"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  className="h-8.5 text-xs font-mono"
                  required
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="init-title" className="text-xs font-medium">Title</Label>
                <Input
                  id="init-title"
                  placeholder="e.g. Modern Cloud Infrastructure"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8.5 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="init-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="init-desc"
                placeholder="Strategic outcomes and milestone objectives..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-xs h-18 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="init-qtr" className="text-xs font-medium">Target Quarter</Label>
                <Input
                  id="init-qtr"
                  placeholder="2026-Q4"
                  value={newQuarter}
                  onChange={(e) => setNewQuarter(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="init-budget" className="text-xs font-medium">Budget ($)</Label>
                <Input
                  id="init-budget"
                  type="number"
                  placeholder="50000"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="init-start" className="text-xs font-medium">Start Date</Label>
                <Input
                  id="init-start"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="init-target" className="text-xs font-medium">Target Date</Label>
                <Input
                  id="init-target"
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>
            </div>

            {spaces.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Contributing Spaces</Label>
                  <span className="text-2xs text-muted-foreground">
                    {selectedSpaceIds.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
                  {spaces.map((sp) => {
                    const isSelected = selectedSpaceIds.includes(sp.id);
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          setSelectedSpaceIds((prev) =>
                            isSelected ? prev.filter((id) => id !== sp.id) : [...prev, sp.id]
                          )
                        }
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md border font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                            : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="font-mono text-2xs">{sp.key}</span>
                        <span>·</span>
                        <span className="truncate max-w-[120px]">{sp.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5 shadow-2xs">
              {creating && <RefreshCw className="size-3.5 animate-spin" />}
              Create Initiative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Issue Modal */}
      <Dialog open={showLinkIssue} onOpenChange={setShowLinkIssue}>
        <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <LinkIcon className="size-4 text-primary" />
              Link Issues to Initiative
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Associate epics or tasks across project spaces to aggregate progress and burndown.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="issue-ids" className="text-xs font-medium">
                Issue IDs or Keys (comma separated)
              </Label>
              <Input
                id="issue-ids"
                placeholder="e.g. BACK-101, FRONT-42"
                value={issueIdsInput}
                onChange={(e) => setIssueIdsInput(e.target.value)}
                className="h-8.5 text-xs font-mono"
              />
              <p className="text-2xs text-muted-foreground">
                Enter one or more issue IDs or keys separated by commas.
              </p>
            </div>
          </DialogBody>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowLinkIssue(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleLinkIssues} disabled={linkingIssues} className="gap-1.5 shadow-2xs">
              {linkingIssues && <RefreshCw className="size-3.5 animate-spin" />}
              Link Issues
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete Portfolio Initiative"
        description="Are you sure you want to delete this initiative? This action will permanently remove all cross-space rollups and financial tracking. Linked issues will remain untouched in their respective project spaces."
        confirmLabel="Delete Initiative"
        destructive
        loading={deleting}
        onConfirm={() => {
          if (confirmDeleteId) return handleDelete(confirmDeleteId);
        }}
      />
    </div>
  );
};

export default InitiativesView;
