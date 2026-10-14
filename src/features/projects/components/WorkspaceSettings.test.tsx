import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { makeTree } from '@/test/fixtures';
import type { GovernanceSettings, MemberSummary, WorkspaceTree } from '@/types';
import type { WorkflowTemplateSummary } from '@/types/workflow';
import WorkspaceSettings from './WorkspaceSettings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const mockGovernance: GovernanceSettings = {
  default_workflow_template: 'default',
  require_space_charter: false,
  require_epic_owner_and_criteria: true,
  inactive_after_days: 90,
};

const mockTemplates: WorkflowTemplateSummary[] = [
  {
    id: 'builtin:default',
    key: 'default',
    name: 'Default (four stages)',
    description: 'To Do, In Progress, In Review, Done',
    builtin: true,
    created_by: null,
    created_at: null,
    definition: {
      transition_mode: 'any',
      wip_policy: 'warn',
      stages: [
        { name: 'To Do', category: 'todo', color: 'neutral', counts_toward_wip: false },
        { name: 'In Progress', category: 'in_progress', color: 'info', counts_toward_wip: true },
        { name: 'In Review', category: 'in_progress', color: 'primary', counts_toward_wip: true },
        { name: 'Done', category: 'done', color: 'success', counts_toward_wip: false },
      ],
      initial: 0,
      transitions: [],
      merge_target: 3,
    },
  },
  {
    id: 'builtin:delivery',
    key: 'delivery',
    name: 'Feature Delivery',
    description: 'Specialized flow for delivery pipelines',
    builtin: true,
    created_by: null,
    created_at: null,
    definition: {
      transition_mode: 'any',
      wip_policy: 'warn',
      stages: [
        { name: 'Backlog', category: 'todo', color: 'neutral', counts_toward_wip: false },
        { name: 'Developing', category: 'in_progress', color: 'info', counts_toward_wip: true },
        { name: 'Done', category: 'done', color: 'success', counts_toward_wip: false },
      ],
      initial: 0,
      transitions: [],
      merge_target: 2,
    },
  },
  {
    id: 'tmpl-custom-1',
    key: null,
    name: 'Custom Team Agile',
    description: 'Custom team stages',
    builtin: false,
    created_by: { id: 'u1', display_name: 'Lead Architect' },
    created_at: '2026-05-01T10:00:00Z',
    definition: {
      transition_mode: 'any',
      wip_policy: 'warn',
      stages: [
        { name: 'Triaged', category: 'todo', color: 'neutral', counts_toward_wip: false },
        { name: 'Working', category: 'in_progress', color: 'primary', counts_toward_wip: true },
        { name: 'Shipped', category: 'done', color: 'success', counts_toward_wip: false },
      ],
      initial: 0,
      transitions: [],
      merge_target: 2,
    },
  },
];

const mockMembers: MemberSummary[] = [
  {
    user_id: 'u1',
    email: 'admin@acme.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    role: 'owner',
  },
  {
    user_id: 'u2',
    email: 'dev@acme.com',
    first_name: 'Alan',
    last_name: 'Turing',
    role: 'member',
  },
];

describe('<WorkspaceSettings>', () => {
  const tree: WorkspaceTree = makeTree({ id: 'w1', name: 'Acme Engineering', role: 'owner' });
  const onChanged = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get('*/workspaces/w1/settings/governance', () => ok(mockGovernance)),
      http.get('*/workspaces/w1/workflow-templates', () => ok(mockTemplates)),
      http.get('*/workspaces/w1/members', () => ok(mockMembers)),
      http.get('*/workspaces/w1/storage', () =>
        ok({ provider: 'local', fallback_to_local: true, configured: true }),
      ),
    );
  });

  it('renders Project Governance & Defaults by default and loads settings', async () => {
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    expect(await screen.findByRole('heading', { name: 'Project Governance & Defaults' })).toBeInTheDocument();
    expect(screen.getByText('Default Workflow Template')).toBeInTheDocument();
    expect(screen.getByText('Mandatory Project Standards')).toBeInTheDocument();
    expect(screen.getByText('Container Inactivity Threshold')).toBeInTheDocument();
  });

  it('allows updating governance settings', async () => {
    let patchedBody: unknown = null;
    server.use(
      http.patch('*/workspaces/w1/settings/governance', async ({ request }) => {
        patchedBody = await request.json();
        return ok({ ...mockGovernance, ...(patchedBody as object) });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    await screen.findByRole('heading', { name: 'Project Governance & Defaults' });

    // Toggle space charter switch
    const charterSwitch = screen.getByRole('switch', { name: /require project space charter/i });
    await user.click(charterSwitch);

    // Save
    const saveButton = screen.getAllByRole('button', { name: /save governance/i })[0];
    await user.click(saveButton);

    await waitFor(() => {
      expect(patchedBody).toMatchObject({
        require_space_charter: true,
      });
    });
  });

  it('navigates to Shared Workflow Templates and shows built-in and custom templates', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    await screen.findByRole('heading', { name: 'Project Governance & Defaults' });

    // Switch tab
    const templatesTab = screen.getByRole('button', { name: /shared workflow templates/i });
    await user.click(templatesTab);

    expect(await screen.findByRole('heading', { name: 'Shared Workflow Templates' })).toBeInTheDocument();
    expect(screen.getByText('Default (four stages)')).toBeInTheDocument();
    expect(screen.getByText('Feature Delivery')).toBeInTheDocument();
    expect(screen.getByText('Custom Team Agile')).toBeInTheDocument();
    expect(screen.getAllByText('Built-in')).toHaveLength(2);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('navigates to General Workspace Details and displays identity', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    await screen.findByRole('heading', { name: 'Project Governance & Defaults' });

    const generalTab = screen.getByRole('button', { name: /general workspace details/i });
    await user.click(generalTab);

    expect(await screen.findByRole('heading', { name: 'General Workspace Details' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Engineering')).toBeInTheDocument();
    expect(screen.getByDisplayValue('w1')).toBeInTheDocument();
  });

  it('navigates to Team Members and lists members', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    await screen.findByRole('heading', { name: 'Project Governance & Defaults' });

    const membersTab = screen.getByRole('button', { name: /members & permissions/i });
    await user.click(membersTab);

    expect(await screen.findByRole('heading', { name: 'Team Members & Permissions' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
  });

  it('navigates to Storage & Cloud', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="owner" onChanged={onChanged} />,
    );

    await screen.findByRole('heading', { name: 'Project Governance & Defaults' });

    const storageTab = screen.getByRole('button', { name: /storage & cloud/i });
    await user.click(storageTab);

    expect(await screen.findByText(/Storage Provider/i)).toBeInTheDocument();
  });

  it('renders read-only indicator for non-admin roles', async () => {
    renderWithProviders(
      <WorkspaceSettings workspaceId="w1" tree={tree} role="member" onChanged={onChanged} />,
    );

    expect(await screen.findByText(/You have read-only access/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save governance/i })).toBeNull();
  });
});
