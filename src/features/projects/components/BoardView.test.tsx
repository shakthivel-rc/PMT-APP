import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BoardView from './BoardView';
import type { BoardColumn } from '@/types';

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: any) =>
    selector({
      auth: {
        user: { id: 'u-1', username: 'alice', first_name: 'Alice', last_name: 'Smith' },
      },
    }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockColumns: BoardColumn[] = [
  {
    status: {
      id: 'st-todo',
      name: 'To Do',
      category: 'todo',
      position: 1,
      color: 'neutral',
      counts_toward_wip: false,
      wip_limit: null,
    },
    wip: {
      count: 2,
      limit: null,
      over_limit: false,
    },
    cards: [
      {
        id: 'c-1',
        key: 'CP-1',
        type: 'task',
        title: 'Setup PostgreSQL migrations',
        status_id: 'st-todo',
        list_id: 'l-1',
        parent_id: null,
        priority: 'high',
        story_points: 3,
        time_estimate_seconds: null,
        time_spent_seconds: 0,
        assignee: { id: 'u-1', display_name: 'Alice Smith' },
        rank: '0|hzzzzz:',
        start_date: null,
        due_date: null,
        pull_request_state: null,
        version: 1,
        sprint_id: null,
        blocked: false,
        blocked_reason: null,
      } as any,
      {
        id: 'c-2',
        key: 'CP-2',
        type: 'bug',
        title: 'Fix race condition on logout',
        status_id: 'st-todo',
        list_id: 'l-1',
        parent_id: null,
        priority: 'urgent',
        story_points: 5,
        time_estimate_seconds: null,
        time_spent_seconds: 0,
        assignee: { id: 'u-2', display_name: 'Bob Jones' },
        rank: '0|hzzzzz:',
        start_date: null,
        due_date: null,
        pull_request_state: null,
        version: 1,
        sprint_id: null,
        blocked: true,
        blocked_reason: 'Waiting on auth service PR',
      } as any,
    ],
  },
];

describe('BoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders columns, cards, quick search box, and filter chips', () => {
    render(
      <BoardView
        columns={mockColumns}
        canWrite={true}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    expect(screen.getByText('Fix race condition on logout')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter board...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Issues' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bugs' })).toBeInTheDocument();
  });

  it('filters cards by search term', () => {
    render(
      <BoardView
        columns={mockColumns}
        canWrite={true}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Filter board...');
    fireEvent.change(searchInput, { target: { value: 'PostgreSQL' } });

    expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    expect(screen.queryByText('Fix race condition on logout')).not.toBeInTheDocument();
  });

  it('filters cards when clicking Bugs filter chip', () => {
    render(
      <BoardView
        columns={mockColumns}
        canWrite={true}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const bugsChip = screen.getByRole('button', { name: 'Bugs' });
    fireEvent.click(bugsChip);

    expect(screen.queryByText('Setup PostgreSQL migrations')).not.toBeInTheDocument();
    expect(screen.getByText('Fix race condition on logout')).toBeInTheDocument();
  });

  it('copies git branch checkout command when clicking card key', async () => {
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardMock,
      },
    });

    render(
      <BoardView
        columns={mockColumns}
        canWrite={true}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const keyBtn = screen.getByRole('button', { name: 'CP-1' });
    fireEvent.click(keyBtn);

    expect(clipboardMock).toHaveBeenCalledWith('git checkout -b task/cp-1-setup-postgresql-migrations');
  });
});
