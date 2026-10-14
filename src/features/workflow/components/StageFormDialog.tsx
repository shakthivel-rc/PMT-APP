import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import type { StageColor, StatusCategory } from '@/types';
import type { WorkflowDraftStage } from '@/types/workflow';
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
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: StatusCategory; label: string; description: string; defaultColor: StageColor }[] = [
  { value: 'todo', label: 'To Do', description: 'Not started / Backlog', defaultColor: 'neutral' },
  { value: 'in_progress', label: 'In Progress', description: 'Active work items', defaultColor: 'primary' },
  { value: 'done', label: 'Done', description: 'Delivered and closed work', defaultColor: 'success' },
  { value: 'canceled', label: 'Canceled', description: 'Closed without delivery', defaultColor: 'danger' },
];

const COLORS: { value: StageColor; label: string }[] = [
  { value: 'neutral', label: 'Neutral (Gray)' },
  { value: 'info', label: 'Info (Sky Blue)' },
  { value: 'primary', label: 'Primary (Blue)' },
  { value: 'success', label: 'Success (Green)' },
  { value: 'warning', label: 'Warning (Amber)' },
  { value: 'danger', label: 'Danger (Red)' },
];

interface StageFormDialogProps {
  open: boolean;
  stage?: WorkflowDraftStage | null;
  existingNames: string[];
  onSave: (stage: WorkflowDraftStage) => void;
  onCancel: () => void;
}

export const StageFormDialog = ({
  open,
  stage,
  existingNames,
  onSave,
  onCancel,
}: StageFormDialogProps) => {
  const isEditing = Boolean(stage);
  const [name, setName] = useState(stage?.name ?? '');
  const [category, setCategory] = useState<StatusCategory>((stage?.category as StatusCategory) || 'in_progress');
  const [color, setColor] = useState<StageColor>((stage?.color as StageColor) || 'primary');
  const [colorManuallySet, setColorManuallySet] = useState(false);
  const [wipLimit, setWipLimit] = useState<string>(stage?.wip_limit ? String(stage.wip_limit) : '');
  const [countsTowardWip, setCountsTowardWip] = useState(
    stage?.counts_toward_wip ?? (stage ? stage.category === 'in_progress' : true),
  );
  const [error, setError] = useState<string | null>(null);

  const handleCategoryChange = (cat: StatusCategory) => {
    setCategory(cat);
    const def = CATEGORIES.find((c) => c.value === cat);
    if (def && !colorManuallySet && !stage) {
      setColor(def.defaultColor);
    }
    if (cat === 'in_progress') {
      setCountsTowardWip(true);
    } else {
      setCountsTowardWip(false);
    }
  };

  const handleColorChange = (newColor: StageColor) => {
    setColor(newColor);
    setColorManuallySet(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Stage name is required.');
      return;
    }
    if (trimmed.length > 50) {
      setError('Stage name must be at most 50 characters.');
      return;
    }

    const isDuplicate = existingNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase() && (!isEditing || n.toLowerCase() !== stage?.name.toLowerCase()),
    );
    if (isDuplicate) {
      setError('A stage with this name already exists in this workflow.');
      return;
    }

    const parsedWip = wipLimit.trim() ? parseInt(wipLimit.trim(), 10) : null;
    if (parsedWip !== null && (isNaN(parsedWip) || parsedWip < 1 || parsedWip > 999)) {
      setError('WIP limit must be between 1 and 999.');
      return;
    }

    onSave({
      ref: stage?.ref ?? `new:stage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      category,
      color,
      wip_limit: parsedWip,
      counts_toward_wip: countsTowardWip,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Stage' : 'Add New Stage'}</DialogTitle>
          <DialogDescription>
            Configure the status name, reporting category, color, and work-in-progress limit.
          </DialogDescription>
        </DialogHeader>
        <form id="stage-form" onSubmit={handleSubmit}>
          <DialogBody className="grid gap-4 py-2">
            {error && (
              <p className="rounded-md bg-danger-subtle p-2 text-xs text-danger" role="alert">
                {error}
              </p>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="stage-name">Stage Name</Label>
              <Input
                id="stage-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Code Review, Testing, QA"
                maxLength={50}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stage-category">Reporting Category</Label>
              <Select value={category} onValueChange={(val) => handleCategoryChange(val as StatusCategory)}>
                <SelectTrigger id="stage-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="font-medium">{cat.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">— {cat.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines how burndown charts, lead times, and timesheets track issues in this column.
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label id="stage-color-label" htmlFor="stage-color" className="text-sm font-medium">Color Badge</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Live Preview:</span>
                  <StatusBadge tone={color}>{name.trim() || 'Stage Preview'}</StatusBadge>
                </div>
              </div>
              <div
                id="stage-color"
                role="radiogroup"
                aria-labelledby="stage-color-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {COLORS.map((c) => {
                  const isSelected = color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleColorChange(c.value)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all cursor-pointer',
                        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-primary bg-primary/10 font-semibold text-foreground shadow-xs ring-1 ring-primary'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <StatusBadge tone={c.value} className="text-[11px] px-1.5 py-0.5">
                        {c.label}
                      </StatusBadge>
                      {isSelected ? (
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stage-wip">WIP Limit (Optional)</Label>
              <Input
                id="stage-wip"
                type="number"
                min={1}
                max={999}
                value={wipLimit}
                onChange={(e) => setWipLimit(e.target.value)}
                placeholder="No limit"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of active work items (stories, tasks, bugs) recommended for this stage.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="stage-wip-toggle" className="text-sm">Counts toward WIP</Label>
                <p className="text-xs text-muted-foreground">
                  Include issues in this stage in the team's total work-in-progress count.
                </p>
              </div>
              <Switch
                id="stage-wip-toggle"
                checked={countsTowardWip}
                onCheckedChange={setCountsTowardWip}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Save Changes' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StageFormDialog;
