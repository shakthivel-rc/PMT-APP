import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QuickCreateModal } from './QuickCreateModal';
import type { IssueDetail } from '@/types';
import * as issueApi from '@/api/issues';
import * as workspaceApi from '@/api/workspaces';

const mockDispatch = vi.fn();
let mockIsOpen = true;

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: { ui: { quickCreateOpen: boolean } }) => boolean) =>
    selector({ ui: { quickCreateOpen: mockIsOpen } }),
}));

vi.mock('@/api/workspaces', () => ({
  fetchWorkspacesApi: vi.fn(),
  fetchWorkspaceTreeApi: vi.fn(),
  fetchMembersApi: vi.fn(),
}));

vi.mock('@/api/issues', () => ({
  createIssueApi: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('QuickCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = true;

    vi.mocked(workspaceApi.fetchWorkspacesApi).mockResolvedValue([
      { id: 'ws-1', name: 'Main Workspace', slug: 'main', role: 'admin' },
    ]);

    vi.mocked(workspaceApi.fetchWorkspaceTreeApi).mockResolvedValue({
      id: 'ws-1',
      name: 'Main Workspace',
      slug: 'main',
      role: 'admin',
      spaces: [
        {
          id: 'sp-1',
          name: 'Core Platform',
          key: 'CP',
          description: null,
          owner: null,
          delivery_method: 'kanban',
          has_charter: false,
          archived: false,
          archived_at: null,
          frozen: false,
          freeze_reason: null,
          statuses: [],
          workflow: {
            version: 1,
            transition_mode: 'any',
            initial_status_id: 'st-1',
            wip_policy: 'warn',
            merge_action: { mode: 'none', target_status_id: null },
            transitions: [],
          },
          can_edit_workflow: true,
          folders: [],
          lists: [{ id: 'list-1', name: 'Backlog', folder_id: null, position: 1, archived: false }],
        },
      ],
    });

    vi.mocked(workspaceApi.fetchMembersApi).mockResolvedValue([
      { user_id: 'u-1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', role: 'admin' },
    ]);
  });

  it('renders modal when open and populates workspaces and lists', async () => {
    render(<QuickCreateModal />);

    expect(screen.getByText('New Issue')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Core Platform › Backlog')).toBeInTheDocument();
    });
  });

  it('submits issue when title is filled', async () => {
    vi.mocked(issueApi.createIssueApi).mockResolvedValue({
      value: {
        id: 'iss-1',
        key: 'CP-1',
        title: 'Fix auth session expiration',
        status_id: 'st-1',
        type: 'bug',
        priority: 'high',
        rank: '0|hzzzzz:',
        blocked: false,
        blocked_reason: null,
        created_at: '2026-10-15T12:00:00Z',
        updated_at: '2026-10-15T12:00:00Z',
        version: 1,
        assignee: null,
        sprint_id: null,
        parent_id: null,
        story_points: 3,
        time_spent_seconds: 0,
        time_estimate_seconds: null,
        due_date: null,
      } as unknown as IssueDetail,
      notice: null,
    });

    render(<QuickCreateModal />);

    await waitFor(() => {
      expect(screen.getByText('Core Platform › Backlog')).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText('What needs to be done?');
    fireEvent.change(titleInput, { target: { value: 'Fix auth session expiration' } });

    const submitBtn = screen.getByRole('button', { name: /create issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(issueApi.createIssueApi).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({
          list_id: 'list-1',
          title: 'Fix auth session expiration',
          type: 'task',
        }),
      );
    });
  });

  it('does not render when closed', () => {
    mockIsOpen = false;
    render(<QuickCreateModal />);

    expect(screen.queryByText('New Issue')).not.toBeInTheDocument();
  });
});
