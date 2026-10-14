import { LayoutDashboard, FolderKanban, Timer, BarChart3, Sparkles, ShieldCheck, Activity, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  /** Label in the sidebar. */
  label: string;
  /** Title shown in the header for this route. */
  title: string;
  icon: LucideIcon;
  end?: boolean;
}

/**
 * Single source of truth for navigation, header titles and the brand. One map rather than
 * the two hand-maintained ones this replaced, which had drifted apart.
 */
export const NAV_ITEMS: NavItem[] = [
  // `/` is User Management and the landing screen.
  { to: '/', label: 'User Management', title: 'User Management', icon: LayoutDashboard, end: true },
  // Workspaces, their hierarchy and each list's board. Every `/projects/…` path shares this
  // title through the longest-prefix match below.
  { to: '/projects', label: 'Projects', title: 'Projects', icon: FolderKanban },
  // Time by person, per week — the "vice versa" of the time on each issue. Beside Projects
  // because it is the same work seen from the other side.
  { to: '/timesheet', label: 'Timesheet', title: 'Timesheet', icon: Timer },
  // Time, project, sprint and flow reports (docs/design/08-reports.md in pmt-api).
  { to: '/reports', label: 'Reports', title: 'Reports', icon: BarChart3 },
  // AI Assistant for querying, ticket operations, timesheets, and knowledge base.
  { to: '/chat', label: 'AI Chat', title: 'AI Assistant', icon: Sparkles },
  { to: '/rbac', label: 'Roles & Permissions', title: 'Roles & Permissions', icon: ShieldCheck },
  { to: '/activity', label: 'Activity Log', title: 'Activity Log', icon: Activity },
  { to: '/profile', label: 'Profile', title: 'My Profile', icon: UserRound },
];

export const BRAND_NAME = 'PMT';

/**
 * Titles for the public auth routes, which render under AuthLayout rather than AppShell
 * and so have no nav entry to derive one from. Without these the tab title would stay the
 * bare brand name through the whole sign-in and password-reset flow.
 */
const AUTH_TITLES: Record<string, string> = {
  '/login': 'Sign in',
  '/register': 'Create account',
  '/verify-otp': 'Verify your email',
  '/set-password': 'Set your password',
  '/forgot-password': 'Reset your password',
  '/reset-password': 'Choose a new password',
  '/verify-account': 'Activate your account',
};

export function titleForAuthPath(pathname: string): string {
  return AUTH_TITLES[pathname] ?? BRAND_NAME;
}

export function titleForPath(pathname: string): string {
  // Longest matching prefix wins; exact root handled by `end`.
  const exact = NAV_ITEMS.find((i) => i.to === pathname);
  if (exact) return exact.title;
  const match = NAV_ITEMS.filter((i) => i.to !== '/' && pathname.startsWith(i.to)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];
  return match?.title ?? BRAND_NAME;
}
