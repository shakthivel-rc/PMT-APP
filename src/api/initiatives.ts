import { api, type ApiResponse } from './client';
import type {
  InitiativeCreate,
  InitiativeDetailResponse,
  InitiativeResponse,
  InitiativeUpdate,
} from '../types';

export const initiativesApi = {
  listInitiatives(workspaceId: string): Promise<ApiResponse<InitiativeResponse[]>> {
    return api.get<InitiativeResponse[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives`
    );
  },

  createInitiative(
    workspaceId: string,
    body: InitiativeCreate
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.post<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives`,
      body
    );
  },

  getInitiative(
    workspaceId: string,
    initiativeId: string
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.get<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}`
    );
  },

  updateInitiative(
    workspaceId: string,
    initiativeId: string,
    body: InitiativeUpdate
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.patch<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}`,
      body
    );
  },

  deleteInitiative(
    workspaceId: string,
    initiativeId: string
  ): Promise<ApiResponse<null>> {
    return api.delete<null>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}`
    );
  },

  linkSpaces(
    workspaceId: string,
    initiativeId: string,
    spaceIds: string[]
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.post<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}/spaces`,
      { space_ids: spaceIds }
    );
  },

  unlinkSpace(
    workspaceId: string,
    initiativeId: string,
    spaceId: string
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.delete<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}/spaces/${encodeURIComponent(spaceId)}`
    );
  },

  linkIssues(
    workspaceId: string,
    initiativeId: string,
    issueIds: string[]
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.post<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}/issues`,
      { issue_ids: issueIds }
    );
  },

  unlinkIssue(
    workspaceId: string,
    initiativeId: string,
    issueId: string
  ): Promise<ApiResponse<InitiativeDetailResponse>> {
    return api.delete<InitiativeDetailResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}/issues/${encodeURIComponent(issueId)}`
    );
  },
};
