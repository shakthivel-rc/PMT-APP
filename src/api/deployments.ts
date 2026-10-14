import { api, type ApiResponse } from './client';
import type {
  DeploymentCreate,
  DeploymentResponse,
  IssueDeploymentSummary,
} from '../types';

export const deploymentsApi = {
  listDeployments(
    workspaceId: string,
    environment?: string,
    limit: number = 50
  ): Promise<ApiResponse<DeploymentResponse[]>> {
    const search = new URLSearchParams();
    if (environment) search.set('environment', environment);
    search.set('limit', String(limit));
    return api.get<DeploymentResponse[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/deployments?${search.toString()}`
    );
  },

  createDeployment(
    workspaceId: string,
    body: DeploymentCreate
  ): Promise<ApiResponse<DeploymentResponse>> {
    return api.post<DeploymentResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/deployments`,
      body
    );
  },

  getIssueDeployments(
    workspaceId: string,
    issueId: string
  ): Promise<ApiResponse<IssueDeploymentSummary[]>> {
    return api.get<IssueDeploymentSummary[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/deployments`
    );
  },
};
