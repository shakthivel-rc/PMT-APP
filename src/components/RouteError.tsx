import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { isChunkLoadError } from '@/lib/lazyWithRetry';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';

interface Props {
  children: ReactNode;
  /**
   * Changing this remounts the subtree. Clearing boundary state alone re-renders the *same*
   * element, which for a rejected `React.lazy` re-throws immediately — a "Try again" that
   * silently cannot work. `AppShell` passes the router location, since a class component
   * cannot call hooks.
   */
  resetKey?: string;
}
interface State {
  err?: unknown;
  /** Bumped by `reset` so `key` changes and children are rebuilt rather than re-rendered. */
  attempt: number;
}

/**
 * Route-level error boundary — catches render/data errors (including a rejected
 * `use()` promise) so a failed screen shows a recoverable message instead of a
 * blank crash. This is the app's global-exception safety net.
 */
class RouteError extends Component<Props, State> {
  state: State = { attempt: 0 };

  static getDerivedStateFromError(err: unknown) {
    return { err };
  }

  componentDidUpdate(prev: Props) {
    // A navigation is itself a reset: leaving a broken route must not leave the error on
    // screen over the route the user actually asked for.
    if (this.state.err && prev.resetKey !== this.props.resetKey) {
      this.setState((s) => ({ err: undefined, attempt: s.attempt + 1 }));
    }
  }

  reset = () => this.setState((s) => ({ err: undefined, attempt: s.attempt + 1 }));

  reload = () => window.location.reload();

  render() {
    if (this.state.err) {
      const message =
        (this.state.err as { message?: string })?.message ?? 'Something went wrong loading this page.';
      // A chunk that 404s after a deploy will never resolve for this document, because the
      // index.html in memory points at hashes the server no longer has. Retrying is not the
      // recovery; reloading is. Offering the wrong one is what left users stuck.
      const chunkFailure = isChunkLoadError(this.state.err);
      return (
        <div className="mx-auto w-full max-w-2xl p-6">
          <EmptyState
            icon={TriangleAlert}
            title={chunkFailure ? 'This page has been updated' : "Couldn't load this page"}
            description={
              chunkFailure
                ? 'A newer version of the app is available, so this screen could not be loaded. Reload to pick it up.'
                : String(message)
            }
            action={
              chunkFailure ? (
                <Button onClick={this.reload}>Reload page</Button>
              ) : (
                <Button onClick={this.reset}>Try again</Button>
              )
            }
          />
        </div>
      );
    }
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}

export default RouteError;
