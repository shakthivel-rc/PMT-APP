import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TimelineView } from './TimelineView';
import { timelineApi } from '@/api/timeline';
import type { SpaceNode, TimelineResponse } from '@/types';

vi.mock('@/api/timeline', () => ({
  timelineApi: {
    getTimeline: vi.fn(),
    rescheduleIssue: vi.fn(),
  },
}));

const mockSpace: SpaceNode = {
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
  lists: [
    { id: 'list-1', folder_id: null, name: 'Sprint Backlog', position: 1, archived: false },
  ],
};

const mockTimelineData: TimelineResponse = {
  space_id: 'space-1',
  zoom: 'week',
  start_date: '2026-10-01',
  end_date: '2026-10-31',
  items: [
    {
      id: 'issue-1',
      key: 'BACK-101',
      title: 'Database indexing & query optimization',
      type: 'task',
      status_id: 'stg-2',
      status_name: 'In Progress',
      status_category: 'in_progress',
      priority: 'high',
      start_date: '2026-10-10',
      due_date: '2026-10-15',
      duration_days: 6,
      story_points: 5,
      assignee_id: 'user-1',
      assignee_name: 'Dev One',
      epic_id: null,
      epic_title: null,
      list_id: 'list-1',
      list_name: 'Sprint Backlog',
      is_blocked: false,
      is_critical_path: true,
    },
    {
      id: 'issue-2',
      key: 'BACK-102',
      title: 'API endpoint pagination',
      type: 'story',
      status_id: 'stg-1',
      status_name: 'Todo',
      status_category: 'todo',
      priority: 'medium',
      start_date: '2026-10-16',
      due_date: '2026-10-20',
      duration_days: 5,
      story_points: 3,
      assignee_id: 'user-2',
      assignee_name: 'Dev Two',
      epic_id: null,
      epic_title: null,
      list_id: 'list-1',
      list_name: 'Sprint Backlog',
      is_blocked: false,
      is_critical_path: true,
    },
  ],
  dependencies: [
    {
      id: 'dep-1',
      source_issue_id: 'issue-1',
      target_issue_id: 'issue-2',
      kind: 'blocks',
      is_conflict: false,
    },
  ],
  critical_path_issue_ids: ['issue-1', 'issue-2'],
  groups: [],
};

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders interactive Gantt timeline with DAG tasks and critical path', async () => {
    vi.mocked(timelineApi.getTimeline).mockResolvedValueOnce({
      data: mockTimelineData,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <TimelineView
        workspaceId="ws-1"
        space={mockSpace}
        role="member"
      />
    );

    expect(await screen.findByText(/Critical Path Active:/i)).toBeInTheDocument();
    expect(screen.getAllByText('BACK-101').length).toBeGreaterThan(0);
    expect(screen.getByText('Database indexing & query optimization')).toBeInTheDocument();
    expect(screen.getAllByText('BACK-102').length).toBeGreaterThan(0);
    expect(screen.getByText('Dependencies (1)')).toBeInTheDocument();
  });

  it('opens reschedule modal and submits cascade rescheduling', async () => {
    vi.mocked(timelineApi.getTimeline).mockResolvedValueOnce({
      data: mockTimelineData,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(timelineApi.rescheduleIssue).mockResolvedValueOnce({
      data: {
        issue: {
          ...mockTimelineData.items[0],
          start_date: '2026-10-12',
          due_date: '2026-10-17',
        },
        cascaded_issues: [
          {
            ...mockTimelineData.items[1],
            start_date: '2026-10-18',
            due_date: '2026-10-22',
          },
        ],
        delta_days: 2,
      },
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <TimelineView
        workspaceId="ws-1"
        space={mockSpace}
        role="member"
      />
    );

    await screen.findByText('Database indexing & query optimization');
    const taskBar = screen.getAllByText('BACK-101')[0];
    fireEvent.click(taskBar);

    expect(await screen.findByText('Reschedule BACK-101')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save & Reschedule/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(timelineApi.rescheduleIssue).toHaveBeenCalledWith(
        'ws-1',
        'issue-1',
        expect.objectContaining({
          cascade: true,
        })
      );
    });
  });
});
