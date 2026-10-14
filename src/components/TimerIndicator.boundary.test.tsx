import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { makeTimer } from '@/test/fixtures';
import TimerIndicator from '@/components/TimerIndicator';

// A clock that throws, standing in for any fault inside the widget.
vi.mock('@/lib/useNow', () => ({
  useNowSeconds: () => {
    throw new Error('clock broke');
  },
}));

describe('TimerIndicator when it fails', () => {
  it('renders nothing rather than taking the header down with it', async () => {
    // React logs the caught error; that is expected here and is not the assertion.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('*/timer', () => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data: makeTimer() })),
    );
    const { container } = renderWithProviders(
      <header>
        <TimerIndicator />
        <span>Account</span>
      </header>,
    );
    await waitFor(() => expect(screen.getByText('Account')).toBeInTheDocument());
    await waitFor(() => expect(container.querySelector('[role="timer"]')).toBeNull());
    expect(screen.queryByRole('button', { name: /Timer running/ })).not.toBeInTheDocument();
  });
});
