import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { server } from '@/test/msw/server';
import { act, renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { makeTimeEntry, makeTimer } from '@/test/fixtures';
import TimerIndicator from '@/components/TimerIndicator';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const ok = (data: unknown) => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });
const refuse = (status: number, message: string) =>
  HttpResponse.json({ status: 'error', status_code: status, message, data: null }, { status });

const running = () => server.use(http.get('*/timer', () => ok(makeTimer({ elapsed_seconds: 125 }))));

const openMenu = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Timer running on PAY-1' }));
  return user;
};

describe('TimerIndicator', () => {
  it('shows nothing when no timer is running — the default world', async () => {
    const { container } = renderWithProviders(<TimerIndicator />);
    // Give the fetch its turn, then check nothing appeared.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the running issue and the time on its clock', async () => {
    running();
    renderWithProviders(<TimerIndicator />);
    // 125 s when the answer arrived, plus however many real seconds the lazy menu took.
    expect(await screen.findByRole('timer')).toHaveTextContent(/^0:02:0\d$/);
  });

  it('stops and says what was logged', async () => {
    running();
    server.use(http.post('*/timer/stop', () => ok({ entry: makeTimeEntry({ duration_seconds: 125 }), capped: false })));
    renderWithProviders(<TimerIndicator />);
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /Stop and log time/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logged 2m on PAY-1.'));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('warns when a forgotten timer was cut to a day, and explains a discarded one', async () => {
    running();
    server.use(http.post('*/timer/stop', () => ok({ entry: makeTimeEntry(), capped: true })));
    renderWithProviders(<TimerIndicator />);
    let user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /Stop and log time/ }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());

    running();
    server.use(http.post('*/timer/stop', () => ok({ entry: null, capped: false })));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /Stop and log time/ }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/discarded/)));
  });

  it('discards without logging, and links to the issue by its list', async () => {
    running();
    server.use(http.delete('*/timer', () => ok({ discarded: true })));
    renderWithProviders(<TimerIndicator />);
    const user = await openMenu();
    expect(screen.getByRole('menuitem', { name: /Open issue/ })).toHaveAttribute(
      'href',
      '/projects/w1/lists/l1?issue=i1',
    );
    await user.click(screen.getByRole('menuitem', { name: /Discard timer/ }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Timer on PAY-1 discarded. Nothing was logged.'));
  });

  it('keeps the timer and says why when stopping or discarding fails', async () => {
    running();
    server.use(
      http.post('*/timer/stop', () => refuse(500, 'The server failed.')),
      http.delete('*/timer', () => refuse(500, 'The server failed again.')),
    );
    renderWithProviders(<TimerIndicator />);
    let user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /Stop and log time/ }));
    // The API's own words, not a generic failure: a rejected thunk is a plain object.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The server failed.'));
    user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /Discard timer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The server failed again.'));
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('re-reads the timer when the tab becomes visible, not while it is hidden', async () => {
    let calls = 0;
    server.use(
      http.get('*/timer', () => {
        calls += 1;
        return ok(null);
      }),
    );
    renderWithProviders(<TimerIndicator />);
    await waitFor(() => expect(calls).toBe(1));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(calls).toBe(2));
  });
});
