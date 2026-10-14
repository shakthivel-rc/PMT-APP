import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { fetchTimer } from '@/features/time/timerSlice';

/*
 * The running timer, in the header, on every screen.
 *
 * **What is eager is only what must be.** The header is not lazy, so anything imported here
 * lands in the initial chunk, which had about 4 kB of headroom when this was written
 * (bundle-budget.json). Eager: asking the API whether a timer runs, and the slice the drawer
 * shares. Lazy: everything drawn once one does — the button, its menu, four icons and the
 * one-second clock — in RunningTimerMenu.tsx. Most visits have no timer running and never
 * download it. Measured 2026-10-05: with the menu eager the initial chunk grew 2.2 kB.
 *
 * Plain `lazy` rather than `lazyWithRetry`: that helper reloads the page when a chunk has gone
 * after a deploy, which is right for a screen someone navigated to and wrong for a widget in
 * the corner. Here a failed load is caught by the boundary below and the header simply shows
 * no timer until the next visit.
 *
 * It renders nothing if it ever throws: the header has no error boundary above it, and a
 * broken timer must not take the whole shell down with it.
 */

const RunningTimerMenu = lazy(() => import('./RunningTimerMenu'));

const RunningTimer = () => {
  const dispatch = useAppDispatch();
  const running = useAppSelector((s) => s.timer.timer !== null);

  useEffect(() => {
    void dispatch(fetchTimer());
    // Another tab, or another device, may have started or stopped it while this one slept.
    const refresh = () => {
      if (document.visibilityState === 'visible') void dispatch(fetchTimer());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [dispatch]);

  return running ? (
    <Suspense fallback={null}>
      <RunningTimerMenu />
    </Suspense>
  ) : null;
};

/** Renders nothing in place of a timer that threw, rather than a broken header. */
class Quietly extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const TimerIndicator = () => (
  <Quietly>
    <RunningTimer />
  </Quietly>
);

export default TimerIndicator;
