import { api, type ApiResponse } from './client';
import type {
  PQLExecuteRequest,
  PQLExecuteResponse,
  PQLValidateRequest,
  PQLValidateResponse,
} from '../types';

export const pqlApi = {
  validate(
    workspaceId: string,
    query: string
  ): Promise<ApiResponse<PQLValidateResponse>> {
    return api.post<PQLValidateResponse>(
      `/workspaces/${workspaceId}/pql/validate`,
      { query } as PQLValidateRequest
    );
  },

  execute(
    workspaceId: string,
    params: PQLExecuteRequest
  ): Promise<ApiResponse<PQLExecuteResponse>> {
    return api.post<PQLExecuteResponse>(
      `/workspaces/${workspaceId}/pql/execute`,
      params
    );
  },
};
