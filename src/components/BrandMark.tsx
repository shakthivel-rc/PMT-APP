import { cn } from '@/lib/utils';

interface BrandMarkProps {
  /** Sizing and effects for the badge itself, e.g. `size-9 shadow-[var(--shadow-primary)]`. */
  className?: string;
}

/**
 * The Base Project mark: three stacked layers on a primary badge — a base to build on.
 *
 * The top layer is lit; the two beneath it are dimmed. It is a placeholder, meant to be
 * replaced when a project built on this base gets a brand of its own.
 *
 * THE GEOMETRY IS DUPLICATED IN `index.html`'s favicon, which cannot import this file: a
 * favicon is fetched as a standalone document. Nothing in the build connects the two, so
 * `BrandMark.test.tsx` asserts the path data here and the favicon has to be edited by hand
 * alongside it. A logo that is *nearly* the same in two places reads as a mistake in a way
 * that two openly different logos does not.
 *
 * COLOURS ARE TOKENS, NOT LITERALS, so the mark themes itself across all ten palettes. The
 * lit top layer is full-opacity `primary-foreground` against dimmed lower layers rather than a
 * second hue: `--accent` in shadcn is a muted hover surface (`#e2e8f0` light, `#334155`
 * dark), so reaching for it would draw the highlight in pale grey on a blue badge — the
 * failure mode of copying a token name between two design systems that share a word.
 * `primary-foreground` is the only colour *defined* as legible on `--primary`, so it
 * cannot fail on a theme nobody checked.
 */
const BrandMark = ({ className }: BrandMarkProps) => (
  <svg
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
    // `rounded-[28%]` matches the badge's own rx (9/32), so a `shadow-*` passed in by a
    // caller follows the rounded badge instead of casting from a square bounding box.
    className={cn('size-8 shrink-0 rounded-[28%]', className)}
  >
    <rect className="fill-primary" width="32" height="32" rx="9" />
    <g
      className="stroke-primary-foreground"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The two lower layers, dimmed: open chevrons, the edges of the sheets beneath. */}
      <path d="M7 17l9 4.5 9-4.5M7 21.5l9 4.5 9-4.5" strokeWidth="2" opacity="0.5" />
      {/* The top layer: a closed diamond. Lit, and thicker as well as brighter, because on a
          small mark opacity alone is not a reliable difference. */}
      <path d="M16 6.5l9 4.5-9 4.5-9-4.5z" strokeWidth="2.4" />
    </g>
  </svg>
);

export default BrandMark;
