import { useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  ArrowRight,
  Cloud,
  Copy,
  Info,
  Layers,
  Loader2,
  Lock,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addMemberApi,
  fetchGovernanceApi,
  fetchMembersApi,
  removeMemberApi,
  updateGovernanceApi,
  updateMemberApi,
  updateWorkspaceApi,
} from '@/api/workspaces';
import {
  deleteWorkflowTemplateApi,
  fetchWorkflowTemplatesApi,
} from '@/api/workflow';
import { useAppSelector } from '@/app/hooks';
import { assignableRoles, canManageMember } from '@/lib/workspaceRules';
import {
  canManageWorkspace,
  type GovernanceSettings,
  type MemberSummary,
  type StageColor,
  type WorkspaceRole,
  type WorkspaceTree,
} from '@/types';
import type { WorkflowTemplateSummary } from '@/types/workflow';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { errorMessage, humanize } from '../presentation';
import { StorageSection } from './StorageSection';

export interface WorkspaceSettingsProps {
  workspaceId: string;
  tree: WorkspaceTree;
  role: WorkspaceRole;
  onChanged: () => Promise<unknown>;
}

type WorkspaceSettingsSection = 'governance' | 'templates' | 'general' | 'members' | 'storage';

const nameOf = (m: MemberSummary) => `${m.first_name} ${m.last_name}`.trim() || m.email;

/**
 * 1. Governance & Project Defaults Section
 * Configures default templates, mandatory charters, epic rules, and inactivity thresholds.
 */
const GovernanceSection = ({
  workspaceId,
  manage,
}: {
  workspaceId: string;
  manage: boolean;
}) => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);

  // Form states
  const [defaultTemplate, setDefaultTemplate] = useState('default');
  const [requireCharter, setRequireCharter] = useState(false);
  const [requireEpicOwner, setRequireEpicOwner] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(90);

  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchGovernanceApi(workspaceId),
      fetchWorkflowTemplatesApi(workspaceId),
    ])
      .then(([gov, tmpls]) => {
        if (cancelled) return;
        setTemplates(tmpls);
        setDefaultTemplate(gov.default_workflow_template || 'default');
        setRequireCharter(gov.require_space_charter);
        setRequireEpicOwner(gov.require_epic_owner_and_criteria);
        setInactiveDays(gov.inactive_after_days);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(`Failed to load governance settings: ${errorMessage(err)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!manage) return;

    if (inactiveDays < 7 || inactiveDays > 3650) {
      toast.error('Inactivity threshold must be between 7 and 3,650 days.');
      return;
    }

    startSaving(async () => {
      try {
        await updateGovernanceApi(workspaceId, {
          default_workflow_template: defaultTemplate,
          require_space_charter: requireCharter,
          require_epic_owner_and_criteria: requireEpicOwner,
          inactive_after_days: Number(inactiveDays),
        });
        toast.success('Common project governance settings updated successfully.');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  const selectedTemplateObj = templates.find(
    (t) =>
      t.key === defaultTemplate ||
      t.id === defaultTemplate ||
      t.id === `builtin:${defaultTemplate}`,
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Project Governance & Defaults</h2>
          <p className="text-xs text-muted-foreground">
            Enforce standard rules, workflows, and mandatory criteria across all project spaces in this workspace.
          </p>
        </div>
        {manage && (
          <Button type="submit" disabled={saving} size="sm" className="mt-2 sm:mt-0">
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
            Save Governance
          </Button>
        )}
      </div>

      {!manage && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <span>You have read-only access. Only workspace admins and owners can modify common project governance.</span>
        </div>
      )}

      {/* New Space Default Workflow Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Workflow Template</CardTitle>
          <CardDescription>
            Choose the baseline workflow stages that every newly created project space will inherit by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="default-template-select">Default Template</Label>
            <Select
              disabled={!manage || saving}
              value={defaultTemplate}
              onValueChange={setDefaultTemplate}
            >
              <SelectTrigger id="default-template-select">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.key || tpl.id}>
                    {tpl.name} {tpl.builtin ? '(Built-in)' : '(Custom)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplateObj && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {selectedTemplateObj.name}
                </span>
                <span className="text-2xs text-muted-foreground uppercase font-mono">
                  {selectedTemplateObj.definition.stages.length} Stages ·{' '}
                  {selectedTemplateObj.definition.transition_mode === 'any' ? 'Any-to-Any' : 'Restricted'}
                </span>
              </div>
              {selectedTemplateObj.description && (
                <p className="text-xs text-muted-foreground">{selectedTemplateObj.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {selectedTemplateObj.definition.stages.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <StatusBadge tone={(stage.color as StageColor) || 'neutral'}>
                      {stage.name}
                    </StatusBadge>
                    {idx < selectedTemplateObj.definition.stages.length - 1 && (
                      <ArrowRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mandatory Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mandatory Project Standards</CardTitle>
          <CardDescription>
            Configure strict compliance checks for newly created project spaces and epics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="toggle-charter" className="text-sm font-medium leading-none cursor-pointer">
                Require Project Space Charter
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, creating a new space requires an explicit owner, delivery method, project objective,
                success measure, and reuse justification.
              </p>
            </div>
            <Switch
              id="toggle-charter"
              disabled={!manage || saving}
              checked={requireCharter}
              onCheckedChange={setRequireCharter}
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-4 border-t">
            <div className="space-y-1">
              <Label htmlFor="toggle-epic-criteria" className="text-sm font-medium leading-none cursor-pointer">
                Require Epic Owner & Completion Criteria
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, every epic created or converted in any project must have an assigned owner and clear
                completion criteria.
              </p>
            </div>
            <Switch
              id="toggle-epic-criteria"
              disabled={!manage || saving}
              checked={requireEpicOwner}
              onCheckedChange={setRequireEpicOwner}
            />
          </div>
        </CardContent>
      </Card>

      {/* Container Inactivity & Hygiene */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Container Inactivity Threshold</CardTitle>
          <CardDescription>
            Determine when stale spaces, folders, and lists are flagged for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-xs">
            <Label htmlFor="inactive-days-input">Inactive After (Days)</Label>
            <Input
              id="inactive-days-input"
              type="number"
              min={7}
              max={3650}
              disabled={!manage || saving}
              value={inactiveDays}
              onChange={(e) => setInactiveDays(Number(e.target.value))}
              required
            />
            <p className="text-2xs text-muted-foreground">
              Spaces, folders, or lists with no issue updates for this number of days will appear as inactive in
              inventory reports (7–3,650 days).
            </p>
          </div>
        </CardContent>
      </Card>

      {manage && (
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Governance Settings
          </Button>
        </div>
      )}
    </form>
  );
};

/**
 * 2. Shared Workflow Templates Section
 * Lists standard built-in and workspace-custom workflow templates with stage previews.
 */
const TemplatesSection = ({
  workspaceId,
  manage,
}: {
  workspaceId: string;
  manage: boolean;
}) => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [governance, setGovernance] = useState<GovernanceSettings | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchWorkflowTemplatesApi(workspaceId),
      fetchGovernanceApi(workspaceId),
    ])
      .then(([tmpls, gov]) => {
        setTemplates(tmpls);
        setGovernance(gov);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        toast.error(`Failed to load templates: ${errorMessage(err)}`);
      });
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleDelete = (templateId: string) => {
    startDeleteTransition(async () => {
      try {
        await deleteWorkflowTemplateApi(workspaceId, templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        toast.success('Custom workflow template removed.');
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const defaultKey = governance?.default_workflow_template || 'default';

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-lg font-semibold tracking-tight">Shared Workflow Templates</h2>
        <p className="text-xs text-muted-foreground">
          Workflow templates standardize stage progressions and status flows across all projects.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-medium text-foreground">Template Inheritance: </span>
          When a teammate creates a new project space, it will start with the current Workspace Default template.
          Individual project spaces can customize their own stages anytime in Project Settings.
        </div>
      </div>

      <div className="grid gap-4">
        {templates.map((tpl) => {
          const isDefault =
            tpl.key === defaultKey ||
            tpl.id === defaultKey ||
            tpl.id === `builtin:${defaultKey}`;

          return (
            <Card key={tpl.id} className={cn(isDefault && 'border-primary/50 shadow-xs')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">{tpl.name}</CardTitle>
                      {tpl.builtin ? (
                        <StatusBadge tone="neutral">Built-in</StatusBadge>
                      ) : (
                        <StatusBadge tone="info">Custom</StatusBadge>
                      )}
                      {isDefault && (
                        <StatusBadge tone="primary">Workspace Default</StatusBadge>
                      )}
                    </div>
                    {tpl.description && (
                      <CardDescription className="text-xs">{tpl.description}</CardDescription>
                    )}
                  </div>

                  {!tpl.builtin && manage && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={isDeleting || isDefault}
                      title={isDefault ? 'Cannot delete default template' : 'Delete template'}
                      onClick={() => setDeletingId(tpl.id)}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-2.5">
                  {tpl.definition.stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <StatusBadge tone={(stage.color as StageColor) || 'neutral'}>
                        {stage.name}
                      </StatusBadge>
                      {idx < tpl.definition.stages.length - 1 && (
                        <ArrowRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-2xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Transitions: </span>
                    {tpl.definition.transition_mode === 'any' ? 'Any stage to any other' : 'Defined matrix'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">WIP Policy: </span>
                    {tpl.definition.wip_policy}
                  </div>
                  {tpl.created_by && (
                    <div>
                      <span className="font-medium text-foreground">Created by: </span>
                      {tpl.created_by.display_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete workflow template?"
        description="Existing project spaces built with this template will not be affected, but it will no longer be available for new spaces."
        confirmLabel="Delete Template"
        destructive
        loading={isDeleting}
        onConfirm={() => {
          if (deletingId) handleDelete(deletingId);
        }}
      />
    </div>
  );
};

/**
 * 3. General Workspace Details Section
 * Manages workspace name and slug.
 */
const GeneralSection = ({
  workspaceId,
  tree,
  manage,
  onChanged,
}: {
  workspaceId: string;
  tree: WorkspaceTree;
  manage: boolean;
  onChanged: () => Promise<unknown>;
}) => {
  const [name, setName] = useState(tree.name);
  const [slug, setSlug] = useState(tree.slug);
  const [saving, startSaving] = useTransition();

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!manage) return;

    startSaving(async () => {
      try {
        await updateWorkspaceApi(workspaceId, {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
        });
        await onChanged();
        toast.success('Workspace details updated successfully.');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  const copyId = () => {
    navigator.clipboard.writeText(workspaceId);
    toast.success('Workspace ID copied to clipboard.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-lg font-semibold tracking-tight">General Workspace Details</h2>
        <p className="text-xs text-muted-foreground">
          Update the display name and URL identifier for this workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Identity</CardTitle>
          <CardDescription>
            These details identify this workspace for all team members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="workspace-name-input">Workspace Name</Label>
            <Input
              id="workspace-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!manage || saving}
              maxLength={100}
              required
            />
          </div>

          <div className="grid gap-2 max-w-md">
            <Label htmlFor="workspace-slug-input">URL Slug</Label>
            <Input
              id="workspace-slug-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={!manage || saving}
              maxLength={50}
              required
            />
            <p className="text-2xs text-muted-foreground">
              Used in vanity URLs and exports. Lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="grid gap-2 max-w-md">
            <Label htmlFor="workspace-id-display">Workspace ID</Label>
            <div className="flex items-center gap-2">
              <Input
                id="workspace-id-display"
                value={workspaceId}
                readOnly
                className="bg-muted font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyId}
                title="Copy Workspace ID"
                aria-label="Copy Workspace ID"
              >
                <Copy className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs text-muted-foreground mr-2">Your Role:</span>
            <StatusBadge tone="neutral">{humanize(tree.role)}</StatusBadge>
          </div>
        </CardContent>
      </Card>

      {manage && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      )}
    </form>
  );
};

/**
 * 4. Team Members & Permissions Section
 * Manages tenant-level members and their roles.
 */
const MembersSection = ({
  workspaceId,
  role,
  manage,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  manage: boolean;
}) => {
  const me = useAppSelector((state) => state.auth.user?.id);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite member state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<WorkspaceRole>('member');
  const [isAdding, startAddTransition] = useTransition();

  // Remove member state
  const [confirmingRemove, setConfirmingRemove] = useState<MemberSummary | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchMembersApi(workspaceId)
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(`Failed to load members: ${errorMessage(err)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const callerRole = members.find((m) => m.user_id === me)?.role ?? role;
  const offeredRoles = assignableRoles(callerRole);

  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !manage) return;

    startAddTransition(async () => {
      try {
        const added = await addMemberApi(workspaceId, {
          email: newEmail.trim(),
          role: newRole,
        });
        setMembers((prev) => [...prev, added]);
        setNewEmail('');
        setNewRole('member');
        toast.success(`${added.email} added to workspace.`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  };

  const handleRoleChange = async (member: MemberSummary, nextRole: WorkspaceRole) => {
    try {
      const updated = await updateMemberApi(workspaceId, member.user_id, { role: nextRole });
      setMembers((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
      toast.success(`${nameOf(updated)} updated to ${humanize(updated.role)}.`);
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
        toast.success(`${nameOf(confirmingRemove)} removed from workspace.`);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setConfirmingRemove(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-lg font-semibold tracking-tight">Team Members & Permissions</h2>
        <p className="text-xs text-muted-foreground">
          Manage teammates who have access to this workspace and its projects.
        </p>
      </div>

      {manage && offeredRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Teammate</CardTitle>
            <CardDescription>
              Add a teammate to this workspace. They will automatically gain access to all projects in it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5 flex-1">
                <Label htmlFor="invite-email-input">Email Address</Label>
                <Input
                  id="invite-email-input"
                  type="email"
                  placeholder="colleague@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isAdding}
                  required
                />
              </div>

              <div className="grid gap-1.5 w-full sm:w-40">
                <Label htmlFor="invite-role-select">Role</Label>
                <Select
                  value={newRole}
                  onValueChange={(val) => setNewRole(val as WorkspaceRole)}
                  disabled={isAdding}
                >
                  <SelectTrigger id="invite-role-select">
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
                {isAdding ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <UserPlus className="size-4 mr-1.5" />
                )}
                Add Member
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Members ({members.length})</CardTitle>
          <CardDescription>All users with active roles in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {members.map((m) => {
              const canEditThisMember = canManageMember(callerRole, m.role) && m.user_id !== me;

              return (
                <div key={m.user_id} className="flex items-center justify-between py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{nameOf(m)}</span>
                      {m.user_id === me && (
                        <span className="text-2xs rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEditThisMember ? (
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
                      <StatusBadge tone="neutral">{humanize(m.role)}</StatusBadge>
                    )}

                    {canEditThisMember && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${nameOf(m)}`}
                        onClick={() => setConfirmingRemove(m)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmingRemove)}
        onOpenChange={(open) => !open && setConfirmingRemove(null)}
        title={`Remove ${confirmingRemove ? nameOf(confirmingRemove) : ''} from workspace?`}
        description="They will immediately lose access to all project spaces, lists, and boards in this workspace."
        confirmLabel="Remove Member"
        destructive
        loading={isRemoving}
        onConfirm={handleExecuteRemove}
      />
    </div>
  );
};

/**
 * Common Workspace / Project Settings Hub Component
 */
export const WorkspaceSettings = ({
  workspaceId,
  tree,
  role,
  onChanged,
}: WorkspaceSettingsProps) => {
  const [section, setSection] = useState<WorkspaceSettingsSection>('governance');
  const manage = canManageWorkspace(role);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start max-w-6xl w-full mx-auto">
      {/* Settings Navigation Sidebar */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-xl border bg-card p-2 shadow-2xs">
          <div className="px-3 py-2 border-b mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Common Settings
            </h3>
            <p className="text-2xs text-muted-foreground truncate">{tree.name}</p>
          </div>
          <nav aria-label="Common settings navigation" className="space-y-1">
            <button
              type="button"
              onClick={() => setSection('governance')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                section === 'governance'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              <span>Project Governance & Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => setSection('templates')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                section === 'templates'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Layers className="size-4 shrink-0" aria-hidden="true" />
              <span>Shared Workflow Templates</span>
            </button>

            <button
              type="button"
              onClick={() => setSection('general')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                section === 'general'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Settings className="size-4 shrink-0" aria-hidden="true" />
              <span>General Workspace Details</span>
            </button>

            <button
              type="button"
              onClick={() => setSection('members')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                section === 'members'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Users className="size-4 shrink-0" aria-hidden="true" />
              <span>Members & Permissions</span>
            </button>

            <button
              type="button"
              onClick={() => setSection('storage')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                section === 'storage'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Cloud className="size-4 shrink-0" aria-hidden="true" />
              <span>Storage & Cloud (MCP)</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Settings Content Area */}
      <div className="min-w-0 flex-1">
        {section === 'governance' && (
          <GovernanceSection
            key={workspaceId + '-gov'}
            workspaceId={workspaceId}
            manage={manage}
          />
        )}

        {section === 'templates' && (
          <TemplatesSection
            key={workspaceId + '-tpl'}
            workspaceId={workspaceId}
            manage={manage}
          />
        )}

        {section === 'general' && (
          <GeneralSection
            key={workspaceId + tree.name}
            workspaceId={workspaceId}
            tree={tree}
            manage={manage}
            onChanged={onChanged}
          />
        )}

        {section === 'members' && (
          <MembersSection
            key={workspaceId + '-mem'}
            workspaceId={workspaceId}
            role={role}
            manage={manage}
          />
        )}

        {section === 'storage' && (
          <StorageSection workspaceId={workspaceId} manage={manage} />
        )}
      </div>
    </div>
  );
};

export default WorkspaceSettings;
