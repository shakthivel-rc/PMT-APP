import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import type { SpaceNode } from '@/types';
import type { WorkflowDefinition, WorkflowPreview } from '@/types/workflow';
import WorkflowEditor from './WorkflowEditor';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const mockSpace: SpaceNode = {
  id: 'sp1',
  name: 'Core Platform',
  key: 'COR',
  description: 'Main platform backend services',
  owner: null,
  delivery_method: 'scrum',
  has_charter: false,
  archived: false,
  archived_at: null,
  frozen: false,
  freeze_reason: null,
  statuses: [],
  workflow: {
    version: 1,
    transition_mode: 'any',
    initial_status_id: 'st-todo',
    wip_policy: 'warn',
    merge_action: { mode: 'status', target_status_id: 'st-done' },
    transitions: [],
  },
  can_edit_workflow: true,
  folders: [],
  lists: [],
};

const mockWorkflow: WorkflowDefinition = {
  space_id: 'sp1',
  version: 2,
  transition_mode: 'any',
  initial_status_id: 'st-todo',
  wip_policy: 'warn',
  merge_action: { mode: 'status', target_status_id: 'st-done' },
  stages: [
    {
      id: 'st-todo',
      name: 'To Do',
      category: 'todo',
      color: 'neutral',
      position: 0,
      counts_toward_wip: false,
      wip_limit: null,
      issue_count: 3,
      wip_count: 0,
    },
    {
      id: 'st-prog',
      name: 'In Progress',
      category: 'in_progress',
      color: 'primary',
      position: 1,
      counts_toward_wip: true,
      wip_limit: 5,
      issue_count: 2,
      wip_count: 2,
    },
    {
      id: 'st-done',
      name: 'Done',
      category: 'done',
      color: 'success',
      position: 2,
      counts_toward_wip: false,
      wip_limit: null,
      issue_count: 10,
      wip_count: 0,
    },
  ],
  transitions: [],
  can_edit: true,
  editors: [],
};

describe('<WorkflowEditor>', () => {
  it('renders stages and board column list', async () => {
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok(mockWorkflow)),
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
    );

    renderWithProviders(
      <WorkflowEditor workspaceId="w1" space={mockSpace} role="admin" onPublished={vi.fn()} />,
    );

    expect(await screen.findByText('Space Workflow Configuration')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('allows adding a new stage to draft and shows Unsaved Draft badge', async () => {
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok(mockWorkflow)),
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <WorkflowEditor workspaceId="w1" space={mockSpace} role="admin" onPublished={vi.fn()} />,
    );

    expect(await screen.findByText('To Do')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /add stage/i });
    await user.click(addBtn);

    const nameInput = screen.getByLabelText(/stage name/i);
    await user.type(nameInput, 'QA Verification');

    const saveBtn = screen.getByRole('button', { name: /add stage/i });
    await user.click(saveBtn);

    expect(screen.getByText('QA Verification')).toBeInTheDocument();
    expect(screen.getByText('Unsaved Draft')).toBeInTheDocument();
  });

  it('allows changing color badge when adding a new stage', async () => {
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok(mockWorkflow)),
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <WorkflowEditor workspaceId="w1" space={mockSpace} role="admin" onPublished={vi.fn()} />,
    );

    expect(await screen.findByText('To Do')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /add stage/i });
    await user.click(addBtn);

    const nameInput = screen.getByLabelText(/stage name/i);
    await user.type(nameInput, 'Security Review');

    const warningColorBtn = screen.getByRole('radio', { name: /warning \(amber\)/i });
    await user.click(warningColorBtn);
    expect(warningColorBtn).toHaveAttribute('aria-checked', 'true');

    const saveBtn = screen.getByRole('button', { name: /add stage/i });
    await user.click(saveBtn);

    expect(screen.getByText('Security Review')).toBeInTheDocument();
    expect(screen.getByText('Unsaved Draft')).toBeInTheDocument();
  });

  it('runs preview and publishes workflow successfully', async () => {
    const onPublished = vi.fn();
    const mockPreview: WorkflowPreview = {
      valid: true,
      errors: [],
      warnings: [],
      stages: [],
      removed: [],
      category_changes: [],
      moves: { total: 0, into_closed: 0, in_active_sprint: 0 },
      transitions: [],
      integration: { mode: 'status', target_ref: 'st-done', target_name: 'Done', valid: true, message: 'ok', unreachable_from: [] },
      affected_issue_count: 0,
      requires_reporting_ack: false,
    };

    server.use(
      http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok(mockWorkflow)),
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
      http.post('*/workspaces/w1/spaces/sp1/workflow/preview', () => ok(mockPreview)),
      http.put('*/workspaces/w1/spaces/sp1/workflow', () =>
        ok({ workflow: { ...mockWorkflow, version: 3 }, moved_issues: 0, version: 3 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <WorkflowEditor workspaceId="w1" space={mockSpace} role="admin" onPublished={onPublished} />,
    );

    expect(await screen.findByText('To Do')).toBeInTheDocument();

    // Trigger a modification to activate review & publish
    const addBtn = screen.getByRole('button', { name: /add stage/i });
    await user.click(addBtn);
    await user.type(screen.getByLabelText(/stage name/i), 'Code Review');
    await user.click(screen.getByRole('button', { name: /add stage/i }));

    const publishBtn = screen.getByRole('button', { name: /review & publish/i });
    await user.click(publishBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/review & publish workflow/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /publish workflow/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onPublished).toHaveBeenCalled();
    });
  });
});
