import { useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { updateReportsSettingsApi } from '@/api/reports';
import FormMessage from '@/components/FormMessage';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { WorkspaceRole } from '@/types';
import type { ReportsSettings } from '@/types/reports';

/*
 * A workspace's report settings (docs/design/08-reports.md §6): the time zone its days and
 * schedules are counted in, its working days (the burndown's guideline steps only on
 * those), whether guests see reports, and the lowest role that may export, schedule and
 * manage sprints. Admins only; the API refuses anyone else.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: 'guest', label: 'Guests and up' },
  { value: 'member', label: 'Members and up' },
  { value: 'admin', label: 'Admins and owners' },
  { value: 'owner', label: 'Owners only' },
];

interface ReportsSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  settings: ReportsSettings;
  onSaved: (settings: ReportsSettings) => void;
}

function RoleSelect({ id, label, value, onChange }: { id: string; label: string; value: WorkspaceRole; onChange: (role: WorkspaceRole) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as WorkspaceRole)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role.value} value={role.value}>
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReportsSettingsDialog({ open, onOpenChange, workspaceId, workspaceName, settings, onSaved }: ReportsSettingsDialogProps) {
  const [timezone, setTimezone] = useState(settings.timezone);
  const [workingDays, setWorkingDays] = useState<Set<number>>(new Set(settings.working_days));
  const [guestAccess, setGuestAccess] = useState(settings.guest_access);
  const [exportRole, setExportRole] = useState(settings.export_min_role);
  const [scheduleRole, setScheduleRole] = useState(settings.schedule_min_role);
  const [sprintRole, setSprintRole] = useState(settings.sprint_manage_role);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (workingDays.size === 0) return setFailure('Choose at least one working day.');
    setFailure(null);
    startTransition(async () => {
      try {
        const saved = await updateReportsSettingsApi(workspaceId, {
          timezone: timezone.trim(),
          working_days: [...workingDays].sort((a, b) => a - b),
          guest_access: guestAccess,
          export_min_role: exportRole,
          schedule_min_role: scheduleRole,
          sprint_manage_role: sprintRole,
        });
        onSaved(saved);
        onOpenChange(false);
      } catch (err) {
        setFailure(err instanceof Error ? err.message : 'The settings could not be saved. Try again.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report settings</DialogTitle>
          <DialogDescription>For everyone in {workspaceName}.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="reports-settings" onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="rs-timezone">Time zone</Label>
              <Input id="rs-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" />
              <p className="text-xs text-muted-foreground">
                Where a report's days begin and end, and the default for schedules. An IANA name.
              </p>
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">Working days</legend>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day, index) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={workingDays.has(index)}
                      onChange={(e) =>
                        setWorkingDays((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">The burndown's guideline does not fall on the others.</p>
            </fieldset>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="rs-guests">Guests can open reports</Label>
              <Switch id="rs-guests" checked={guestAccess} onCheckedChange={setGuestAccess} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <RoleSelect id="rs-export" label="Who can export" value={exportRole} onChange={setExportRole} />
              <RoleSelect id="rs-schedule" label="Who can schedule" value={scheduleRole} onChange={setScheduleRole} />
              <RoleSelect id="rs-sprints" label="Who manages sprints" value={sprintRole} onChange={setSprintRole} />
            </div>
            {failure && <FormMessage>{failure}</FormMessage>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="reports-settings" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
