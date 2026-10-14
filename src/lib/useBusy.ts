import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a busy state stays on screen once it has started.
 *
 * The problem this exists for: every loader in this app is driven by a flag that is raised
 * when a request starts and lowered when it answers, and against a local API most of these
 * requests answer in 10–40 ms. React renders the spinner and un-renders it inside the same
 * frame, so pressing a button on a healthy deployment looks *exactly* like pressing a dead
 * one — the screen quietly updates and nothing ever acknowledged the press.
 *
 * 600 ms is the floor, not a delay added to the work: a request that takes longer than this
 * holds the indicator for exactly as long as it runs. It is above the ~100 ms at which a
 * change reads as instantaneous rather than as a response to what you did, and well below
 * the ~1 s at which a wait starts to feel like the app has stalled.
 */
export const MIN_BUSY_MS = 600;

/**
 * Hold an existing loading flag on screen long enough to be seen.
 *
 * For the callers that already own a flag — a dialog's `saving`, a page hook's `loading` —
 * and only want it to survive a fast answer. `active` going true starts the clock; `active`
 * going false ends it, or the remainder of {@link MIN_BUSY_MS} does, whichever is later.
 *
 * It can only sustain a transition it is rendered for. If a caller raises and lowers its
 * flag inside a single React batch — which is what an already-resolved promise does — there
 * is no commit with `active` true and there is nothing here to hold. Buttons that own their
 * request should use {@link useBusyAction}, which raises the flag itself and cannot miss it.
 */
export function useBusy(active: boolean, minimumMs: number = MIN_BUSY_MS): boolean {
  const [held, setHeld] = useState(active);
  // Bumped whenever `active` is raised. A counter and not a timestamp: the raise is noticed
  // during render, and reading the clock during render is not something a component may do.
  const [raise, setRaise] = useState(0);
  const [tracked, setTracked] = useState(active);
  const startedAt = useRef(0);

  // The documented "adjust state when a prop changes" pattern, the same one `usePagination`
  // uses: React re-renders before committing rather than painting the stale value first, so
  // the flag is never a frame behind the request it describes.
  if (tracked !== active) {
    setTracked(active);
    if (active) {
      setHeld(true);
      setRaise((n) => n + 1);
    }
  }

  // Declared first so the clock is set before the release below reads it on the same commit.
  useEffect(() => {
    startedAt.current = Date.now();
  }, [raise]);

  useEffect(() => {
    if (active || !held) return;
    // `Math.max(0, …)` rather than releasing early and synchronously: a request that already
    // outran the minimum still lets go through the timer, one macrotask later, which keeps
    // this effect free of the setState-in-effect that cascades a render.
    const remaining = Math.max(0, minimumMs - (Date.now() - startedAt.current));
    const timer = setTimeout(() => setHeld(false), remaining);
    return () => clearTimeout(timer);
  }, [active, held, minimumMs]);

  // `active` is or-ed in for the first render of a raise, before `held` has caught up.
  return held || active;
}

/**
 * Wrap an async click handler in a busy flag that is guaranteed to be seen.
 *
 * Returns the handler to hand to `onClick` and the flag to render from. The flag is raised
 * synchronously inside the handler and lowered from a timer, so — unlike {@link useBusy} —
 * there is always a commit with it raised, however fast the work underneath finishes.
 *
 * `run` hands the promise back and re-throws rather than swallowing, so a handler wired up
 * here fails exactly as loudly as the `void action()` it replaced — call sites keep the
 * `onClick={() => void run()}` spelling they already use. Every action passed in today
 * reports its own failures; this only makes sure a new one that forgets cannot fail
 * silently because it was routed through here.
 */
export function useBusyAction<A extends unknown[]>(
  action: (...args: A) => unknown,
  minimumMs: number = MIN_BUSY_MS,
): { run: (...args: A) => Promise<void>; busy: boolean } {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  // Held in a ref because the action closes over the caller's state and is a new function
  // every render, and depending on it would hand back a new `run` every render for no gain.
  const latest = useRef(action);

  useEffect(() => {
    latest.current = action;
  }, [action]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      setBusy(true);
      const startedAt = Date.now();

      const settle = () => {
        const remaining = minimumMs - (Date.now() - startedAt);
        if (remaining <= 0) {
          if (live.current) setBusy(false);
          return;
        }
        timer.current = setTimeout(() => {
          if (live.current) setBusy(false);
        }, remaining);
      };

      // The action runs in a microtask rather than inline so that a synchronous throw is a
      // rejection like any other and cannot leave the flag stuck on.
      return Promise.resolve()
        .then(() => latest.current(...args))
        .then(settle, (error: unknown) => {
          settle();
          throw error;
        });
    },
    [minimumMs],
  );

  return { run, busy };
}
