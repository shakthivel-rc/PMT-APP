import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationCenter } from './NotificationCenter';
import * as notifApi from '@/api/notifications';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/api/notifications', () => ({
  fetchNotificationsApi: vi.fn(),
  markNotificationReadApi: vi.fn(),
  markAllNotificationsReadApi: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button and shows unread badge when unread count > 0', async () => {
    vi.mocked(notifApi.fetchNotificationsApi).mockResolvedValue({
      items: [
        {
          id: 'notif-1',
          user_id: 'u-1',
          actor_id: 'u-2',
          actor_name: 'Bob',
          workspace_id: 'ws-1',
          issue_id: 'iss-1',
          type: 'assigned',
          title: 'Assigned to CP-42',
          message: 'You were assigned to: Fix auth flow',
          link: '/projects?issue=CP-42',
          is_read: false,
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ],
      total: 1,
      unread_count: 1,
      page: 1,
      limit: 30,
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /notifications/i });
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Inbox')).toBeInTheDocument();
    });
    expect(screen.getByText('Assigned to CP-42')).toBeInTheDocument();
  });

  it('marks single notification as read and navigates when clicked', async () => {
    vi.mocked(notifApi.fetchNotificationsApi).mockResolvedValue({
      items: [
        {
          id: 'notif-1',
          user_id: 'u-1',
          actor_id: 'u-2',
          actor_name: 'Bob',
          workspace_id: 'ws-1',
          issue_id: 'iss-1',
          type: 'assigned',
          title: 'Assigned to CP-42',
          message: 'You were assigned to: Fix auth flow',
          link: '/projects?issue=CP-42',
          is_read: false,
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ],
      total: 1,
      unread_count: 1,
      page: 1,
      limit: 30,
    });
    vi.mocked(notifApi.markNotificationReadApi).mockResolvedValue({ id: 'notif-1', is_read: true });

    render(<NotificationCenter />);

    const trigger = screen.getByRole('button', { name: /notifications/i });
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Assigned to CP-42')).toBeInTheDocument();
    });

    const itemBtn = screen.getByText('Assigned to CP-42').closest('button');
    if (itemBtn) fireEvent.click(itemBtn);

    await waitFor(() => {
      expect(notifApi.markNotificationReadApi).toHaveBeenCalledWith('notif-1');
      expect(mockNavigate).toHaveBeenCalledWith('/projects?issue=CP-42');
    });
  });
});
