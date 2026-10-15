import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logoutUser } from '@/features/auth/authSlice';
import { toggleFocusMode, toggleSidebar, toggleTree } from '@/features/ui/uiSlice';
import { BRAND_NAME, titleForPath } from '@/config/nav';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import RouteError from '@/components/RouteError';
import PageLoader from '@/components/PageLoader';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';
import { useCommandPalette } from '@/features/command/useCommandPalette';

const AIChatDrawer = lazyWithRetry(() => import('@/features/chat/components/AIChatDrawer'), 'AIChatDrawer');
const CommandPalette = lazyWithRetry(() => import('@/features/command/CommandPalette'), 'CommandPalette');

const AppShell = () => {
  useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed, focusMode } = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();
  const handleLogout = () => dispatch(logoutUser());
  const title = titleForPath(location.pathname);

  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global hotkeys: Shift+F for Focus Mode, [ for primary sidebar, \ for space tree
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        dispatch(toggleFocusMode());
      } else if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dispatch(toggleSidebar());
      } else if ((e.key === ']' || e.key === '\\') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dispatch(toggleTree());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  /*
   * Navigation used to be completely silent to assistive technology: activating a sidebar
   * link swapped the whole main region while focus stayed on the link, with no
   * announcement, no focus move, and the same `document.title` for the entire session --
   * `<title>Base Project</title>` on every screen. A screen-reader user got no signal that
   * anything had happened and had to re-explore the document to find out.
   */

  // The tab title, and therefore the browser history entry. `titleForPath` already exists
  // for the visible header, so there is no second source of truth here.
  useEffect(() => {
    document.title = `${title} · ${BRAND_NAME}`;
  }, [title]);

  // Move focus into the new content -- but never on first mount, which would yank focus
  // from wherever the user legitimately is just after signing in.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/*
        First focusable element on the page. Without it every navigation costs a keyboard
        user every sidebar link plus the theme toggle and the account menu before
        reaching content. Hidden until focused, which is what `focus:not-sr-only` buys.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to content
      </a>

      {/*
        The destination, announced politely. The page NAME only: the content itself is read
        out when focus lands in <main> immediately after, and announcing both would say
        everything twice.
      */}
      <div className="sr-only" role="status" aria-live="polite">
        {title}
      </div>

      {/* Desktop rail: Collapsible & hidden in Focus Mode */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-sidebar-border transition-all duration-200 ease-in-out lg:block overflow-hidden',
          focusMode ? 'w-0 border-r-0' : sidebarCollapsed ? 'w-[68px]' : 'w-[250px]'
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onLogout={handleLogout}
          onToggleCollapse={() => dispatch(toggleSidebar())}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          // No X: it lands on the brand bar, and the drawer already closes on Escape, on the
          // overlay and on every nav click. The child clamp is what lets Sidebar shrink
          // inside the now-`overflow-hidden` sheet instead of being cut off at the bottom.
          showCloseButton={false}
          className="w-[280px] border-sidebar-border bg-sidebar p-0 [&>div]:min-h-0 [&>div]:flex-1"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col w-full max-w-full overflow-hidden">
        <Header
          title={title}
          user={user}
          onOpenSidebar={() => setMobileOpen(true)}
          onLogout={handleLogout}
        />

        {/* tabIndex={-1} makes <main> programmatically focusable without putting it in
            the tab order. */}
        <main id="main" ref={mainRef} tabIndex={-1} className="flex flex-col min-h-0 flex-1 w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto focus:outline-none">
          <RouteError resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              {/*
                The route wrapper, deliberately inert.
                *Whether a page is on screen may not depend on an animation completing.*

                This was an `AnimatePresence mode="wait"` wrapping a `motion.div` whose
                `initial` was `opacity: 0`. Two properties of that arrangement are wrong for
                something every screen renders through, and both fail the same way — a shell
                that looks perfectly healthy around an empty content area:

                  - `mode="wait"` gates *mounting* the incoming route on the outgoing one's
                    exit animation reporting completion. The new screen's existence is
                    downstream of an animation callback, and the presence bookkeeping that
                    tracks it sits directly above a `Suspense` boundary whose children are
                    `React.lazy` — so the entering child can suspend in the middle of the
                    hand-off.
                  - `initial={{ opacity: 0 }}` means the resting state of an un-animated
                    element is invisible. Anything that stops the animation loop — not just a
                    bug in it — leaves a fully mounted, correctly laid-out page painting
                    nothing.

                A plain keyed div has neither property: `key` remounts it per route, so
                content is mounted the moment the route changes, and there is no animated
                property whose resting state could be invisible.

                There is no entrance animation either, and both attempts at one are worth
                recording because each broke something a test already asserts:

                  - `animate-in fade-in-0` sets `--tw-enter-opacity: 0`, which is the same
                    "resting state is invisible" hazard rewritten in CSS. Axe scanning
                    mid-transition reported colour-contrast failures against half-transparent
                    text on four themes.
                  - `animate-in slide-in-from-bottom-2` translates 8px. Transformed
                    descendants contribute to a scroll container's scrollable overflow, so
                    every navigation briefly gave `<main>` a scrollbar.

                A route change is not unsignalled without one: the header title changes, the
                `aria-live` region above announces it, and the sidebar's active pill still
                animates between items via `layoutId`.

                h-full (not just min-h-full) gives children a definite height to resolve
                `h-full` against, so a full-height page fills the viewport exactly instead of
                growing with its content and making the whole page scroll.
              */}
              <div key={location.pathname} className="flex flex-col flex-1 h-full min-h-full w-full max-w-full min-w-0">
                <Outlet />
              </div>
            </Suspense>
          </RouteError>
        </main>
      </div>

      <Suspense fallback={null}>
        <AIChatDrawer />
      </Suspense>

      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </div>
  );
};

export default AppShell;
