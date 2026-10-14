import { ChevronDown, X } from 'lucide-react';
import type { BoardFilters } from '@/api/issues';
import type { IssueCard, IssuePriority, IssueType, MemberSummary } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { humanize } from '../presentation';

/*
 * The board's filters (09-restructuring.md §5.1) as one controlled bar, shared by every view
 * that takes them — the delivery board, the space overview, the sprint board and the backlog
 * — so a filter means the same thing wherever it is set. It holds no state: `value` in,
 * `onChange(next)` out, and the view decides whether to refetch or to keep the filter in its
 * URL. Saved views sit beside it, not in it.
 */

const TYPES: IssueType[] = ['epic', 'story', 'task', 'bug', 'subtask'];
const PRIORITIES: IssuePriority[] = ['urgent', 'high', 'medium', 'low', 'none'];
// Radix Select refuses an empty-string value, so "no filter" needs a spelling of its own.
const ANY = '__any__';

/** Whether any filter is set — what "Clear filters" and a view's "filtered" hint ask. */
export function hasFilters(value: BoardFilters): boolean {
  return Boolean(
    value.assignee_id || value.type?.length || value.priority?.length || value.q || value.blocked !== undefined || value.epic_id,
  );
}

function toggle<T>(list: T[] | undefined, item: T): T[] | undefined {
  const next = list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item];
  return next.length ? next : undefined;
}

function Checklist<T extends string>({
  label,
  options,
  chosen,
  onToggle,
}: {
  label: string;
  options: T[];
  chosen: T[] | undefined;
  onToggle: (item: T) => void;
}) {
  const count = chosen?.length ?? 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={count ? 'secondary' : 'outline'} aria-label={`${label}${count ? `, ${count} chosen` : ''}`}>
          {label}
          {count ? ` (${count})` : ''} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={chosen?.includes(option) ?? false}
            onCheckedChange={() => onToggle(option)}
            // Keep the menu open: choosing two types should not take two trips.
            onSelect={(event) => event.preventDefault()}
          >
            {humanize(option)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface IssueFilterBarProps {
  value: BoardFilters;
  onChange: (next: BoardFilters) => void;
  /** For the assignee menu. Omitted: only "Me" and "Unassigned" are offered. */
  members?: MemberSummary[];
  /** For the epic menu. Omitted or empty: no epic menu. */
  epics?: Pick<IssueCard, 'id' | 'key' | 'title'>[];
}

const IssueFilterBar = ({ value, onChange, members = [], epics = [] }: IssueFilterBarProps) => {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...value, ...patch });
  const blocked = value.blocked === undefined ? ANY : value.blocked ? 'yes' : 'no';
  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        aria-label="Search title or key"
        placeholder="Search title or key"
        className="h-8 w-48"
        value={value.q ?? ''}
        onChange={(event) => set({ q: event.target.value || undefined })}
      />
      <Select value={value.assignee_id ?? ANY} onValueChange={(next) => set({ assignee_id: next === ANY ? undefined : next })}>
        <SelectTrigger size="sm" aria-label="Assignee" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Anyone</SelectItem>
          <SelectItem value="me">Me</SelectItem>
          <SelectItem value="none">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.user_id} value={member.user_id}>
              {`${member.first_name} ${member.last_name}`.trim() || member.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Checklist label="Type" options={TYPES} chosen={value.type} onToggle={(item) => set({ type: toggle(value.type, item) })} />
      <Checklist
        label="Priority"
        options={PRIORITIES}
        chosen={value.priority}
        onToggle={(item) => set({ priority: toggle(value.priority, item) })}
      />
      <Select value={blocked} onValueChange={(next) => set({ blocked: next === ANY ? undefined : next === 'yes' })}>
        <SelectTrigger size="sm" aria-label="Blocked" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Blocked or not</SelectItem>
          <SelectItem value="yes">Only blocked</SelectItem>
          <SelectItem value="no">Not blocked</SelectItem>
        </SelectContent>
      </Select>
      {epics.length > 0 && (
        <Select value={value.epic_id ?? ANY} onValueChange={(next) => set({ epic_id: next === ANY ? undefined : next })}>
          <SelectTrigger size="sm" aria-label="Epic" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any epic</SelectItem>
            {epics.map((epic) => (
              <SelectItem key={epic.id} value={epic.id}>
                {epic.key} {epic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hasFilters(value) && (
        <Button size="sm" variant="ghost" onClick={() => onChange({})}>
          <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
        </Button>
      )}
    </div>
  );
};

export default IssueFilterBar;
