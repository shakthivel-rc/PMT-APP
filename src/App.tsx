import { Suspense, useEffect, useRef } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAppSelector, useAppDispatch } from './app/hooks';
import { clearAuthMessages, initializeAuth, sessionExpired } from './features/auth/authSlice';
import { setUnauthorizedHandler } from './api/client';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { applyTheme, resolveTheme } from './lib/theme';
import { SYSTEM_THEME } from './features/ui/themes';

// Layout
import AppShell from './layouts/AppShell';
import RouteError from './components/RouteError';
import PageLoader from './components/PageLoader';
import AuthLayout from './features/auth/components/AuthLayout';
import { Toaster } from './components/ui/sonner';
import ToastBridge from './components/ToastBridge';

// App screens — lazy-loaded so each becomes its own chunk.
// AppShell provides the Suspense fallback + route error boundary.
//
// `lazyWithRetry`, not bare `lazy`: assets are content-hashed and served immutable, so a
// tab open across a deploy holds chunk hashes the server no longer has, and React caches a
// rejected lazy forever. See src/lib/lazyWithRetry.ts.
const Dashboard = lazyWithRetry(() => import('./features/users/components/Dashboard'), 'Dashboard');
const UserProfile = lazyWithRetry(() => import('./features/profile/components/UserProfile'), 'UserProfile');
const ActivityLog = lazyWithRetry(() => import('./features/activity/components/ActivityLog'), 'ActivityLog');
const RolesAndPermissions = lazyWithRetry(() => import('./features/rbac/components/RolesAndPermissions'), 'RolesAndPermissions');
// One chunk for both project screens; features/projects/components/routes.ts says why.
const Projects = lazyWithRetry(
  () => import('./features/projects/components/routes').then((m) => ({ default: m.Projects })),
  'Projects',
);
const Workspace = lazyWithRetry(
  () => import('./features/projects/components/routes').then((m) => ({ default: m.Workspace })),
  'Workspace',
);
// Time by person. Its own chunk: nobody opening a board pays for the timesheet.
const Timesheet = lazyWithRetry(() => import('./features/time/components/Timesheet'), 'Timesheet');
// Reports: one chunk for the home, the report page and the saved/export routes — the charts
// are drawn in-house, so nobody who never opens a report pays for them.
const ReportsHome = lazyWithRetry(
  () => import('./features/reports/routes').then((m) => ({ default: m.ReportsHome })),
  'ReportsHome',
);
const ReportPage = lazyWithRetry(
  () => import('./features/reports/routes').then((m) => ({ default: m.ReportPage })),
  'ReportPage',
);
const SavedReportRoute = lazyWithRetry(
  () => import('./features/reports/routes').then((m) => ({ default: m.SavedReportRoute })),
  'SavedReportRoute',
);
const ReportJobPage = lazyWithRetry(
  () => import('./features/reports/routes').then((m) => ({ default: m.ReportJobPage })),
  'ReportJobPage',
);
const AIChatPage = lazyWithRetry(() => import('./features/chat/components/AIChatPage'), 'AIChatPage');

// Auth screens — lazy too. They were the only eagerly-imported screens, so six components
// nobody signed in ever sees again rode in the initial chunk on every load. The route
// adapters below stay eager: they only bridge callback props and read location.state.
const Login = lazyWithRetry(() => import('./features/auth/components/Login'), 'Login');
const Register = lazyWithRetry(() => import('./features/auth/components/Register'), 'Register');
const ForgotPassword = lazyWithRetry(() => import('./features/auth/components/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyWithRetry(() => import('./features/auth/components/ResetPassword'), 'ResetPassword');
const OTPVerification = lazyWithRetry(() => import('./features/auth/components/OTPVerification'), 'OTPVerification');
const SetPasswordRegistration = lazyWithRetry(
  () => import('./features/auth/components/SetPasswordRegistration'),
  'SetPasswordRegistration',
);
const AcceptInvite = lazyWithRetry(() => import('./features/auth/components/AcceptInvite'), 'AcceptInvite');

const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/verify-otp',
  '/set-password',
  '/forgot-password',
  '/reset-password',
  '/verify-account',
]);

const FullScreenLoader = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-background">
    <Loader2 className="size-8 animate-spin text-primary" />
  </div>
);

/* ------------------------------------------------------------------ *
 * Route guards
 * ------------------------------------------------------------------ */
const ProtectedShell = () => {
  const user = useAppSelector((state) => state.auth.user);
  return user ? <AppShell /> : <Navigate to="/login" replace />;
};

// Mirrors AppShell. The public tree previously had NEITHER: a lazy auth screen would
// suspend with no fallback, and a render error on /login -- the one screen every user
// reaches before anything else -- had no boundary above it and produced a blank page.
const PublicFrame = () => (
  <RouteError>
    <Suspense fallback={<PageLoader />}>
      <AuthLayout />
    </Suspense>
  </RouteError>
);

const PublicOutlet = () => {
  const user = useAppSelector((state) => state.auth.user);
  if (user) return <Navigate to="/" replace />;
  return <PublicFrame />;
};

/* ------------------------------------------------------------------ *
 * Auth route adapters — bridge the existing callback-prop auth screens
 * to the router. (Transitional: replaced with useNavigate() directly
 * when the auth screens are restyled.)
 * ------------------------------------------------------------------ */
const LoginRoute = () => {
  const navigate = useNavigate();
  return (
    <Login
      onForgotPassword={() => navigate('/forgot-password')}
      onRegister={() => navigate('/register')}
    />
  );
};

const RegisterRoute = () => {
  const navigate = useNavigate();
  return (
    <Register
      onLogin={() => navigate('/login')}
      onRegistered={(email) => navigate('/verify-otp', { state: { email } })}
    />
  );
};

const OtpRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  if (!email) return <Navigate to="/register" replace />;
  return (
    <OTPVerification
      email={email}
      onVerified={(verifiedEmail, otp) =>
        navigate('/set-password', { state: { email: verifiedEmail, otp } })
      }
      onLogin={() => navigate('/login')}
    />
  );
};

const SetPasswordRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { email?: string; otp?: string } | null) ?? {};
  if (!state.email || !state.otp) return <Navigate to="/register" replace />;
  return <SetPasswordRegistration email={state.email} otp={state.otp} onLogin={() => navigate('/login')} />;
};

const ForgotPasswordRoute = () => {
  const navigate = useNavigate();
  return <ForgotPassword onLogin={() => navigate('/login')} />;
};

// The two screens an email opens. Their paths and the `?token=` shape are a contract with the
// API, which builds these links in `utils/token.py:app_link` — change one side only with the
// other. The API's tests/integration/test_emailed_links.py follows each link end to end and
// checks this file still declares both routes.
//
// Leaving either screen *replaces* it in history: its token is spent (or refused) by then,
// and Back would otherwise reopen a form that can only fail.
const ResetPasswordRoute = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <ResetPassword token={params.get('token')} onLogin={() => navigate('/login', { replace: true })} />
  );
};

const AcceptInviteRoute = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <AcceptInvite token={params.get('token')} onLogin={() => navigate('/login', { replace: true })} />
  );
};

const ActivityRoute = () => {
  const user = useAppSelector((state) => state.auth.user);
  return <ActivityLog currentUser={user} />;
};

/* ------------------------------------------------------------------ */
const App = () => {
  const { user, initializing } = useAppSelector((state) => state.auth);
  const theme = useAppSelector((state) => state.ui.theme);
  const dayTheme = useAppSelector((state) => state.ui.dayTheme);
  const nightTheme = useAppSelector((state) => state.ui.nightTheme);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  // Read by the 401 handler below, which is registered once and must not re-register (and so
  // must not close over `location`) on every navigation.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Handle an unrecoverable 401 in-app (no full-page reload).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      dispatch(sessionExpired());
      // On a public screen there is no session to lose. A stale token left in storage fails
      // `initializeAuth` on the way in, and redirecting then would throw away the page the
      // person asked for — an emailed reset or invite link, token and all — to tell them
      // about a session they were not using.
      if (AUTH_PATHS.has(pathnameRef.current)) return;
      toast.error('Your session has expired. Please sign in again.');
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [dispatch, navigate]);

  // Apply the theme (the pre-paint script in index.html owns the first frame). While the
  // preference is 'system' this also has to re-resolve when the OS flips, which is why it
  // subscribes to the media query rather than reading it once.
  useEffect(() => {
    const selection = { preference: theme, dayTheme, nightTheme };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme(resolveTheme(selection, media.matches));
    sync();
    if (theme !== SYSTEM_THEME) return;
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme, dayTheme, nightTheme]);

  // Clear stale auth errors/success when moving between auth screens.
  useEffect(() => {
    if (AUTH_PATHS.has(location.pathname)) {
      dispatch(clearAuthMessages());
    }
  }, [location.pathname, dispatch]);

  if (initializing) return <FullScreenLoader />;

  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        {/* Authenticated app */}
        <Route element={<ProtectedShell />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          {/* One screen for both: with no list chosen it prompts for one. */}
          <Route path="projects/:workspaceId" element={<Workspace />} />
          <Route path="projects/:workspaceId/lists/:listId" element={<Workspace />} />
          <Route path="projects/:workspaceId/spaces/:spaceId" element={<Workspace />} />
          <Route path="projects/:workspaceId/spaces/:spaceId/:spaceTab" element={<Workspace />} />
          <Route path="projects/:workspaceId/browse/:issueKey" element={<Workspace />} />
          <Route path="projects/:workspaceId/restructure" element={<Workspace section="restructure" />} />
          <Route path="projects/:workspaceId/settings" element={<Workspace section="settings" />} />
          <Route path="timesheet" element={<Timesheet />} />
          <Route path="reports" element={<ReportsHome />} />
          <Route path="reports/saved/:id" element={<SavedReportRoute />} />
          <Route path="reports/jobs/:id" element={<ReportJobPage />} />
          <Route path="reports/:type" element={<ReportPage />} />
          <Route path="chat" element={<AIChatPage />} />
          <Route path="rbac" element={<RolesAndPermissions />} />
          <Route path="activity" element={<ActivityRoute />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>

        {/* Auth */}
        <Route element={<PublicOutlet />}>
          <Route path="login" element={<LoginRoute />} />
          <Route path="register" element={<RegisterRoute />} />
          <Route path="verify-otp" element={<OtpRoute />} />
          <Route path="set-password" element={<SetPasswordRoute />} />
          <Route path="forgot-password" element={<ForgotPasswordRoute />} />
        </Route>

        {/* The emailed links. Not behind PublicOutlet's signed-in redirect: the link is for
            whoever the mail was sent to, often not this browser's current user (an admin
            opening the invite they just sent), and the redirect dropped its token. */}
        <Route element={<PublicFrame />}>
          <Route path="reset-password" element={<ResetPasswordRoute />} />
          <Route path="verify-account" element={<AcceptInviteRoute />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>

      <Toaster />
      <ToastBridge />
    </MotionConfig>
  );
};

export default App;
