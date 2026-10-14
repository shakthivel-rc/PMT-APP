import { useEffect, useRef, useState } from 'react';
import { Check, Monitor } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setDayTheme, setNightTheme, setTheme } from '@/features/ui/uiSlice';
import { SYSTEM_THEME, THEMES, themesByMode, type ThemeDefinition } from '@/features/ui/themes';
import { applyTheme, resolveTheme } from '@/lib/theme';
import ThemeSwatch from './ThemeSwatch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * The full theme chooser, for the Profile page.
 *
 * Two behaviours are worth keeping. First, hovering or focusing a card previews it on the
 * whole app and releasing restores what was actually chosen — browsing must never become
 * choosing, so a pointer that wanders away leaves the real selection intact. Second,
 * picking "Sync with system" does not hide the theme choice, it reveals two: which theme
 * to use by day and which by night.
 */
const ThemeCard = ({
  theme,
  selected,
  onSelect,
  onPreview,
  onPreviewEnd,
}: {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onPreviewEnd: () => void;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    onMouseEnter={onPreview}
    onMouseLeave={onPreviewEnd}
    onFocus={onPreview}
    onBlur={onPreviewEnd}
    className={cn(
      'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
      'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-hidden',
      selected ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/40 hover:bg-muted/50',
    )}
  >
    <ThemeSwatch themeId={theme.id} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{theme.name}</span>
        {selected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{theme.description}</span>
    </span>
  </button>
);

const ThemePicker = () => {
  const dispatch = useAppDispatch();
  const { theme, dayTheme, nightTheme } = useAppSelector((state) => state.ui);
  const [preview, setPreview] = useState<string | null>(null);
  const committed = useRef<string>('');

  committed.current = resolveTheme({ preference: theme, dayTheme, nightTheme });

  // Preview lives outside Redux on purpose: hovering a card must not persist anything or
  // re-render the app, so it writes the DOM attribute directly and reverts on the way out.
  useEffect(() => {
    applyTheme(preview ?? committed.current);
  }, [preview, theme, dayTheme, nightTheme]);

  const followsSystem = theme === SYSTEM_THEME;

  return (
    <div className="@container space-y-5">
      <button
        type="button"
        role="radio"
        aria-checked={followsSystem}
        onClick={() => dispatch(setTheme(SYSTEM_THEME))}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-hidden',
          followsSystem
            ? 'border-primary bg-primary/8'
            : 'border-border hover:border-primary/40 hover:bg-muted/50',
        )}
      >
        <span className="flex size-11 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
          <Monitor className="size-5 text-muted-foreground" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-medium">Sync with system</span>
            {followsSystem && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Follow your device, switching automatically between your day and night themes.
          </span>
        </span>
      </button>

      {followsSystem && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 @lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="day-theme" className="text-xs">
              Day theme
            </Label>
            <Select value={dayTheme} onValueChange={(value) => dispatch(setDayTheme(value))}>
              <SelectTrigger id="day-theme" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themesByMode('light').map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="night-theme" className="text-xs">
              Night theme
            </Label>
            <Select value={nightTheme} onValueChange={(value) => dispatch(setNightTheme(value))}>
              <SelectTrigger id="night-theme" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themesByMode('dark').map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {(['light', 'dark'] as const).map((mode) => (
        <section key={mode} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {mode === 'light' ? 'Light themes' : 'Dark themes'}
          </h2>
          <div role="radiogroup" aria-label={`${mode} themes`} className="grid gap-2 @lg:grid-cols-2 @3xl:grid-cols-3">
            {THEMES.filter((option) => option.mode === mode).map((option) => (
              <ThemeCard
                key={option.id}
                theme={option}
                selected={theme === option.id}
                onSelect={() => dispatch(setTheme(option.id))}
                onPreview={() => setPreview(option.id)}
                onPreviewEnd={() => setPreview(null)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default ThemePicker;
