import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StageRemovalDialogProps {
  open: boolean;
  stageName: string;
  issueCount: number;
  availableTargets: { ref: string; name: string }[];
  onConfirm: (replacementRef: string) => void;
  onCancel: () => void;
}

/**
 * Prompted when removing a stage that currently holds issues.
 * Ensures no issues are orphaned or lost by requiring explicit reassignment.
 */
export const StageRemovalDialog = ({
  open,
  stageName,
  issueCount,
  availableTargets,
  onConfirm,
  onCancel,
}: StageRemovalDialogProps) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(availableTargets[0]?.ref ?? '');

  const handleConfirm = () => {
    if (selectedTarget) {
      onConfirm(selectedTarget);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle>Reassign issues in "{stageName}"</DialogTitle>
          </div>
          <DialogDescription>
            This stage currently contains <strong>{issueCount}</strong> {issueCount === 1 ? 'issue' : 'issues'}.
            Before removing this stage, choose where existing issues should be moved upon publishing.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="replacement-stage">Move issues to</Label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger id="replacement-stage">
                <SelectValue placeholder="Select target stage" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((target) => (
                  <SelectItem key={target.ref} value={target.ref}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            A status change event will be recorded for each moved issue when the workflow is published.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!selectedTarget}>
            Reassign & Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageRemovalDialog;
