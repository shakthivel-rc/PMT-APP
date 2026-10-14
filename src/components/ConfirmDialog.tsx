import ActionButton from '@/components/ActionButton';
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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Raised by the caller while the confirmed work runs. It used to only grey the two
   * buttons out — for the length of one frame on a fast API, which is to say never — so a
   * press of Delete looked like nothing at all until the row vanished. The confirm button
   * now spins on it, and on its own press, for long enough to be seen either way.
   */
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * Where focus goes once the dialog has closed. Radix gives it back to a `DialogTrigger`, and
   * this dialog is opened from state rather than from one, so without this focus falls to the
   * page. Call `event.preventDefault()` and focus the control that opened the dialog, or, when
   * the confirmed work removed that control (a row's Remove button), something still there.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/** Themed, keyboard-accessible confirmation dialog (replaces window.confirm). */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {/* The description is the body, not part of the header. With both rows `shrink-0` and
          DialogContent `overflow-hidden`, a dialog with no body has nothing that can scroll —
          so a long description (a multi-line warning) pushed Cancel and Confirm past the
          viewport cap and they were clipped, not scrollable. */}
      {description && (
        <DialogBody>
          <DialogDescription>{description}</DialogDescription>
        </DialogBody>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <ActionButton
          variant={destructive ? 'destructive' : 'default'}
          onAction={onConfirm}
          busy={loading}
        >
          {confirmLabel}
        </ActionButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ConfirmDialog;
