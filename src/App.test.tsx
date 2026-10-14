import { afterEach, describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import App from '@/App';
import { loggedInState } from '@/test/fixtures';

afterEach(() => localStorage.clear());

// Full-app render exercises the route guards + lazy screens end-to-end.
describe('App routing guards', () => {
  it('redirects an unauthenticated visit to a protected route onto /login', async () => {
    renderWithProviders(<App />, { initialEntries: ['/'] });
    // ProtectedShell → <Navigate to="/login"> → the public Login screen
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });

  it('renders the authenticated shell when a user is present in state', async () => {
    renderWithProviders(<App />, { preloadedState: loggedInState(), initialEntries: ['/'] });
    // AppShell chrome (brand + nav) mounts around the lazy User Management screen
    expect(await screen.findByText('PMT')).toBeInTheDocument();
    // "User Management" appears as both a header title and a nav label — target the nav link.
    expect(await screen.findByRole('link', { name: 'User Management' })).toBeInTheDocument();
  });

  // The project screens are one lazy chunk of about a dozen modules. The first test to import
  // it pays for transforming all of them, which under coverage instrumentation and a full
  // parallel run can outlast `findBy`'s 1 s default — a slow runner, not a slow screen.
  const LAZY_CHUNK = { timeout: 5_000 };

  it('opens the Projects screen, lazy chunk and all, from its nav route', async () => {
    renderWithProviders(<App />, { preloadedState: loggedInState(), initialEntries: ['/projects'] });
    // The default MSW handlers serve one workspace (src/test/fixtures.ts).
    expect(await screen.findByRole('link', { name: /Acme Engineering/ }, LAZY_CHUNK)).toHaveAttribute(
      'href',
      '/projects/w1',
    );
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens a workspace list by its deep link', async () => {
    renderWithProviders(<App />, { preloadedState: loggedInState(), initialEntries: ['/projects/w1/lists/l1'] });
    expect(await screen.findByRole('region', { name: 'To Do' }, LAZY_CHUNK)).toBeInTheDocument();
  });

  // The paths the API emails (`utils/token.py:app_link` in pmt-api). A link that
  // matched no route used to fall through the catch-all to /login, silently: the person saw
  // the sign-in screen and had no way to finish the reset or accept the invite.
  it.each([
    ['/reset-password?token=abc', 'Set new password'],
    ['/verify-account?token=abc', 'Activate your account'],
  ])('opens the screen an emailed link points at: %s', async (entry, heading) => {
    renderWithProviders(<App />, { initialEntries: [entry] });
    expect(await screen.findByText(heading)).toBeInTheDocument();
  });

  it('opens an emailed link even for a signed-in visitor, instead of redirecting it away', async () => {
    // The link is for whoever the mail went to — often not this browser's user (an admin
    // opening the invite they just sent). The signed-in redirect used to drop the token.
    renderWithProviders(<App />, {
      preloadedState: loggedInState(),
      initialEntries: ['/verify-account?token=abc'],
    });
    expect(await screen.findByText('Activate your account')).toBeInTheDocument();
  });

  it('keeps an emailed link open when a stale session in storage fails on the way in', async () => {
    localStorage.setItem('access_token', 'stale');
    localStorage.setItem('refresh_token', 'stale-refresh');
    const unauthorized = () =>
      HttpResponse.json({ status: 'error', status_code: 401, message: 'expired', data: null }, { status: 401 });
    let refreshRefused = false;
    server.use(
      http.get('*/users/profile', unauthorized),
      http.post('*/user/refresh', () => {
        refreshRefused = true;
        return unauthorized();
      })
    );

    renderWithProviders(<App />, { initialEntries: ['/reset-password?token=abc'] });

    // Only once the refresh has been refused has the session-expired handler run; asserting
    // before that would pass whether or not the handler redirects.
    await waitFor(() => expect(refreshRefused).toBe(true));
    expect(await screen.findByText('Set new password')).toBeInTheDocument();
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
  });
});
