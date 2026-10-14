import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useBusy, useBusyAction } from '@/lib/useBusy';
import { cn } from '@/lib/utils';

interface ActionButtonProps
  extends Omit<ComponentProps<typeof Button>, 'onClick' | 'asChild' | 'children'> {
  /**
   * The work the press starts. Sync or async; reporting its own failure stays its job —
   * this only owns what the button looks like while it runs.
   */
  onAction: () => unknown;
  /** Leading icon, replaced by a spinner while the work runs (or spun in place — see `spinIcon`). */
  icon?: LucideIcon;
  /**
   * Spin the icon in place rather than swapping it for a spinner. For the icons that are
   * already a rotation — a refresh or sync arrow — where a swap replaces one circular glyph
   * with another for no reason.
   */
  spinIcon?: boolean;
  /**
   * Raised when the same work is also tracked outside this button — a page hook's `loading`,
   * a dialog's `saving`. Merged with the button's own flag, and held to the same visible
   * minimum, so a press and an externally-triggered reload look identical.
   */
  busy?: boolean;
  /** Replaces the label while busy. Omit to keep the label — and the button's width — steady. */
  busyLabel?: string;
  children?: ReactNode;
}

/**
 * A button whose press is always acknowledged.
 *
 * Every asynchronous button in this app used to render its feedback from a flag raised when
 * the request left and lowered when it answered. Against an API on the same machine that is
 * 10–40 ms — one frame — so the spinner was mounted and unmounted without ever being drawn,
 * and a press on a healthy deployment was indistinguishable from pressing a button that
 * was not wired up. `useBusyAction` puts a floor under that: the work is unchanged and
 * nothing is delayed, but the acknowledgement lasts long enough to be seen.
 *
 * `aria-busy` carries the same fact to assistive technology, and a press holds the button
 * inert for the whole acknowledgement, so a double press cannot queue the work twice.
 */
const ActionButton = ({
  onAction,
  icon: Icon,
  spinIcon = false,
  busy: externalBusy = false,
  busyLabel,
  disabled,
  children,
  ...props
}: ActionButtonProps) => {
  const { run, busy: pressed } = useBusyAction(onAction);
  // Shown from the sustained flag, but made inert from the raw one. A caller's flag is
  // held on screen past the end of the work it describes, and a control that stayed
  // unclickable for that tail would refuse the press that comes right after a fast reload
  // — feedback turning into an obstacle. Its own press is a different matter: that one is
  // inert for the whole hold, which is what stops a double press queueing the work twice.
  const sustained = useBusy(externalBusy);
  const busy = pressed || sustained;
  const inert = disabled || pressed || externalBusy;

  return (
    <Button
      {...props}
      disabled={inert}
      aria-busy={busy || undefined}
      onClick={() => {
        // The action is supposed to report its own failure — every one in this app does,
        // through a toast. One that does not would otherwise surface as an unhandled
        // rejection with no button and no page attached to it, so the console is the
        // record here, the same rule `reportRenderError` follows.
        void run().catch((error: unknown) => {
          console.error('[action] a button press failed', error);
        });
      }}
    >
      {busy && (!Icon || !spinIcon) ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className={cn('size-4', busy && 'animate-spin')} aria-hidden="true" />
      )}
      {busy && busyLabel ? busyLabel : children}
    </Button>
  );
};

export default ActionButton;
