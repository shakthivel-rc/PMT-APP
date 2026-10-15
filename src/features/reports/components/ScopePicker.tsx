import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkspaceTree } from '@/types';
import type { SprintSummary } from '@/types/sprints';

/*
 * What a report covers: the whole workspace, a project (space), a folder or a list — and,
 * for the sprint reports, which sprint. The scope is one token (`space:{id}`, …) because
 * that is what the API takes and what the URL keeps.
 */

export const WORKSPACE_SCOPE = 'workspace';

export interface ScopeOption {
  token: string;
  label: string;
  depth: number;
  spaceId: string | null;
}

/** Every scope in `tree`, in sidebar order, each with the project it belongs to. */
export function scopeOptions(tree: WorkspaceTree | null | undefined): ScopeOption[] {
  const options: ScopeOption[] = [{ token: WORKSPACE_SCOPE, label: 'Whole workspace', depth: 0, spaceId: null }];
  for (const space of tree?.spaces ?? []) {
    options.push({ token: `space:${space.id}`, label: space.name, depth: 0, spaceId: space.id });
    for (const folder of space.folders) {
      options.push({ token: `folder:${folder.id}`, label: folder.name, depth: 1, spaceId: space.id });
      for (const list of folder.lists) {
        options.push({ token: `list:${list.id}`, label: list.name, depth: 2, spaceId: space.id });
      }
    }
    for (const list of space.lists) {
      if (!list.folder_id) options.push({ token: `list:${list.id}`, label: list.name, depth: 1, spaceId: space.id });
    }
  }
  return options;
}

/** The project a scope token sits in, or null for the workspace (and unknown tokens). */
export function spaceOfScope(tree: WorkspaceTree | null | undefined, token: string | undefined): string | null {
  if (!token) return null;
  return scopeOptions(tree).find((option) => option.token === token)?.spaceId ?? null;
}

const SPRINT_STATE_LABEL: Record<string, string> = { active: 'active', closed: 'closed', planned: 'planned' };

interface ScopePickerProps {
  tree: WorkspaceTree | null | undefined;
  scope: string;
  onScope: (token: string) => void;
  /** Shown for the sprint reports. */
  sprints?: SprintSummary[] | null;
  sprintId?: string | null;
  onSprint?: (sprintId: string | null) => void;
  /** A sprint report needs a project to look for sprints in. */
  needsSprints?: boolean;
}

const LATEST = 'latest';

export function ScopePicker({ tree, scope, onScope, sprints, sprintId, onSprint, needsSprints }: ScopePickerProps) {
  const options = useMemo(() => {
    const all = scopeOptions(tree);
    // A sprint scope comes from a sprint's own "Report" link; it is not in the tree.
    if (scope.startsWith('sprint:') && !all.some((option) => option.token === scope)) {
      all.push({ token: scope, label: 'This sprint', depth: 0, spaceId: null });
    }
    return all;
  }, [tree, scope]);
  const known = options.some((option) => option.token === scope);
  const sprintSpace = needsSprints ? spaceOfScope(tree, scope) : null;

  return (
    <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
      <div className="grid gap-1.5 w-full sm:w-auto">
        <Label htmlFor="report-scope">Scope</Label>
        <Select value={known ? scope : WORKSPACE_SCOPE} onValueChange={onScope}>
          <SelectTrigger id="report-scope" className="w-full sm:w-64" aria-label="Scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.token} value={option.token}>
                <span style={{ paddingLeft: option.depth * 12 }} className={option.depth === 0 ? 'font-medium' : undefined}>
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {needsSprints && onSprint && (
        <div className="grid gap-1.5 w-full sm:w-auto">
          <Label htmlFor="report-sprint">Sprint</Label>
          <Select
            value={sprintId ?? LATEST}
            onValueChange={(value) => onSprint(value === LATEST ? null : value)}
            disabled={!sprintSpace}
          >
            <SelectTrigger id="report-sprint" className="w-full sm:w-56" aria-label="Sprint">
              <SelectValue placeholder={sprintSpace ? 'Choose a sprint' : 'Choose a project first'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LATEST}>Active or latest closed</SelectItem>
              {(sprints ?? []).length > 0 && (
                <SelectGroup>
                  <SelectLabel>Sprints</SelectLabel>
                  {(sprints ?? []).map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name} ({SPRINT_STATE_LABEL[sprint.state] ?? sprint.state})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
