import { api, type ApiResponse } from './client';
import type { RescheduleRequest, RescheduleResponse, TimelineResponse } from '../types';

export const timelineApi = {
  getTimeline(
    workspaceId: string,
    spaceId: string,
    params?: { start_date?: string; end_date?: string; zoom?: string; group_by?: string }
  ): Promise<ApiResponse<TimelineResponse>> {
    const search = new URLSearchParams();
    if (params?.start_date) search.set('start_date', params.start_date);
    if (params?.end_date) search.set('end_date', params.end_date);
    if (params?.zoom) search.set('zoom', params.zoom);
    if (params?.group_by) search.set('group_by', params.group_by);
    const qs = search.toString();
    return api.get<TimelineResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/spaces/${encodeURIComponent(spaceId)}/timeline${qs ? `?${qs}` : ''}`
    );
  },

  rescheduleIssue(
    workspaceId: string,
    issueId: string,
    body: RescheduleRequest
  ): Promise<ApiResponse<RescheduleResponse>> {
    return api.patch<RescheduleResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/reschedule`,
      body
    );
  },
};
