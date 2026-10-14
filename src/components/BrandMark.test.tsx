import { describe, it, expect } from 'vitest';
import { render } from '@/test/renderWithProviders';
import BrandMark from '@/components/BrandMark';

/**
 * The mark is duplicated verbatim in `index.html`'s favicon, and nothing in the build
 * connects the two — a favicon is fetched as a standalone document and cannot import a
 * component. These tests are the only thing that will notice a drift, so they assert the
 * geometry itself rather than "it renders".
 */
describe('BrandMark', () => {
  const markup = () => render(<BrandMark />).container.querySelector('svg')!;

  it('draws the shared geometry: two lower layers and the top layer above them', () => {
    const svg = markup();

    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    const paths = [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(paths).toEqual([
      'M7 17l9 4.5 9-4.5M7 21.5l9 4.5 9-4.5', // the two lower layers, as open chevrons
      'M16 6.5l9 4.5-9 4.5-9-4.5z', // the top layer, a closed diamond
    ]);
  });

  it('lights the top layer and dims the lower ones, rather than colouring them differently', () => {
    // Reaching for a second hue would mean `--accent`, which in shadcn is a muted hover
    // surface — pale grey on a blue badge. The difference here is opacity and weight,
    // both of which survive any theme.
    const svg = markup();
    const [lower, top] = [...svg.querySelectorAll('path')];

    expect(lower.getAttribute('opacity')).toBe('0.5');
    expect(top.getAttribute('opacity')).toBeNull();
    expect(Number(top.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(lower.getAttribute('stroke-width')),
    );
  });

  it('joins the layers’ corners, so each point is rounded rather than spurred', () => {
    // Without strokeLinejoin the side points of the diamond and the chevrons render as
    // miter spurs at this stroke width, which read as a rendering artefact.
    expect(markup().querySelector('g')!.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('colours itself from tokens only, so it themes with the rest of the app', () => {
    const svg = markup();

    expect(svg.querySelector('rect')!.getAttribute('class')).toContain('fill-primary');
    expect(svg.querySelector('g')!.getAttribute('class')).toContain('stroke-primary-foreground');
    // A literal colour anywhere would look right in the default theme and wrong in nine others.
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('is hidden from assistive technology, because the wordmark beside it is the name', () => {
    const svg = markup();

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('rounds its own box so a caller-supplied shadow follows the badge', () => {
    // rx=9 on a 32 viewBox. Without this the `shadow-[var(--shadow-primary)]` both call
    // sites pass would cast from a square, leaving visible corners around a rounded mark.
    const svg = render(<BrandMark className="size-9 shadow-[var(--shadow-primary)]" />)
      .container.querySelector('svg')!;

    expect(svg.getAttribute('class')).toContain('rounded-[28%]');
    expect(svg.getAttribute('class')).toContain('size-9');
    // The caller's size wins over the default rather than fighting it in the class string.
    expect(svg.getAttribute('class')).not.toMatch(/\bsize-8\b/);
  });
});
