import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // A flex COLUMN that never scrolls, capped to the viewport.
          //
          // It used to be a `grid` carrying `p-6` and `gap-4`, and call sites bolted
          // `max-h-[92dvh] overflow-y-auto` onto this same element. That made the dialog box
          // itself the scroll container — and `position: absolute` resolves against a scroll
          // container's padding box and translates with the content, so the close button
          // slid away the moment anything scrolled, sideways or down. The chrome has to sit
          // outside the scroller for the close button to stay where it is put.
          //
          // Flex column rather than `grid-rows-[auto_1fr_auto]` because a row template
          // assumes exactly three children in a fixed order, while a dialog may omit its body
          // or its footer, put a banner above the header, or wrap all three in a `<form>`.
          // Under the template a stray child silently lands in the `1fr` row and becomes the
          // only thing that scrolls. In a flex column, `DialogHeader`/`DialogFooter` are
          // `shrink-0`, `DialogBody` is `flex-1 min-h-0`, and anything else just takes its
          // natural height.
          //
          // `max-h` here rather than at each call site, so no caller can forget it: a dialog
          // without the cap grows past the viewport and its footer becomes unreachable.
          "fixed top-[50%] left-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border bg-background shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            // `z-20` and a hit area rather than a bare icon: it now floats over a header
            // that can carry a long title, and it is the control somebody reaches for first.
            className="absolute top-4 right-4 z-20 inline-flex size-7 items-center justify-center rounded-md opacity-70 ring-offset-background transition-colors hover:bg-destructive/15 hover:text-destructive hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * The pinned top bar: title on the left, close button on the right.
 *
 * `shrink-0` so it never gives up height to a long body, and `pr-12` so a title that runs
 * the width of the dialog stops before the close button rather than under it. Left-aligned
 * at every width — it used to centre on mobile, which put the title under the X.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        // The rule that keeps a body-less dialog from drawing two adjacent lines: the
        // header's border exists only when something scrolls under it. A confirm dialog is
        // header + footer, and there the footer's `border-t` is the single divider.
        "flex min-w-0 shrink-0 flex-col gap-1.5 px-6 pt-6 pr-12 pb-4 text-left [&:has(+[data-slot=dialog-body])]:border-b [&:has(+[data-slot=dialog-body])]:border-border",
        className
      )}
      {...props}
    />
  )
}

/**
 * The only part of a dialog that scrolls.
 *
 * `min-h-0` is what makes it work: a flex item's default `min-height: auto` refuses to
 * shrink below its content, so without it the body pushes the footer off the bottom of the
 * capped dialog instead of scrolling. `overflow-auto` rather than `overflow-y-auto` is a
 * deliberate safety net — content too wide to fit scrolls *inside here*, where the header,
 * the footer and the close button stay put, instead of being clipped out of sight. Wide
 * blocks should still carry their own `overflow-x-auto`; this only catches what slips
 * through.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      // `min-w-0` alongside `min-h-0`, and it is the half that fixes the horizontal
      // scrollbar. A flex item's automatic minimum size refuses to shrink below its
      // content, so one long unbreakable string (a 64-character token or a URL) made the whole
      // dialog wider than its `max-w` — and the close button rode out with it. The old
      // `grid` container had exactly the same rule.
      className={cn("min-h-0 min-w-0 flex-1 overflow-auto px-6 py-4", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      // Pinned bottom bar, and the actions sit at the two ends of it: the way out on the
      // left, the thing the dialog is for on the right. `flex-col-reverse` keeps the primary
      // action on top when the two stack on a narrow screen.
      className={cn(
        "flex min-w-0 shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:[&>*:last-child]:ml-auto",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // `break-words`: titles interpolate user-supplied names (a user or role name), and
      // the header is a fixed row sharing its line with the pinned close button.
      className={cn("text-lg leading-tight font-semibold wrap-anywhere", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm break-words text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
