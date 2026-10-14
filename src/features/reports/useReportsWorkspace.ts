import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchReportCatalogApi } from '@/api/reports';
import { fetchMembersApi, fetchWorkspaceTreeApi, fetchWorkspacesApi } from '@/api/workspaces';
import type { WorkspaceSummary } from '@/types';
import type { ReportCatalog, ReportsSettings } from '@/types/reports';
import { errorMessage, useKeyed } from './useKeyed';

/*
 * What every reports screen needs before it can draw anything: the caller's workspaces (the
 * one in `?workspace=`, else the first), that workspace's report catalogue — the reports, and
 * what this caller's role may do with them — its tree for the scope picker, and its members
 * for the people filters. Each is loaded once per workspace.
 */

export function useReportsWorkspace() {
  const [search] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<{ key: string; settings: ReportsSettings } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspacesApi().then(
      (all) => !cancelled && setWorkspaces(all),
      (err: unknown) => !cancelled && setWorkspacesError(errorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const workspace = workspaces?.find((w) => w.id === search.get('workspace')) ?? workspaces?.[0] ?? null;
  const workspaceId = workspace?.id ?? null;
  const catalogState = useKeyed<ReportCatalog>(workspaceId, () => fetchReportCatalogApi(workspaceId as string));
  const canView = catalogState?.data?.can_view ?? false;
  const tree = useKeyed(canView ? workspaceId : null, () => fetchWorkspaceTreeApi(workspaceId as string));
  const members = useKeyed(canView ? workspaceId : null, () => fetchMembersApi(workspaceId as string));

  const catalog = catalogState?.data
    ? {
        ...catalogState.data,
        settings: savedSettings && savedSettings.key === workspaceId ? savedSettings.settings : catalogState.data.settings,
      }
    : null;

  return {
    workspaces,
    workspace,
    workspaceId,
    error: workspacesError ?? catalogState?.error ?? null,
    loading: !workspaces || (Boolean(workspaceId) && !catalogState),
    catalog,
    tree: tree?.data ?? null,
    // Members are a convenience for the filters; a guest who may not list them still gets reports.
    members: members?.data ?? null,
    onSettingsSaved: (settings: ReportsSettings) => workspaceId && setSavedSettings({ key: workspaceId, settings }),
  };
}
