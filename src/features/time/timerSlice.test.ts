import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeStore } from '@/test/renderWithProviders';
import { sessionExpired } from '@/features/auth/authSlice';
import { discardTimer, elapsedAt, fetchTimer, startTimer, stopTimer, timerFailure } from '@/features/time/timerSlice';
import { makeTimeEntry, makeTimer } from '@/test/fixtures';

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

afterEach(() => {
  vi.useRealTimers();
});

describe('timerSlice', () => {
  it('ticks from the moment the answer arrived, not from the server\'s started_at', async () => {
    // The server's clock and this machine's may disagree by minutes; elapsed_seconds plus
    // local seconds since receipt is immune to that, "now - started_at" is not.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    server.use(http.get('*/timer', () => ok(makeTimer({ elapsed_seconds: 100, started_at: '2020-01-01T00:00:00' }))));
    const store = makeStore();
    await store.dispatch(fetchTimer());

    const state = store.getState().timer;
    const receivedAt = Date.parse('2026-10-05T10:00:00Z') / 1000;
    expect(state.receivedAt).toBe(receivedAt);
    expect(elapsedAt(state, receivedAt + 5)).toBe(105);
    expect(elapsedAt(state, receivedAt - 5)).toBe(100);
    expect(elapsedAt({ ...state, timer: null }, receivedAt)).toBe(0);
  });

  it('sends today\'s local date on start, and counts each change', async () => {
    let sent: Record<string, unknown> = {};
    server.use(
      http.post('*/workspaces/w1/issues/i1/timer', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return ok({ timer: makeTimer(), stopped_entry: null }, 201);
      }),
    );
    const store = makeStore();
    await store.dispatch(startTimer({ workspaceId: 'w1', issueId: 'i1' }));
    expect(sent).toEqual({ work_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(store.getState().timer.timer?.issue.key).toBe('PAY-1');
    expect(store.getState().timer.changes).toBe(1);

    await store.dispatch(startTimer({ workspaceId: 'w1', issueId: 'i1', note: 'pairing' }));
    expect(sent.note).toBe('pairing');
  });

  it('clears on stop and on discard', async () => {
    server.use(
      http.get('*/timer', () => ok(makeTimer())),
      http.post('*/timer/stop', () => ok({ entry: makeTimeEntry({ source: 'timer' }), capped: false })),
      http.delete('*/timer', () => ok({ discarded: true })),
    );
    const store = makeStore();
    await store.dispatch(fetchTimer());
    const stopped = await store.dispatch(stopTimer()).unwrap();
    expect(stopped.entry?.source).toBe('timer');
    expect(store.getState().timer.timer).toBeNull();

    await store.dispatch(fetchTimer());
    await store.dispatch(discardTimer());
    expect(store.getState().timer).toMatchObject({ timer: null, changes: 2 });
  });

  it('forgets the timer when the session ends', async () => {
    server.use(http.get('*/timer', () => ok(makeTimer())));
    const store = makeStore();
    await store.dispatch(fetchTimer());
    store.dispatch(sessionExpired());
    expect(store.getState().timer).toEqual({ timer: null, receivedAt: 0, changes: 0 });
  });
});

describe('timerFailure', () => {
  it("keeps the API's message from a rejected thunk and falls back otherwise", () => {
    expect(timerFailure({ message: 'Switched off.' }, 'fallback')).toBe('Switched off.');
    expect(timerFailure({ message: '' }, 'fallback')).toBe('fallback');
    expect(timerFailure(null, 'fallback')).toBe('fallback');
    expect(timerFailure('boom', 'fallback')).toBe('fallback');
  });
});
