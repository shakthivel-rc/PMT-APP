import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DailyStandupCard } from './DailyStandupCard';
import { aiAgentsApi } from '@/api/aiAgents';
import type { DailyStandup } from '@/types';

vi.mock('@/api/aiAgents', () => ({
  aiAgentsApi: {
    getDailyStandup: vi.fn(),
    generateDailyStandup: vi.fn(),
  },
}));

const mockStandup: DailyStandup = {
  id: 'standup-1',
  workspace_id: 'ws-1',
  standup_date: '2026-10-14',
  summary: 'Daily Standup Briefing: 2 team members active. 3 issues delivered.',
  created_at: '2026-10-14T08:30:00Z',
  velocity_forecast: {
    active_sprint_name: 'Sprint 24',
    remaining_points: 15,
    working_days_left: 4,
    required_rate: 3.8,
    current_burn_rate: 4.5,
    carryover_risk: false,
    projected_carryover_pct: 0.0,
    health_status: 'healthy',
  },
  team_updates: [
    {
      user_id: 'u-1',
      user_name: 'Sarah Connor',
      completed_yesterday: ['PAY-101: Fix token expiration'],
      in_flight_today: ['PAY-102: Migrate auth flow'],
      blockers: [],
      hours_logged: 6.5,
    },
    {
      user_id: 'u-2',
      user_name: 'John Connor',
      completed_yesterday: [],
      in_flight_today: ['PAY-103: Stripe webhook integration'],
      blockers: ['Blocked on external API secret'],
      hours_logged: 4.0,
    },
  ],
};

describe('DailyStandupCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders daily standup narrative and sprint velocity metrics', async () => {
    vi.mocked(aiAgentsApi.getDailyStandup).mockResolvedValueOnce({
      data: mockStandup,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(<DailyStandupCard workspaceId="ws-1" />);

    expect(await screen.findByText(/Daily Standup & Trajectory Forecast/i)).toBeInTheDocument();
    expect(screen.getByText(/HEALTHY VELOCITY/i)).toBeInTheDocument();
    expect(screen.getByText(/Sprint 24/i)).toBeInTheDocument();
    expect(screen.getByText('15 pts')).toBeInTheDocument();
    expect(screen.getByText('4.5 pts/day')).toBeInTheDocument();
  });

  it('expands member updates and shows individual accomplishments and blockers', async () => {
    vi.mocked(aiAgentsApi.getDailyStandup).mockResolvedValueOnce({
      data: mockStandup,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(<DailyStandupCard workspaceId="ws-1" />);

    const expandBtn = await screen.findByRole('button', { name: /View Member Updates/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('John Connor')).toBeInTheDocument();
    expect(screen.getByText(/PAY-101: Fix token expiration/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked on external API secret/i)).toBeInTheDocument();
  });

  it('triggers manual refresh synthesis on button click', async () => {
    vi.mocked(aiAgentsApi.getDailyStandup).mockResolvedValueOnce({
      data: mockStandup,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(aiAgentsApi.generateDailyStandup).mockResolvedValueOnce({
      data: {
        ...mockStandup,
        summary: 'Updated Standup Briefing after refresh.',
      },
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(<DailyStandupCard workspaceId="ws-1" />);

    const refreshBtn = await screen.findByRole('button', { name: /Refresh Standup/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(aiAgentsApi.generateDailyStandup).toHaveBeenCalledWith('ws-1');
      expect(screen.getByText(/Updated Standup Briefing after refresh/i)).toBeInTheDocument();
    });
  });
});
