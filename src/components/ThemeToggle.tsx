import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setTheme, toggleTheme } from '@/features/ui/uiSlice';
import { SYSTEM_THEME, THEME_MODES, THEMES } from '@/features/ui/themes';
import { resolveTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeSwatch from './ThemeSwatch';

/**
 * The quick theme control in the header.
 *
 * The fastest action stays one click — flip to the other scheme — so the icon button keeps
 * exactly its old behaviour, and the full list of themes lives behind the adjacent
 * chevron. Anyone who only ever wanted light and dark never has to learn a menu.
 */
const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, dayTheme, nightTheme } = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();
  const active = resolveTheme({ preference: theme, dayTheme, nightTheme });
  const isDark = THEME_MODES[active] === 'dark';

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={() => dispatch(toggleTheme())}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? 'dark' : 'light'}
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="inline-flex"
          >
            {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </motion.span>
        </AnimatePresence>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Choose a theme">
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => dispatch(setTheme(SYSTEM_THEME))} className="gap-2">
            <Monitor className="size-4" aria-hidden="true" />
            <span className="flex-1">Sync with system</span>
            {theme === SYSTEM_THEME && <Check className="size-4 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {THEMES.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => dispatch(setTheme(option.id))}
              className="gap-2"
            >
              <ThemeSwatch themeId={option.id} className="h-5 w-8 p-1" />
              <span className="flex-1 truncate">{option.name}</span>
              {theme === option.id && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ThemeToggle;
