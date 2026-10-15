import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InitiativesView } from './InitiativesView';
import { initiativesApi } from '@/api/initiatives';
import type { InitiativeResponse, InitiativeDetailResponse, SpaceNode } from '@/types';

vi.mock('@/api/initiatives', () => ({
  initiativesApi: {
    listInitiatives: vi.fn(),
    getInitiative: vi.fn(),
    createInitiative: vi.fn(),
    updateInitiative: vi.fn(),
    deleteInitiative: vi.fn(),
    linkIssues: vi.fn(),
    unlinkIssue: vi.fn(),
  },
}));

const mockSpaces: SpaceNode[] = [
  {
    id: 'space-1',
    name: 'Backend Core',
    key: 'BACK',
    description: 'Main backend services',
    owner: { id: 'u1', display_name: 'Lead Dev' },
    delivery_method: 'scrum',
    has_charter: true,
    archived: false,
    archived_at: null,
    frozen: false,
    freeze_reason: null,
    statuses: [],
    workflow: {
      version: 1,
      transition_mode: 'any',
      initial_status_id: null,
      wip_policy: 'none',
      merge_action: { mode: 'none', target_status_id: null },
      transitions: [],
    },
    can_edit_workflow: true,
    folders: [],
    lists: [],
  },
  {
    id: 'space-2',
    name: 'Web Frontend',
    key: 'FRONT',
    description: 'Web dashboard',
    owner: { id: 'u2', display_name: 'Frontend Lead' },
    delivery_method: 'kanban',
    has_charter: true,
    archived: false,
    archived_at: null,
    frozen: false,
    freeze_reason: null,
    statuses: [],
    workflow: {
      version: 1,
      transition_mode: 'any',
      initial_status_id: null,
      wip_policy: 'none',
      merge_action: { mode: 'none', target_status_id: null },
      transitions: [],
    },
    can_edit_workflow: true,
    folders: [],
    lists: [],
  },
];

const mockInitiatives: InitiativeResponse[] = [
  {
    id: 'init-1',
    workspace_id: 'ws-1',
    key: 'INIT-1',
    title: 'Modern Cloud Infrastructure',
    description: 'Migrate to resilient cloud containers',
    status: 'active',
    owner_id: 'u-1',
    owner_name: 'Lead Architect',
    target_quarter: '2026-Q4',
    budget_amount: 50000,
    start_date: '2026-10-01',
    target_date: '2026-12-31',
    created_by: 'u-1',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-14T00:00:00Z',
    rollup: {
      total_issues: 10,
      completed_issues: 6,
      total_points: 40,
      completed_points: 24,
      progress_percentage: 60,
      budget_amount: 50000,
      actual_spent_amount: 18500,
      budget_burn_percentage: 37,
      health: 'on_track',
    },
  },
];

const mockDetail: InitiativeDetailResponse = {
  ...mockInitiatives[0],
  contributing_spaces: [
    { id: 'space-1', key: 'BACK', name: 'Backend Core' },
    { id: 'space-2', key: 'FRONT', name: 'Web Frontend' },
  ],
  linked_issues: [
    {
      id: 'issue-1',
      key: 'BACK-101',
      title: 'Setup Kubernetes manifests',
      type: 'epic',
      status_name: 'Done',
      status_category: 'done',
      story_points: 13,
      space_id: 'space-1',
      space_name: 'Backend Core',
    },
  ],
};

describe('InitiativesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders portfolio initiatives list and financial rollup metrics', async () => {
    vi.mocked(initiativesApi.listInitiatives).mockResolvedValueOnce({
      data: mockInitiatives,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <InitiativesView
        workspaceId="ws-1"
        role="admin"
        spaces={mockSpaces}
      />
    );

    expect(await screen.findByText('Cross-Space Portfolio Initiatives')).toBeInTheDocument();
    expect(screen.getByText('INIT-1')).toBeInTheDocument();
    expect(screen.getByText('Modern Cloud Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('opens initiative details modal on card click', async () => {
    vi.mocked(initiativesApi.listInitiatives).mockResolvedValueOnce({
      data: mockInitiatives,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(initiativesApi.getInitiative).mockResolvedValueOnce({
      data: mockDetail,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <InitiativesView
        workspaceId="ws-1"
        role="admin"
        spaces={mockSpaces}
      />
    );

    const card = await screen.findByText('Modern Cloud Infrastructure');
    fireEvent.click(card);

    expect(await screen.findByText('Contributing Spaces (2)')).toBeInTheDocument();
    expect(screen.getByText('BACK: Backend Core')).toBeInTheDocument();
    expect(screen.getByText('FRONT: Web Frontend')).toBeInTheDocument();
    expect(screen.getByText('Linked Epics & Issues (1)')).toBeInTheDocument();
    expect(screen.getByText('Setup Kubernetes manifests')).toBeInTheDocument();
  });

  it('switches to Initiative Settings tab and updates initiative', async () => {
    vi.mocked(initiativesApi.listInitiatives).mockResolvedValue({
      data: mockInitiatives,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(initiativesApi.getInitiative).mockResolvedValue({
      data: mockDetail,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(initiativesApi.updateInitiative).mockResolvedValueOnce({
      data: {
        ...mockDetail,
        title: 'Updated Cloud Infrastructure',
      },
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <InitiativesView
        workspaceId="ws-1"
        role="admin"
        spaces={mockSpaces}
      />
    );

    const card = await screen.findByText('Modern Cloud Infrastructure');
    fireEvent.click(card);

    const settingsTab = await screen.findByRole('button', { name: /initiative settings/i });
    fireEvent.click(settingsTab);

    expect(screen.getByLabelText(/initiative title/i)).toHaveValue('Modern Cloud Infrastructure');

    fireEvent.change(screen.getByLabelText(/initiative title/i), {
      target: { value: 'Updated Cloud Infrastructure' },
    });

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    fireEvent.click(saveButton);

    expect(initiativesApi.updateInitiative).toHaveBeenCalledWith(
      'ws-1',
      'init-1',
      expect.objectContaining({
        title: 'Updated Cloud Infrastructure',
      })
    );
  });

  it('triggers delete confirmation dialog and deletes initiative', async () => {
    vi.mocked(initiativesApi.listInitiatives).mockResolvedValue({
      data: mockInitiatives,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(initiativesApi.getInitiative).mockResolvedValue({
      data: mockDetail,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(initiativesApi.deleteInitiative).mockResolvedValueOnce({
      data: null as any,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    const user = userEvent.setup();
    render(
      <InitiativesView
        workspaceId="ws-1"
        role="admin"
        spaces={mockSpaces}
      />
    );

    const card = await screen.findByText('Modern Cloud Infrastructure');
    await user.click(card);

    const deleteBtn = await screen.findByRole('button', { name: /delete initiative/i });
    await user.click(deleteBtn);

    expect(await screen.findByText('Delete Portfolio Initiative')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Delete Initiative' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(initiativesApi.deleteInitiative).toHaveBeenCalledWith('ws-1', 'init-1');
    });
  });
});
