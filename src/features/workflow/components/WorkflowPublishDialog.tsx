import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { WorkflowPreview } from '@/types/workflow';
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
import { categoryLabel } from '@/lib/workflowRules';

interface WorkflowPublishDialogProps {
  open: boolean;
  preview: WorkflowPreview | null;
  isPublishing: boolean;
  onConfirm: (acknowledgeReporting: boolean) => void;
  onCancel: () => void;
}

export const WorkflowPublishDialog = ({
  open,
  preview,
  isPublishing,
  onConfirm,
  onCancel,
}: WorkflowPublishDialogProps) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!preview) return null;

  const hasErrors = preview.errors.length > 0;
  const requiresAck = preview.requires_reporting_ack;
  const canPublish = !hasErrors && (!requiresAck || acknowledged) && !isPublishing;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isPublishing && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review & Publish Workflow</DialogTitle>
          <DialogDescription>
            Publishing updates the stages, board columns, and transition rules for this entire space.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
          {/* Errors */}
          {hasErrors && (
            <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span>Cannot publish workflow due to errors:</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                {preview.errors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                <span>Warnings</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                {preview.warnings.map((warn, idx) => (
                  <li key={idx}>{warn.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid Summary */}
          {!hasErrors && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-subtle p-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Workflow configuration is valid.</span>
            </div>
          )}

          {/* Affected Issues */}
          <div className="rounded-lg border p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impact Summary</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Active Stages:</span>{' '}
                <span className="font-semibold">{preview.stages.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Issues Moving:</span>{' '}
                <span className="font-semibold">{preview.affected_issue_count}</span>
              </div>
            </div>

            {/* Removed Stages */}
            {preview.removed.length > 0 && (
              <div className="mt-3 border-t pt-2 text-xs">
                <p className="font-semibold text-muted-foreground">Removed Stages & Reassignments:</p>
                <ul className="mt-1 space-y-1">
                  {preview.removed.map((rem) => (
                    <li key={rem.id} className="flex justify-between">
                      <span>"{rem.name}" ({rem.issue_count} issues)</span>
                      <span className="text-muted-foreground">→ moves to "{rem.replacement_name ?? 'None'}"</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Category Changes */}
            {preview.category_changes.length > 0 && (
              <div className="mt-3 border-t pt-2 text-xs">
                <p className="font-semibold text-warning">Reporting Category Changes:</p>
                <ul className="mt-1 space-y-1">
                  {preview.category_changes.map((cc) => (
                    <li key={cc.id} className="flex justify-between">
                      <span>"{cc.name}" ({cc.issue_count} issues)</span>
                      <span className="font-mono text-[11px]">
                        {categoryLabel(cc.from_category)} → {categoryLabel(cc.to_category)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Reporting changes acknowledgement */}
          {requiresAck && (
            <label className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-card p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border"
              />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Acknowledge Reporting Changes:</strong> I understand that reclassifying
                populated stages between categories will update historical sprint burndown and cycle time metrics.
              </span>
            </label>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(acknowledged)} disabled={!canPublish}>
            {isPublishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Publish Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowPublishDialog;
