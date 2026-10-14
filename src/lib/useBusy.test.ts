/**
 * The two busy-state primitives.
 *
 * The property under test in every case below is the one the UI depends on: that a busy
 * flag which is raised is *observably* raised for a human-visible span, even when the work
 * beneath it finishes in a millisecond. Timers are faked and advanced explicitly, because
 * the whole subject of these tests is when a flag falls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { MIN_BUSY_MS, useBusy, useBusyAction } from './useBusy';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useBusy', () => {
  it('is false while nothing is happening', () => {
    const { result } = renderHook(() => useBusy(false));
    expect(result.current).toBe(false);
  });

  it('reports busy on the render the flag is raised, not a frame later', () => {
    // The effect that latches `held` runs after the commit. If the hook returned only
    // `held`, every spinner in the app would appear one frame late on a slow request.
    const { result, rerender } = renderHook(({ active }) => useBusy(active), {
      initialProps: { active: false },
    });

    rerender({ active: true });
    expect(result.current).toBe(true);
  });

  it('holds a flag that falls immediately for the full minimum', async () => {
    const { result, rerender } = renderHook(({ active }) => useBusy(active), {
      initialProps: { active: false },
    });

    rerender({ active: true });
    expect(result.current).toBe(true);

    // The request answered at once — which is the case this hook exists for.
    rerender({ active: false });
    expect(result.current).toBe(true);

    await advance(MIN_BUSY_MS - 1);
    expect(result.current).toBe(true);

    await advance(1);
    expect(result.current).toBe(false);
  });

  it('adds nothing to a request that already outlasts the minimum', async () => {
    const { result, rerender } = renderHook(({ active }) => useBusy(active), {
      initialProps: { active: true },
    });

    await advance(MIN_BUSY_MS * 2);
    expect(result.current).toBe(true);

    // Released on the next macrotask rather than in the same commit — the hold is over, so
    // nothing waits on the clock, but the release still goes through the timer.
    rerender({ active: false });
    await advance(0);
    expect(result.current).toBe(false);
  });

  it('restarts the clock when the flag is raised again mid-hold', async () => {
    const { result, rerender } = renderHook(({ active }) => useBusy(active), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    await advance(MIN_BUSY_MS - 100);

    rerender({ active: true });
    rerender({ active: false });

    await advance(MIN_BUSY_MS - 1);
    expect(result.current).toBe(true);
    await advance(1);
    expect(result.current).toBe(false);
  });

  it('honours a caller-supplied minimum', async () => {
    const { result, rerender } = renderHook(({ active }) => useBusy(active, 50), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    await advance(49);
    expect(result.current).toBe(true);
    await advance(1);
    expect(result.current).toBe(false);
  });
});

describe('useBusyAction', () => {
  it('starts idle and runs the action when asked', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useBusyAction(action));

    expect(result.current.busy).toBe(false);

    act(() => {
      void result.current.run();
    });
    expect(result.current.busy).toBe(true);

    await advance(MIN_BUSY_MS);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
  });

  it('stays busy for the minimum even when the action resolves instantly', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useBusyAction(action));

    act(() => {
      void result.current.run();
    });
    await advance(MIN_BUSY_MS - 1);
    expect(result.current.busy).toBe(true);

    await advance(1);
    expect(result.current.busy).toBe(false);
  });

  it('stays busy for as long as a slow action actually takes', async () => {
    let release: () => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useBusyAction(action));

    act(() => {
      void result.current.run();
    });
    await advance(MIN_BUSY_MS * 3);
    expect(result.current.busy).toBe(true);

    await act(async () => {
      release();
    });
    expect(result.current.busy).toBe(false);
  });

  it('passes its arguments through to the action', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useBusyAction(action));

    act(() => {
      void result.current.run('a', 2);
    });
    await advance(MIN_BUSY_MS);

    expect(action).toHaveBeenCalledWith('a', 2);
  });

  it('clears the flag when the action rejects, rather than sticking on, and re-throws', async () => {
    const action = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useBusyAction(action));

    const caught = vi.fn();
    act(() => {
      void result.current.run().catch(caught);
    });
    await advance(MIN_BUSY_MS);

    expect(result.current.busy).toBe(false);
    expect(caught).toHaveBeenCalledWith(new Error('nope'));
  });

  it('treats a synchronous throw as a rejection', async () => {
    const action = vi.fn(() => {
      throw new Error('nope');
    });
    const { result } = renderHook(() => useBusyAction(action));

    const caught = vi.fn();
    act(() => {
      void result.current.run().catch(caught);
    });
    await advance(MIN_BUSY_MS);

    expect(result.current.busy).toBe(false);
    expect(caught).toHaveBeenCalledWith(new Error('nope'));
  });

  it('always calls the newest action, not the one captured on first render', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ action }) => useBusyAction(action), {
      initialProps: { action: first },
    });

    rerender({ action: second });
    act(() => {
      void result.current.run();
    });
    await advance(MIN_BUSY_MS);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not set state after the component has gone', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useBusyAction(action));

    act(() => {
      void result.current.run();
    });
    unmount();

    // A pending hold that fired against a dead component is what React warns about; the
    // test fails on the warning, so reaching the end of this is the assertion.
    await advance(MIN_BUSY_MS * 2);
  });
});
