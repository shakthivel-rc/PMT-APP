import { api, type ApiResponse } from './client';
import type { PokerSessionState, PokerVoteRequest } from '../types';

export const pokerApi = {
  getState(
    workspaceId: string,
    sprintId: string
  ): Promise<ApiResponse<PokerSessionState>> {
    return api.get<PokerSessionState>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/poker/state`
    );
  },

  startSession(
    workspaceId: string,
    sprintId: string,
    issueId: string
  ): Promise<ApiResponse<PokerSessionState>> {
    return api.post<PokerSessionState>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/poker/start`,
      { issue_id: issueId }
    );
  },

  submitVote(
    workspaceId: string,
    sprintId: string,
    vote: PokerVoteRequest
  ): Promise<ApiResponse<PokerSessionState>> {
    return api.post<PokerSessionState>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/poker/vote`,
      vote
    );
  },

  revealVotes(
    workspaceId: string,
    sprintId: string
  ): Promise<ApiResponse<PokerSessionState>> {
    return api.post<PokerSessionState>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/poker/reveal`,
      {}
    );
  },

  acceptConsensus(
    workspaceId: string,
    sprintId: string,
    storyPoints: number
  ): Promise<ApiResponse<PokerSessionState>> {
    return api.post<PokerSessionState>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/poker/accept`,
      { story_points: storyPoints }
    );
  },
};
