import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { PlanningPokerPanel } from './PlanningPokerPanel';
import { pokerApi } from '../../../api/poker';
import type { IssueCard, PokerSessionState } from '../../../types';

vi.mock('../../../api/poker', () => ({
  pokerApi: {
    getState: vi.fn(),
    startSession: vi.fn(),
    submitVote: vi.fn(),
    revealVotes: vi.fn(),
    acceptConsensus: vi.fn(),
  },
}));

const mockIssues: IssueCard[] = [
  {
    id: 'i-1',
    key: 'PAY-1',
    title: 'Stripe integration',
    type: 'story',
    status_id: 's-todo',
    list_id: 'list-1',
    parent_id: null,
    priority: 'high',
    story_points: null,
    time_estimate_seconds: null,
    time_spent_seconds: 0,
    assignee: null,
    rank: '0|hzzzzz:',
    start_date: null,
    due_date: null,
  } as IssueCard,
];

const mockVotingSession: PokerSessionState = {
  id: 'session-1',
  workspace_id: 'ws-1',
  sprint_id: 'sprint-1',
  active_issue_id: 'i-1',
  active_issue_title: 'Stripe integration',
  active_issue_key: 'PAY-1',
  status: 'voting',
  created_by: 'u-1',
  voters: [
    {
      user_id: 'u-1',
      name: 'Alice',
      email: 'alice@example.com',
      avatar_url: null,
      has_voted: true,
      point_vote: 5,
      special_vote: null,
    },
    {
      user_id: 'u-2',
      name: 'Bob',
      email: 'bob@example.com',
      avatar_url: null,
      has_voted: false,
      point_vote: null,
      special_vote: null,
    },
  ],
  average: null,
  median: null,
  lowest_vote: null,
  highest_vote: null,
  total_voters: 2,
  voted_count: 1,
};

const mockRevealedSession: PokerSessionState = {
  ...mockVotingSession,
  status: 'revealed',
  voters: [
    {
      user_id: 'u-1',
      name: 'Alice',
      email: 'alice@example.com',
      avatar_url: null,
      has_voted: true,
      point_vote: 5,
      special_vote: null,
    },
    {
      user_id: 'u-2',
      name: 'Bob',
      email: 'bob@example.com',
      avatar_url: null,
      has_voted: true,
      point_vote: 8,
      special_vote: null,
    },
  ],
  average: 6.5,
  median: 6.5,
  lowest_vote: 5,
  highest_vote: 8,
  total_voters: 2,
  voted_count: 2,
};

describe('<PlanningPokerPanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state when no active session exists', async () => {
    vi.mocked(pokerApi.getState).mockRejectedValueOnce(new Error('Not found'));

    renderWithProviders(
      <PlanningPokerPanel
        workspaceId="ws-1"
        sprintId="sprint-1"
        sprintIssues={mockIssues}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/interactive sprint planning poker/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start estimation round/i })).toBeInTheDocument();
    });
  });

  it('renders voting interface with Fibonacci cards when voting is active', async () => {
    vi.mocked(pokerApi.getState).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: mockVotingSession,
    });

    renderWithProviders(
      <PlanningPokerPanel
        workspaceId="ws-1"
        sprintId="sprint-1"
        sprintIssues={mockIssues}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Voting Round')).toBeInTheDocument();
      expect(screen.getByText('Stripe integration')).toBeInTheDocument();
    });

    // Check Fibonacci deck buttons exist
    expect(screen.getByRole('button', { name: /vote 5 points/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vote 8 points/i })).toBeInTheDocument();
  });

  it('submits a vote when a card is clicked', async () => {
    vi.mocked(pokerApi.getState).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: mockVotingSession,
    });
    vi.mocked(pokerApi.submitVote).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: mockVotingSession,
    });

    renderWithProviders(
      <PlanningPokerPanel
        workspaceId="ws-1"
        sprintId="sprint-1"
        sprintIssues={mockIssues}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /vote 8 points/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /vote 8 points/i }));

    await waitFor(() => {
      expect(pokerApi.submitVote).toHaveBeenCalledWith('ws-1', 'sprint-1', { point_vote: 8 });
    });
  });

  it('reveals votes and shows consensus stats', async () => {
    vi.mocked(pokerApi.getState).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: mockRevealedSession,
    });

    renderWithProviders(
      <PlanningPokerPanel
        workspaceId="ws-1"
        sprintId="sprint-1"
        sprintIssues={mockIssues}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Votes Revealed')).toBeInTheDocument();
      expect(screen.getByText(/Estimation Analysis/i)).toBeInTheDocument();
      expect(screen.getAllByText('6.5').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('accepts consensus story points', async () => {
    vi.mocked(pokerApi.getState).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: mockRevealedSession,
    });
    vi.mocked(pokerApi.acceptConsensus).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: { ...mockRevealedSession, status: 'completed' },
    });

    const onAssigned = vi.fn();

    renderWithProviders(
      <PlanningPokerPanel
        workspaceId="ws-1"
        sprintId="sprint-1"
        sprintIssues={mockIssues}
        canManage={true}
        onStoryPointsAssigned={onAssigned}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept consensus/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /accept consensus/i }));

    await waitFor(() => {
      expect(pokerApi.acceptConsensus).toHaveBeenCalledWith('ws-1', 'sprint-1', 7);
      expect(onAssigned).toHaveBeenCalled();
    });
  });
});
