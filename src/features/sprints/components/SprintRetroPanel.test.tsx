import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SprintRetroPanel } from './SprintRetroPanel';
import { aiAgentsApi } from '@/api/aiAgents';
import type { SprintRetrospective } from '@/types';
import type { SprintSummary } from '@/types/sprints';

vi.mock('@/api/aiAgents', () => ({
  aiAgentsApi: {
    getSprintRetrospective: vi.fn(),
    generateSprintRetrospective: vi.fn(),
  },
}));

const mockSprint: SprintSummary = {
  id: 'sprint-1',
  space_id: 'space-1',
  name: 'Sprint 25',
  goal: 'Deliver auth and checkout',
  state: 'closed',
  starts_on: '2026-10-01',
  ends_on: '2026-10-14',
  started_at: '2026-10-01T09:00:00Z',
  closed_at: '2026-10-14T17:00:00Z',
  created_at: '2026-10-01T08:00:00Z',
  committed_points: 20,
  completed_points: 18,
  points: 20,
  done_points: 18,
  issue_count: 5,
  done_issue_count: 4,
  canceled_issue_count: 0,
};

const mockRetro: SprintRetrospective = {
  id: 'retro-1',
  workspace_id: 'ws-1',
  sprint_id: 'sprint-1',
  summary: 'Delivered 18 of 20 points (90%). Key wins highlighted with 1 unplanned scope addition.',
  created_at: '2026-10-14T17:05:00Z',
  wins: [
    'High velocity delivery: Achieved 90% point completion.',
    'Delivered core authentication subsystem ahead of schedule.',
  ],
  scope_creep: [
    'PAY-104: Emergency hotfix for gateway timeout (Added mid-sprint with 2 pts)',
  ],
  cycle_time_outliers: [
    'PAY-88 took 7.5 days in code review (space avg: 2.1d)',
  ],
  metrics: {
    committed_points: 20,
    completed_points: 18,
    completion_rate_pct: 90,
    total_issues_count: 5,
    scope_creep_count: 1,
  },
};

describe('SprintRetroPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders retrospective summary, metrics, wins, and scope creep', async () => {
    vi.mocked(aiAgentsApi.getSprintRetrospective).mockResolvedValueOnce({
      data: mockRetro,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <SprintRetroPanel
        workspaceId="ws-1"
        sprint={mockSprint}
        canManage={true}
      />
    );

    expect(await screen.findByText(/Autonomous Sprint Retrospective/i)).toBeInTheDocument();
    expect(screen.getAllByText(/90%/i).length).toBeGreaterThan(0);
    expect(screen.getByText('High velocity delivery: Achieved 90% point completion.')).toBeInTheDocument();
    expect(screen.getByText(/Emergency hotfix for gateway timeout/i)).toBeInTheDocument();
    expect(screen.getByText(/PAY-88 took 7.5 days in code review/i)).toBeInTheDocument();
  });

  it('regenerates retrospective on user request', async () => {
    vi.mocked(aiAgentsApi.getSprintRetrospective).mockResolvedValueOnce({
      data: mockRetro,
      status: 'success',
      status_code: 200,
      message: 'OK',
    });
    vi.mocked(aiAgentsApi.generateSprintRetrospective).mockResolvedValueOnce({
      data: {
        ...mockRetro,
        summary: 'Freshly synthesized post-mortem analysis.',
      },
      status: 'success',
      status_code: 200,
      message: 'OK',
    });

    render(
      <SprintRetroPanel
        workspaceId="ws-1"
        sprint={mockSprint}
        canManage={true}
      />
    );

    const regenBtn = await screen.findByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    await waitFor(() => {
      expect(aiAgentsApi.generateSprintRetrospective).toHaveBeenCalledWith('ws-1', 'sprint-1');
      expect(screen.getByText('Freshly synthesized post-mortem analysis.')).toBeInTheDocument();
    });
  });
});
