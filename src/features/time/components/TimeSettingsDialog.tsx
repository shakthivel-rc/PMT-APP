import { useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { updateTimeSettingsApi } from '@/api/timeTracking';
import type { TimeTrackingSettings, TimeVisibility, WeekStart } from '@/types';
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

interface TimeSettingsDialogProps {
  workspaceId: string;
  workspaceName: string;
  settings: TimeTrackingSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: TimeTrackingSettings) => void;
}

/**
 * A workspace's time-tracking settings. Admins only — the screen offers it only to them, and
 * the API refuses anyone else. Remounted per open (by `key`), so it starts from what is saved.
 *
 * Visibility is the one with consequences beyond arithmetic, so it says them: whether members
 * can read each other's hours is a privacy decision (in some countries a works-council one),
 * not a display preference.
 */
const TimeSettingsDialog = ({ workspaceId, workspaceName, settings, open, onOpenChange, onSaved }: TimeSettingsDialogProps) => {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [hours, setHours] = useState(String(settings.hours_per_day));
  const [days, setDays] = useState(String(settings.days_per_week));
  const [visibility, setVisibility] = useState<TimeVisibility>(settings.visibility);
  const [weekStart, setWeekStart] = useState<WeekStart>(settings.week_start);
  const [billableDefault, setBillableDefault] = useState(settings.billable_default ?? true);
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hoursPerDay = Number(hours);
    const daysPerWeek = Number(days);
    // The API's own bounds (`TimeTrackingSettings` in pmt-api), checked here to name the fix.
    if (!(hoursPerDay >= 1 && hoursPerDay <= 24)) return setFailure('A working day is between 1 and 24 hours.');
    if (!(Number.isInteger(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7)) {
      return setFailure('A working week is a whole number of days from 1 to 7.');
    }
    startTransition(async () => {
      try {
        const saved = await updateTimeSettingsApi(workspaceId, {
          enabled,
          hours_per_day: hoursPerDay,
          days_per_week: daysPerWeek,
          visibility,
          week_start: weekStart,
          billable_default: billableDefault,
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
          <DialogTitle>Time tracking settings</DialogTitle>
          <DialogDescription>For everyone in {workspaceName}.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="time-settings" onSubmit={submit} className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ts-enabled" className="flex-col items-start gap-0.5">
                <span>Time tracking on</span>
                <span className="text-xs font-normal text-muted-foreground">Off stops new time; logged time stays readable.</span>
              </Label>
              <Switch id="ts-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ts-hours">Hours in a day</Label>
                {/* No min/max/step: the browser would refuse the submit with a message that names no
                    fix (7.3 "is not a valid value"), so the bounds are checked in `submit`. */}
                <Input id="ts-hours" type="number" step="any" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ts-days">Days in a week</Label>
                <Input id="ts-days" type="number" step="any" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">What 1d and 1w mean when someone types a duration.</p>
            <div className="grid gap-1.5">
              <Label htmlFor="ts-visibility">Who sees whose time</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as TimeVisibility)}>
                <SelectTrigger id="ts-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Every member sees everyone's entries</SelectItem>
                  <SelectItem value="own">Members see only their own; admins see all</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Issue totals stay visible to everyone either way. Hiding colleagues' hours is a privacy choice — in some
                countries one your works council has a say in.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ts-week">Weeks start on</Label>
              <Select value={weekStart} onValueChange={(v) => setWeekStart(v as WeekStart)}>
                <SelectTrigger id="ts-week" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ts-billable" className="flex-col items-start gap-0.5">
                <span>New time is billable</span>
                <span className="text-xs font-normal text-muted-foreground">
                  The default when logging; anyone can change it per entry. Reports filter on it.
                </span>
              </Label>
              <Switch id="ts-billable" checked={billableDefault} onCheckedChange={setBillableDefault} />
            </div>
            {failure && <FormMessage>{failure}</FormMessage>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="time-settings" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeSettingsDialog;
