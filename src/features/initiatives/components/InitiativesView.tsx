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
  Trash2,
} from 'lucide-react';
import { initiativesApi } from '@/api/initiatives';
import {
  canManageWorkspace,
  type InitiativeCreate,
  type InitiativeDetailResponse,
  type InitiativeHealth,
  type InitiativeResponse,
  type SpaceNode,
  type WorkspaceRole,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
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

  // Create Dialog
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

  // Link Issues Dialog
  const [showLinkIssue, setShowLinkIssue] = useState(false);
  const [issueIdsInput, setIssueIdsInput] = useState('');
  const [linkingIssues, setLinkingIssues] = useState(false);

  const fetchInitiatives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await initiativesApi.listInitiatives(workspaceId);
      if (res.data) {
        setInitiatives(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load portfolio initiatives');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInitiatives();
  }, [fetchInitiatives]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await initiativesApi.getInitiative(workspaceId, id);
      if (res.data) {
        setSelectedInitiative(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load initiative details');
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
        setSelectedSpaceIds([]);
        fetchInitiatives();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create initiative');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this initiative?')) return;
    try {
      await initiativesApi.deleteInitiative(workspaceId, id);
      toast.success('Initiative deleted');
      if (selectedInitiative?.id === id) {
        setSelectedInitiative(null);
      }
      fetchInitiatives();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete initiative');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to link issues');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink issue');
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

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4" data-testid="initiatives-view">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Cross-Space Portfolio Initiatives
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strategic portfolio initiatives uniting epics, features, and multi-team spaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60 sm:flex-initial">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter initiatives..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {canManage && (
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              New Initiative
            </Button>
          )}

          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={fetchInitiatives}>
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          <RefreshCw className="size-5 animate-spin mr-2" />
          Loading portfolio initiatives...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed p-8 text-center bg-card">
          <Layers className="size-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold">No initiatives found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Initiatives span across spaces to aggregate epics into high-level business goals with financial budget tracking.
          </p>
          {canManage && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              Create First Initiative
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((init) => {
            const rollup = init.rollup;
            return (
              <div
                key={init.id}
                className="flex flex-col justify-between p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors shadow-sm cursor-pointer group"
                onClick={() => openDetail(init.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      {init.key}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getHealthBadge(rollup.health)}
                      <StatusBadge tone="neutral">{init.status}</StatusBadge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                    {init.title}
                  </h3>
                  {init.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {init.description}
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Delivery Progress</span>
                      <span className="font-semibold">{rollup.progress_percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, rollup.progress_percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{rollup.completed_points} / {rollup.total_points} pts</span>
                      <span>{rollup.completed_issues} / {rollup.total_issues} tasks</span>
                    </div>
                  </div>

                  {/* Budget Burn */}
                  {rollup.budget_amount && rollup.budget_amount > 0 ? (
                    <div className="mt-3 p-2 rounded bg-muted/30 border border-border/50 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="size-3.5 text-emerald-500" />
                        Spend / Budget:
                      </span>
                      <span className="font-semibold font-mono">
                        ${rollup.actual_spent_amount.toLocaleString()} / ${rollup.budget_amount.toLocaleString()}
                        {rollup.budget_burn_percentage !== null && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            ({rollup.budget_burn_percentage}%)
                          </span>
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    <span>{init.target_quarter || 'No Target'}</span>
                  </div>
                  {init.owner_name && (
                    <span className="truncate max-w-[120px] font-medium">{init.owner_name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Initiative Detail Drawer / Modal */}
      <Dialog open={Boolean(selectedInitiative)} onOpenChange={(open) => !open && setSelectedInitiative(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                  {selectedInitiative?.key}
                </span>
                <DialogTitle className="text-base truncate flex items-center gap-2">
                  {selectedInitiative?.title}
                  {detailLoading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
                </DialogTitle>
              </div>
              {selectedInitiative && getHealthBadge(selectedInitiative.rollup.health)}
            </div>
          </DialogHeader>

          {selectedInitiative && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {selectedInitiative.description && (
                <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border">
                  {selectedInitiative.description}
                </p>
              )}

              {/* Progress & Financial Overview */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md border bg-card">
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Story Points Progress</span>
                  <div className="text-lg font-bold text-primary mt-0.5">
                    {selectedInitiative.rollup.progress_percentage}%
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selectedInitiative.rollup.completed_points} of {selectedInitiative.rollup.total_points} pts delivered
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground font-medium">Financial Cost Burn</span>
                  <div className="text-lg font-bold text-foreground mt-0.5 font-mono">
                    ${selectedInitiative.rollup.actual_spent_amount.toLocaleString()}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Budget: ${selectedInitiative.rollup.budget_amount ? selectedInitiative.rollup.budget_amount.toLocaleString() : 'Not set'}
                  </span>
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
                      <span key={sp.id} className="text-xs px-2.5 py-1 rounded bg-muted font-medium border">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={() => setShowLinkIssue(true)}
                  >
                    <Plus className="size-3" />
                    Link Issue
                  </Button>
                </div>

                {selectedInitiative.linked_issues.length === 0 ? (
                  <div className="p-4 rounded border text-center text-xs text-muted-foreground bg-muted/10">
                    No epics or tasks linked to this initiative.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {selectedInitiative.linked_issues.map((iss) => (
                      <div
                        key={iss.id}
                        className="flex items-center justify-between p-2 rounded border bg-card text-xs hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-primary">{iss.key}</span>
                          <span className="truncate">{iss.title}</span>
                          <span className="text-[10px] text-muted-foreground px-1 py-0.5 rounded bg-muted">
                            {iss.space_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <StatusBadge tone={iss.status_category === 'done' ? 'success' : 'neutral'}>
                            {iss.status_name}
                          </StatusBadge>
                          {iss.story_points && (
                            <span className="text-xs font-mono font-medium">{iss.story_points}pt</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnlinkIssue(iss.id)}
                            title="Unlink from initiative"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3 flex items-center justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedInitiative && handleDelete(selectedInitiative.id)}
            >
              <Trash2 className="size-3.5 mr-1" />
              Delete Initiative
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedInitiative(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Initiative Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4 text-primary" />
              Create Portfolio Initiative
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="init-key" className="text-xs">Key</Label>
                <Input
                  id="init-key"
                  placeholder="INIT-1"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="init-title" className="text-xs">Title</Label>
                <Input
                  id="init-title"
                  placeholder="e.g. Modern Cloud Infrastructure"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="init-desc" className="text-xs">Description</Label>
              <Textarea
                id="init-desc"
                placeholder="Strategic outcomes and milestone objectives..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-xs h-16 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="init-qtr" className="text-xs">Target Quarter</Label>
                <Input
                  id="init-qtr"
                  placeholder="2026-Q4"
                  value={newQuarter}
                  onChange={(e) => setNewQuarter(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="init-budget" className="text-xs">Budget ($)</Label>
                <Input
                  id="init-budget"
                  type="number"
                  placeholder="50000"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="init-start" className="text-xs">Start Date</Label>
                <Input
                  id="init-start"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="init-target" className="text-xs">Target Date</Label>
                <Input
                  id="init-target"
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {spaces.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Contributing Spaces</Label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 border rounded-md bg-muted/10">
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
                          'px-2 py-0.5 text-xs rounded border transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary font-medium'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        {sp.key} · {sp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <RefreshCw className="size-3.5 animate-spin mr-1" />}
              Create Initiative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Issue Modal */}
      <Dialog open={showLinkIssue} onOpenChange={setShowLinkIssue}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <LinkIcon className="size-4 text-primary" />
              Link Issues to Initiative
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="issue-ids" className="text-xs">
              Issue IDs or Keys (comma separated)
            </Label>
            <Input
              id="issue-ids"
              placeholder="e.g. 2aa99389-..., edc124..."
              value={issueIdsInput}
              onChange={(e) => setIssueIdsInput(e.target.value)}
              className="h-8 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Enter one or more issue IDs to link to this initiative.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowLinkIssue(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleLinkIssues} disabled={linkingIssues}>
              {linkingIssues && <RefreshCw className="size-3.5 animate-spin mr-1" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InitiativesView;
