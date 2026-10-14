import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

/**
 * The structural contract, pinned.
 *
 * Vendored primitives are normally not tested; this one is here because the bug it guards
 * was invisible to every existing test. Dialog after dialog passed
 * `max-h-[92dvh] overflow-y-auto` onto `DialogContent`, which made the dialog box its own
 * scroll container — and `position: absolute` resolves against a scroll container's padding
 * box, so the close button translated with the content and slid out of reach on every
 * scroll, sideways and down. Nothing failed. No test asserted on structure, so the whole
 * suite stayed green while the control a reader reaches for first walked off the screen.
 *
 * jsdom computes no layout, so these are assertions about *which element owns the scroll*
 * and *what is nested inside what* — which is precisely where the defect lived.
 */

const renderDialog = (body = true) =>
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A title</DialogTitle>
          <DialogDescription>A description</DialogDescription>
        </DialogHeader>
        {body && <DialogBody>Body content</DialogBody>}
        <DialogFooter>
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );

const content = () => document.querySelector('[data-slot=dialog-content]')!;
const closeButton = () => document.querySelector('[data-slot=dialog-close]')!;

describe('the dialog shell', () => {
  it('does not make the dialog box its own scroll container', () => {
    renderDialog();
    // The defect in one line. `overflow-y-auto` here is what carried the close button away.
    const cls = content().className;

    expect(cls).toContain('overflow-hidden');
    expect(cls).not.toContain('overflow-y-auto');
    expect(cls).not.toContain('overflow-auto');
  });

  it('caps itself to the viewport so a long dialog cannot bury its own footer', () => {
    renderDialog();
    // Without the cap here, a caller that forgets its own lets the footer holding the only
    // Save go off-screen.
    expect(content().className).toContain('max-h-');
  });

  it('keeps the close button outside the scrolling region', () => {
    renderDialog();
    const body = document.querySelector('[data-slot=dialog-body]')!;

    // The whole point: the X is a child of the box that does NOT scroll.
    expect(content().contains(closeButton())).toBe(true);
    expect(body.contains(closeButton())).toBe(false);
  });

  it('puts the scroll on the body and nowhere else', () => {
    renderDialog();
    const body = document.querySelector('[data-slot=dialog-body]')!;

    expect(body.className).toContain('overflow-auto');
    // `min-h-0` lets it shrink so the footer stays pinned; `min-w-0` is the half that stops
    // one long unbreakable token widening the whole dialog.
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('min-w-0');
  });

  it('pins the header and the footer against the body', () => {
    renderDialog();

    expect(document.querySelector('[data-slot=dialog-header]')!.className).toContain('shrink-0');
    expect(document.querySelector('[data-slot=dialog-footer]')!.className).toContain('shrink-0');
  });

  it('puts the actions at the two ends of the bottom bar', () => {
    renderDialog();

    expect(document.querySelector('[data-slot=dialog-footer]')!.className).toContain(
      'sm:justify-between',
    );
  });

  it('leaves room for the close button beside the title', () => {
    renderDialog();

    // Without this the title runs under the X rather than stopping before it.
    expect(document.querySelector('[data-slot=dialog-header]')!.className).toContain('pr-12');
  });

  it('draws no header divider when there is no body to scroll under it', () => {
    // ConfirmDialog is header + footer. An unconditional `border-b` would sit directly on
    // top of the footer's `border-t` and read as a double line.
    renderDialog(false);

    expect(document.querySelector('[data-slot=dialog-body]')).toBeNull();
    expect(document.querySelector('[data-slot=dialog-header]')!.className).toContain(
      '[&:has(+[data-slot=dialog-body])]:border-b',
    );
  });

  it('still exposes the title and description to assistive tech', () => {
    // Radix wires aria-labelledby/describedby off these; a restructure must not break it.
    renderDialog();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('A title');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('A description');
  });
});
