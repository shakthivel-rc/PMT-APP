import { useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { createSavedReportApi, updateSavedReportApi } from '@/api/reports';
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
import type { ReportParams, SavedReport, SavedReportVisibility } from '@/types/reports';

/*
 * Save a report — its type and its filters, which is all a report is — under a name, for
 * yourself or for the whole workspace. Pinned reports open the Reports home. Editing an
 * existing one (`saved`) updates it in place, filters included: "save" after changing a
 * filter on a saved report means keep the change.
 */

interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  reportType: string;
  defaultName: string;
  params: ReportParams;
  saved?: SavedReport | null;
  onSaved: (saved: SavedReport) => void;
}

export function SaveReportDialog({ open, onOpenChange, workspaceId, reportType, defaultName, params, saved, onSaved }: SaveReportDialogProps) {
  const [name, setName] = useState(saved?.name ?? defaultName);
  const [visibility, setVisibility] = useState<SavedReportVisibility>(saved?.visibility ?? 'private');
  const [pinned, setPinned] = useState(saved?.pinned ?? false);
  const [asNew, setAsNew] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const updating = Boolean(saved && saved.can_edit && !asNew);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setFailure('Give the report a name.');
    setFailure(null);
    startTransition(async () => {
      try {
        const result =
          updating && saved
            ? await updateSavedReportApi(workspaceId, saved.id, { name: trimmed, params, visibility, pinned })
            : await createSavedReportApi(workspaceId, { name: trimmed, report_type: reportType, params, visibility, pinned });
        onSaved(result);
        onOpenChange(false);
      } catch (err) {
        setFailure(err instanceof Error ? err.message : 'The report could not be saved. Try again.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{updating ? 'Update saved report' : 'Save report'}</DialogTitle>
          <DialogDescription>Saves the report and its current filters.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="save-report" onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="saved-name">Name</Label>
              <Input id="saved-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="saved-visibility">Who can open it</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as SavedReportVisibility)}>
                <SelectTrigger id="saved-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Only me</SelectItem>
                  <SelectItem value="workspace">Everyone in the workspace</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sharing shares the filters, not the numbers: each person sees what their own access allows.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="saved-pinned">Pin to the Reports home</Label>
              <Switch id="saved-pinned" checked={pinned} onCheckedChange={setPinned} />
            </div>
            {saved && saved.can_edit && (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="saved-as-new">Save as a new report</Label>
                <Switch id="saved-as-new" checked={asNew} onCheckedChange={setAsNew} />
              </div>
            )}
            {failure && <FormMessage>{failure}</FormMessage>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="save-report" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {updating ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
