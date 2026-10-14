import { api, type ApiResponse } from './client';
import type {
  BacklogHygieneResponse,
  DailyStandup,
  SprintRetrospective,
  TriageResult,
} from '../types';

export const aiAgentsApi = {
  triageIssue(
    workspaceId: string,
    issueId: string
  ): Promise<ApiResponse<TriageResult>> {
    return api.post<TriageResult>(
      `/workspaces/${workspaceId}/issues/${issueId}/triage`,
      {}
    );
  },

  getDailyStandup(
    workspaceId: string,
    forDate?: string
  ): Promise<ApiResponse<DailyStandup>> {
    const query = forDate ? `?for_date=${encodeURIComponent(forDate)}` : '';
    return api.get<DailyStandup>(`/workspaces/${workspaceId}/ai/standup${query}`);
  },

  generateDailyStandup(
    workspaceId: string,
    forDate?: string
  ): Promise<ApiResponse<DailyStandup>> {
    const query = forDate ? `?for_date=${encodeURIComponent(forDate)}` : '';
    return api.post<DailyStandup>(
      `/workspaces/${workspaceId}/ai/standup/generate${query}`,
      {}
    );
  },

  getSprintRetrospective(
    workspaceId: string,
    sprintId: string
  ): Promise<ApiResponse<SprintRetrospective>> {
    return api.get<SprintRetrospective>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/retrospective`
    );
  },

  generateSprintRetrospective(
    workspaceId: string,
    sprintId: string
  ): Promise<ApiResponse<SprintRetrospective>> {
    return api.post<SprintRetrospective>(
      `/workspaces/${workspaceId}/sprints/${sprintId}/retrospective/generate`,
      {}
    );
  },

  getBacklogHygiene(
    workspaceId: string,
    spaceId: string,
    thresholdDays: number = 90
  ): Promise<ApiResponse<BacklogHygieneResponse>> {
    return api.get<BacklogHygieneResponse>(
      `/workspaces/${workspaceId}/spaces/${spaceId}/backlog/hygiene?threshold_days=${thresholdDays}`
    );
  },
};
