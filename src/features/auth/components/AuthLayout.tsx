import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BRAND_NAME, titleForAuthPath } from '@/config/nav';
import BrandMark from '@/components/BrandMark';
import ThemeToggle from '@/components/ThemeToggle';

/** Themed, responsive shell for every auth screen (replaces the hard-coded dark gradient). */
const AuthLayout = () => {
  const { pathname } = useLocation();

  // AuthLayout has no shell, so it owns its own title. Otherwise the tab reads just the brand name
  // through the entire sign-in and password-reset flow, and so does every history entry.
  useEffect(() => {
    document.title = `${titleForAuthPath(pathname)} · ${BRAND_NAME}`;
  }, [pathname]);

  return (
  <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
    {/* Decorative, token-driven glow — theme-aware */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]" />
      <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-chart-3/10 blur-[120px]" />
    </div>

    <div className="absolute right-4 top-4">
      <ThemeToggle />
    </div>

    <div className="mb-8 flex items-center gap-2.5">
      <BrandMark className="size-9 shadow-[var(--shadow-primary)]" />
      <span className="text-2xl font-bold tracking-tight">{BRAND_NAME}</span>
    </div>

    <div className="w-full max-w-md">
      <Outlet />
    </div>

    <p className="mt-8 text-xs text-muted-foreground">
      Secure sign-in, user management and role-based access control.
    </p>
  </div>
  );
};

export default AuthLayout;
