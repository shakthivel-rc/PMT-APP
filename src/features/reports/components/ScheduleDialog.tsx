import { useState, type FormEvent } from 'react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createScheduleApi, deleteScheduleApi, fetchSchedulesApi, runScheduleNowApi, updateScheduleApi } from '@/api/reports';
import FormMessage from '@/components/FormMessage';
import { StatusBadge } from '@/components/StatusBadge';
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
import type { MemberSummary } from '@/types';
import type { Cadence, ExportFormat, ReportSchedule, SavedReport } from '@/types/reports';
import { formatServerDateTime } from '@/lib/datetime';
import { useKeyed } from '../useKeyed';

/*
 * Email a saved report on a schedule (docs/design/08-reports.md §7): daily, weekly on a
 * weekday or monthly on a day, at an hour in a time zone — the workspace's unless chosen —
 * as a CSV, Excel or PDF attachment, to members. Each recipient's copy is computed with
 * their own access, so a schedule never mails anyone numbers they could not open.
 */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FORMAT_LABELS: Record<string, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' };

function describe(schedule: ReportSchedule): string {
  const hour = `${String(schedule.hour_local).padStart(2, '0')}:00 ${schedule.timezone}`;
  if (schedule.cadence === 'daily') return `Daily at ${hour}`;
  if (schedule.cadence === 'weekly') return `${WEEKDAYS[schedule.weekday ?? 0]}s at ${hour}`;
  return `Monthly on day ${schedule.day_of_month} at ${hour}`;
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  saved: SavedReport;
  members: MemberSummary[];
  timezone: string;
  formats: ExportFormat[];
  currentUserId?: string;
}

export function ScheduleDialog({ open, onOpenChange, workspaceId, saved, members, timezone, formats, currentUserId }: ScheduleDialogProps) {
  const [version, setVersion] = useState(0);
  const schedules = useKeyed(open ? `${saved.id}|${version}` : null, () => fetchSchedulesApi(workspaceId, saved.id));
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [weekday, setWeekday] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [hour, setHour] = useState(9);
  const [zone, setZone] = useState(timezone);
  const [format, setFormat] = useState<ExportFormat>(formats.includes('pdf') ? 'pdf' : (formats[0] ?? 'csv'));
  const [recipients, setRecipients] = useState<Set<string>>(new Set(currentUserId ? [currentUserId] : []));
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const reload = () => setVersion((v) => v + 1);

  const act = async (label: string, run: () => Promise<unknown>, done?: string) => {
    setBusy(label);
    setFailure(null);
    try {
      await run();
      if (done) toast.success(done);
      reload();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const day = Number(dayOfMonth);
    if (cadence === 'monthly' && !(Number.isInteger(day) && day >= 1 && day <= 28)) {
      return setFailure('Pick a day from 1 to 28, so every month has it.');
    }
    if (recipients.size === 0) return setFailure('Choose at least one recipient.');
    void act(
      'create',
      () =>
        createScheduleApi(workspaceId, saved.id, {
          cadence,
          weekday: cadence === 'weekly' ? weekday : null,
          day_of_month: cadence === 'monthly' ? day : null,
          hour_local: hour,
          timezone: zone.trim() || null,
          format,
          recipients: [...recipients],
        }),
      'Schedule added.',
    );
  };

  const name = (member: MemberSummary) => `${member.first_name} ${member.last_name}`.trim() || member.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule “{saved.name}”</DialogTitle>
          <DialogDescription>Email this report to members on a schedule.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <section aria-label="Schedules" className="grid gap-2">
            {!schedules && <p className="text-sm text-muted-foreground">Loading schedules…</p>}
            {schedules?.error && <FormMessage>{schedules.error}</FormMessage>}
            {schedules?.data?.length === 0 && <p className="text-sm text-muted-foreground">No schedules yet.</p>}
            {schedules?.data?.map((schedule) => (
              <div key={schedule.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm" data-testid="schedule-row">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {describe(schedule)} · {FORMAT_LABELS[schedule.format] ?? schedule.format}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    To {schedule.recipients.map((r) => r.name ?? 'former member').join(', ')} · next{' '}
                    {formatServerDateTime(schedule.next_run_at)}
                  </p>
                </div>
                {!schedule.enabled && <StatusBadge tone="neutral">Paused</StatusBadge>}
                <Switch
                  checked={schedule.enabled}
                  aria-label={schedule.enabled ? 'Pause schedule' : 'Resume schedule'}
                  disabled={busy !== null}
                  onCheckedChange={(enabled) =>
                    void act(`toggle-${schedule.id}`, () => updateScheduleApi(workspaceId, saved.id, schedule.id, { enabled }))
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(`run-${schedule.id}`, () => runScheduleNowApi(workspaceId, saved.id, schedule.id), 'Sending now.')
                  }
                >
                  <Play className="h-4 w-4" aria-hidden /> Run now
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete schedule"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(`delete-${schedule.id}`, () => deleteScheduleApi(workspaceId, saved.id, schedule.id), 'Schedule deleted.')
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </section>

          <form id="report-schedule" onSubmit={submit} className="grid gap-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Add a schedule</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-cadence">Every</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                  <SelectTrigger id="schedule-cadence" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Day</SelectItem>
                    <SelectItem value="weekly">Week</SelectItem>
                    <SelectItem value="monthly">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cadence === 'weekly' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="schedule-weekday">On</Label>
                  <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                    <SelectTrigger id="schedule-weekday" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((label, index) => (
                        <SelectItem key={label} value={String(index)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {cadence === 'monthly' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="schedule-day">On day</Label>
                  <Input id="schedule-day" inputMode="numeric" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-hour">At</Label>
                <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  <SelectTrigger id="schedule-hour" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-zone">Time zone</Label>
                <Input id="schedule-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Asia/Kolkata" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-format">As</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger id="schedule-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMAT_LABELS[f] ?? f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Recipients</legend>
              <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {members.map((member) => (
                  <label key={member.user_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={recipients.has(member.user_id)}
                      onChange={(e) =>
                        setRecipients((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(member.user_id);
                          else next.delete(member.user_id);
                          return next;
                        })
                      }
                    />
                    {name(member)}
                  </label>
                ))}
              </div>
            </fieldset>
            {failure && <FormMessage>{failure}</FormMessage>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button type="submit" form="report-schedule" disabled={busy !== null}>
            {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Add schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
