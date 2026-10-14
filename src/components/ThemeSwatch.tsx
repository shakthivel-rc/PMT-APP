import { cn } from '@/lib/utils';

/**
 * A miniature of the UI drawn in a theme's own colours.
 *
 * The wrapper carries `data-theme`, so every rectangle below reads that theme's live
 * tokens through `var(--…)` rather than hard-coded hex. The swatch therefore cannot drift
 * from the palette — change a theme and its preview changes with it.
 */
const ThemeSwatch = ({ themeId, className }: { themeId: string; className?: string }) => (
  <span
    data-theme={themeId}
    aria-hidden="true"
    className={cn(
      'flex h-11 w-16 shrink-0 flex-col justify-between overflow-hidden rounded-md border p-1.5',
      className,
    )}
    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
  >
    <span className="flex items-center gap-1">
      <span className="size-2 rounded-full" style={{ background: 'var(--primary)' }} />
      <span className="h-1 flex-1 rounded-full" style={{ background: 'var(--foreground)', opacity: 0.85 }} />
    </span>
    <span
      className="flex h-4 items-center gap-1 rounded-sm px-1"
      style={{ background: 'var(--card)' }}
    >
      <span className="h-1 w-4 rounded-full" style={{ background: 'var(--muted-foreground)' }} />
      <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
      <span className="size-1.5 rounded-full" style={{ background: 'var(--warning)' }} />
      <span className="size-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
    </span>
  </span>
);

export default ThemeSwatch;
