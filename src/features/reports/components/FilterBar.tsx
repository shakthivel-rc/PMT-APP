import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { IssueCard, MemberSummary, WeekStart } from '@/types';
import type { DatePreset, GroupBy, ReportParams, ReportType } from '@/types/reports';
import { formatDateKey } from '@/lib/week';
import { PRESET_LABELS, defaultPreset, presetRange } from '../params';

/*
 * The filters a report takes — and only those: each control is drawn when the report's
 * catalogue entry lists its parameter, so the bar for a timesheet and the bar for a
 * burndown are the same component showing different controls.
 *
 * Changes go up as a patch; the page writes them to the URL, and the URL runs the report.
 */

const TYPES = ['epic', 'story', 'task', 'subtask', 'bug'] as const;
const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
const CATEGORIES = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
] as const;
export const GROUP_LABELS: Record<GroupBy, string> = {
  user: 'Person',
  project: 'Project',
  list: 'List',
  epic: 'Epic',
  issue: 'Issue',
  type: 'Type',
  billable: 'Billable',
  week: 'Week',
};
const NONE = 'none';
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');

interface Option {
  value: string;
  label: string;
}

/** A dropdown of checkboxes: "Everyone" when nothing is ticked, which is what the API reads. */
function MultiSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: Option[];
  value: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  const chosen = new Set(value ?? []);
  const summary =
    chosen.size === 0
      ? allLabel
      : chosen.size === 1
        ? (options.find((o) => chosen.has(o.value))?.label ?? '1 selected')
        : `${chosen.size} selected`;
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-40 justify-between font-normal" aria-label={`${label}: ${summary}`}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto" align="start">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={chosen.has(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => {
                const next = new Set(chosen);
                if (checked) next.add(option.value);
                else next.delete(option.value);
                onChange(options.map((o) => o.value).filter((v) => next.has(v)));
              }}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {chosen.size > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange([])}>Clear</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SimpleSelect({
  id,
  label,
  value,
  options,
  onChange,
  width = 'w-36',
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  width?: string;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export interface FilterBarProps {
  report: ReportType;
  params: ReportParams;
  onChange: (patch: Partial<ReportParams>) => void;
  presets: DatePreset[];
  members?: MemberSummary[] | null;
  epics?: IssueCard[] | null;
  weekStart?: WeekStart;
  today?: Date;
}

export function FilterBar({ report, params, onChange, presets, members, epics, weekStart = 'monday', today = new Date() }: FilterBarProps) {
  const has = (key: string) => report.params.includes(key);
  const preset: DatePreset = params.preset ?? (params.date_from ? 'custom' : (defaultPreset(report) ?? 'this_week'));
  const range = preset === 'custom' ? null : presetRange(preset, today, weekStart);
  const weekly = report.dates === 'week';
  const people = (members ?? []).map((m) => ({
    value: m.user_id,
    label: `${m.first_name} ${m.last_name}`.trim() || m.email,
  }));
  const groups = params.group_by ?? ['user'];

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Report filters">
      {has('preset') && (
        <SimpleSelect
          id="report-preset"
          label={weekly ? 'Week' : 'Dates'}
          value={preset}
          width="w-40"
          options={presets
            .filter((p) => !weekly || ['this_week', 'last_week', 'custom'].includes(p))
            .map((p) => ({ value: p, label: weekly && p === 'custom' ? 'Week of…' : PRESET_LABELS[p] }))}
          onChange={(value) =>
            onChange(
              value === 'custom'
                ? { preset: 'custom', date_from: range?.[0] ?? params.date_from, date_to: weekly ? undefined : (range?.[1] ?? params.date_to) }
                : { preset: value as DatePreset, date_from: undefined, date_to: undefined },
            )
          }
        />
      )}
      {has('preset') && preset === 'custom' && (
        <>
          <Field id="report-from" label={weekly ? 'Week of' : 'From'}>
            <Input
              id="report-from"
              type="date"
              className="w-40"
              value={params.date_from ?? ''}
              onChange={(event) => onChange({ date_from: event.target.value || undefined })}
            />
          </Field>
          {!weekly && has('date_to') && (
            <Field id="report-to" label="To">
              <Input
                id="report-to"
                type="date"
                className="w-40"
                value={params.date_to ?? ''}
                min={params.date_from ?? undefined}
                onChange={(event) => onChange({ date_to: event.target.value || undefined })}
              />
            </Field>
          )}
        </>
      )}
      {has('preset') && range && (
        <p className="pb-2 text-xs text-muted-foreground" data-testid="preset-range">
          {formatDateKey(range[0])} – {formatDateKey(range[1])}
        </p>
      )}
      {has('group_by') && (
        <>
          <SimpleSelect
            id="report-group"
            label="Group by"
            value={groups[0]}
            options={Object.entries(GROUP_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(value) => onChange({ group_by: [value as GroupBy, ...groups.slice(1).filter((g) => g !== value)] })}
          />
          <SimpleSelect
            id="report-group-2"
            label="Then by"
            value={groups[1] ?? NONE}
            options={[
              { value: NONE, label: 'Nothing' },
              ...Object.entries(GROUP_LABELS)
                .filter(([value]) => value !== groups[0])
                .map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value) => onChange({ group_by: value === NONE ? [groups[0]] : [groups[0], value as GroupBy] })}
          />
        </>
      )}
      {has('user_ids') && people.length > 0 && (
        <MultiSelect label="People" allLabel="Everyone" options={people} value={params.user_ids} onChange={(next) => onChange({ user_ids: next })} />
      )}
      {has('assignee_ids') && people.length > 0 && (
        <MultiSelect
          label="Assignees"
          allLabel="Anyone"
          options={people}
          value={params.assignee_ids}
          onChange={(next) => onChange({ assignee_ids: next })}
        />
      )}
      {has('types') && (
        <MultiSelect
          label="Types"
          allLabel="All types"
          options={TYPES.map((t) => ({ value: t, label: capital(t) }))}
          value={params.types}
          onChange={(next) => onChange({ types: next as ReportParams['types'] })}
        />
      )}
      {has('priorities') && (
        <MultiSelect
          label="Priorities"
          allLabel="All priorities"
          options={PRIORITIES.map((p) => ({ value: p, label: capital(p) }))}
          value={params.priorities}
          onChange={(next) => onChange({ priorities: next as ReportParams['priorities'] })}
        />
      )}
      {has('status_categories') && (
        <MultiSelect
          label="Status"
          allLabel="Any status"
          options={CATEGORIES.map(([value, label]) => ({ value, label }))}
          value={params.status_categories}
          onChange={(next) => onChange({ status_categories: next as ReportParams['status_categories'] })}
        />
      )}
      {has('epic_id') && epics && epics.length > 0 && (
        <SimpleSelect
          id="report-epic"
          label="Epic"
          value={params.epic_id ?? NONE}
          width="w-48"
          options={[{ value: NONE, label: 'Any epic' }, ...epics.map((e) => ({ value: e.id, label: `${e.key} ${e.title}` }))]}
          onChange={(value) => onChange({ epic_id: value === NONE ? undefined : value })}
        />
      )}
      {has('billable') && (
        <SimpleSelect
          id="report-billable"
          label="Billable"
          value={params.billable ?? 'all'}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'billable', label: 'Billable' },
            { value: 'non_billable', label: 'Non-billable' },
          ]}
          onChange={(value) => onChange({ billable: value === 'all' ? undefined : (value as ReportParams['billable']) })}
        />
      )}
      {has('rounding_minutes') && (
        <SimpleSelect
          id="report-rounding"
          label="Rounding"
          value={String(params.rounding_minutes ?? 0)}
          options={[0, 1, 5, 6, 10, 15, 30].map((m) => ({ value: String(m), label: m === 0 ? 'None' : `${m} min` }))}
          onChange={(value) =>
            onChange({ rounding_minutes: value === '0' ? undefined : (Number(value) as ReportParams['rounding_minutes']) })
          }
        />
      )}
      {has('rounding_mode') && params.rounding_minutes ? (
        <SimpleSelect
          id="report-rounding-mode"
          label="Round"
          value={params.rounding_mode ?? 'nearest'}
          width="w-28"
          options={['up', 'nearest', 'down'].map((m) => ({ value: m, label: capital(m) }))}
          onChange={(value) => onChange({ rounding_mode: value as ReportParams['rounding_mode'] })}
        />
      ) : null}
      {has('unit') && (
        <SimpleSelect
          id="report-unit"
          label="Measure"
          value={params.unit ?? 'points'}
          options={[
            { value: 'points', label: 'Story points' },
            { value: 'count', label: 'Issue count' },
            { value: 'hours', label: 'Hours' },
          ]}
          onChange={(value) => onChange({ unit: value as ReportParams['unit'] })}
        />
      )}
      {has('bucket') && (
        <SimpleSelect
          id="report-bucket"
          label="Per"
          value={params.bucket ?? 'week'}
          width="w-28"
          options={['day', 'week', 'month'].map((b) => ({ value: b, label: capital(b) }))}
          onChange={(value) => onChange({ bucket: value as ReportParams['bucket'] })}
        />
      )}
      {has('sprint_count') && (
        <SimpleSelect
          id="report-sprint-count"
          label="Sprints"
          value={String(params.sprint_count ?? 7)}
          width="w-28"
          options={[3, 5, 7, 10, 12].map((n) => ({ value: String(n), label: `Last ${n}` }))}
          onChange={(value) => onChange({ sprint_count: Number(value) })}
        />
      )}
      {has('cumulative') && (
        <div className="flex items-center gap-2 pb-2">
          <Switch id="report-cumulative" checked={Boolean(params.cumulative)} onCheckedChange={(checked) => onChange({ cumulative: checked || undefined })} />
          <Label htmlFor="report-cumulative">Cumulative</Label>
        </div>
      )}
    </div>
  );
}
