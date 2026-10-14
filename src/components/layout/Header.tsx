import { useNavigate } from 'react-router-dom';
import { LogOut, Maximize2, Menu, Minimize2, Sparkles, UserRound } from 'lucide-react';
import { type User, getDisplayName, getUserRoleName } from '@/types/index';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { toggleChatDrawer, toggleFocusMode } from '@/features/ui/uiSlice';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/UserAvatar';
import ThemeToggle from '@/components/ThemeToggle';
import TimerIndicator from '@/components/TimerIndicator';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  user: User | null;
  onOpenSidebar: () => void;
  onLogout: () => void;
}

const Header = ({ title, user, onOpenSidebar, onLogout }: HeaderProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const focusMode = useAppSelector((state) => state.ui.focusMode);
  const chatDrawerOpen = useAppSelector((state) => state.ui.chatDrawerOpen);
  const displayName = user ? getDisplayName(user) : '';
  const roleName = user ? getUserRoleName(user) : '';

  return (
    <header className="sticky top-0 z-30 flex h-[70px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
          onClick={onOpenSidebar}
        >
          <Menu className="size-5" />
        </Button>
        {/*
          A <p>, not an <h1>. This banner is persistent chrome above the routed outlet, and
          the page below it renders its own PageHeader <h1> with the SAME string -- so every
          screen using PageHeader had two h1s with identical text, and a screen-reader user
          navigating by heading got the page title twice with no way to tell which was the
          landmark. Every class is unchanged; only the element is.
        */}
        <p className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Focus Mode button */}
        <Button
          variant={focusMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => dispatch(toggleFocusMode())}
          title={focusMode ? 'Exit Focus Mode (Shift+F)' : 'Enter Focus Mode (Shift+F)'}
          aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          className={cn(
            'h-9 gap-1.5 text-xs transition-colors',
            focusMode && 'bg-primary text-primary-foreground font-semibold shadow-xs'
          )}
        >
          {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          <span className="hidden sm:inline">{focusMode ? 'Exit Focus' : 'Focus'}</span>
        </Button>

        {/* First in the cluster: it is the one thing here that changes while you work. */}
        <TimerIndicator />

        {/* AI Assistant button */}
        <Button
          variant={chatDrawerOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => dispatch(toggleChatDrawer())}
          title={chatDrawerOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
          aria-label={chatDrawerOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
          className={cn(
            'h-9 gap-1.5 px-2.5 sm:px-3 text-xs transition-colors',
            chatDrawerOpen
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-primary hover:text-primary hover:bg-primary/10'
          )}
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 rounded-full pl-1.5 pr-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:pr-2.5"
              aria-label="Account menu"
            >
              <div className="hidden text-right leading-tight md:block">
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="text-xs text-muted-foreground">{roleName}</div>
              </div>
              <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} className="size-9" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserRound className="size-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onLogout}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
