import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet';

/**
 * The sheet's structural contract, pinned — the same one `dialog.test.tsx` pins for the
 * dialog, and for the same reason: a close button carried away by a scrolling container
 * fails no behavioural test.
 *
 * `SheetBody` is a local addition that no screen renders yet (see its comment in
 * `sheet.tsx`), so these tests are the only thing that would notice it breaking before a
 * derived project leans on it. jsdom computes no layout, so these are assertions about
 * which element owns the scroll and what is nested inside what.
 */

const renderSheet = (body = true) =>
  render(
    <Sheet open>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>A title</SheetTitle>
          <SheetDescription>A description</SheetDescription>
        </SheetHeader>
        {body && <SheetBody>Body content</SheetBody>}
        <SheetFooter>
          <button type="button">Done</button>
        </SheetFooter>
      </SheetContent>
    </Sheet>,
  );

const content = () => document.querySelector('[data-slot=sheet-content]')!;
const closeButton = () => document.querySelector('[data-slot=sheet-close]')!;
const slot = (name: string) => document.querySelector(`[data-slot=sheet-${name}]`)!;

describe('the sheet shell', () => {
  it('does not make the sheet its own scroll container', () => {
    renderSheet();
    const cls = content().className;

    expect(cls).toContain('overflow-hidden');
    expect(cls).not.toContain('overflow-y-auto');
    expect(cls).not.toContain('overflow-auto');
  });

  it('caps itself to the viewport so the footer cannot be pushed off-screen', () => {
    renderSheet();

    expect(content().className).toContain('max-h-dvh');
  });

  it('keeps the close button outside the scrolling region', () => {
    renderSheet();

    expect(content().contains(closeButton())).toBe(true);
    expect(slot('body').contains(closeButton())).toBe(false);
  });

  it('puts the scroll on the body and nowhere else', () => {
    renderSheet();
    const cls = slot('body').className;

    expect(cls).toContain('overflow-auto');
    // `min-h-0` lets it shrink so the footer stays pinned; `min-w-0` stops one long
    // unbreakable string widening the whole sheet.
    expect(cls).toContain('min-h-0');
    expect(cls).toContain('min-w-0');
    expect(cls).toContain('flex-1');
  });

  it('pins the header and the footer against the body', () => {
    renderSheet();

    expect(slot('header').className).toContain('shrink-0');
    expect(slot('footer').className).toContain('shrink-0');
  });

  it('leaves room for the close button beside the title', () => {
    renderSheet();

    expect(slot('header').className).toContain('pr-12');
  });

  it('draws the header divider only when a body follows it', () => {
    // Without a body the footer's `border-t` is the single divider; an unconditional
    // `border-b` on the header would sit on top of it and read as a double line.
    renderSheet(false);

    expect(document.querySelector('[data-slot=sheet-body]')).toBeNull();
    expect(slot('header').className).toContain('[&:has(+[data-slot=sheet-body])]:border-b');
    expect(slot('header').className).not.toMatch(/(^|\s)border-b(\s|$)/);
  });

  it('still exposes the title and description to assistive tech', () => {
    renderSheet();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('A title');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('A description');
  });
});
