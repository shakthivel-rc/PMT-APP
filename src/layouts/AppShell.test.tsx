import { describe, it, expect, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/renderWithProviders';
import { makeUser } from '@/test/fixtures';
import AppShell from './AppShell';

/**
 * Navigation used to be silent: no document.title change, no focus move, no announcement.
 * These assert the DOM contract that fixes it; a screen-reader pass is what signs it off.
 */
const renderShell = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<div>dashboard content</div>} />
        <Route path="/activity" element={<div>activity content</div>} />
      </Route>
    </Routes>,
    {
      route,
      preloadedState: {
        auth: {
          user: makeUser(),
          isAuthenticated: true,
          loading: false,
          error: null,
          message: null,
        },
      } as never,
    },
  );

beforeEach(() => {
  document.title = 'PMT';
});

describe('<AppShell> route announcement', () => {
  it('writes a per-route document.title so history entries are distinguishable', async () => {
    renderShell('/activity');
    await waitFor(() => expect(document.title).toBe('Activity Log · PMT'));
  });

  it('exposes the destination in a polite live region', () => {
    renderShell('/activity');
    const regions = screen.getAllByRole('status');
    expect(regions.some((r) => r.textContent === 'Activity Log')).toBe(true);
  });

  it('does not steal focus on first mount', () => {
    // Moving focus on initial mount would yank it from wherever the user legitimately is
    // right after signing in.
    renderShell('/');
    expect(document.activeElement).toBe(document.body);
  });

  it('offers a skip link as the first tabbable element', async () => {
    const user = userEvent.setup();
    renderShell('/');

    await user.tab();

    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(document.activeElement).toBe(skip);
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('gives <main> an id and makes it programmatically focusable without adding it to the tab order', () => {
    renderShell('/');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});
