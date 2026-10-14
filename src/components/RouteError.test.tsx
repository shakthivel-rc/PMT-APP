import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, userEvent } from '@/test/renderWithProviders';
import RouteError from '@/components/RouteError';

// A child whose throwing behaviour we can flip, to exercise error → recover.
let shouldThrow = true;
const Bomb = () => {
  if (shouldThrow) throw new Error('kaboom');
  return <div>recovered content</div>;
};

afterEach(() => {
  shouldThrow = true;
  vi.restoreAllMocks();
});

describe('<RouteError>', () => {
  it('catches a render error and shows a recoverable message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // silence React boundary noise
    render(
      <RouteError>
        <Bomb />
      </RouteError>
    );
    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('re-renders children after "Try again" once the error clears', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <RouteError>
        <Bomb />
      </RouteError>
    );

    shouldThrow = false; // the underlying cause is resolved
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });

  it('clears the error when the route changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Navigating away from a broken route must not leave its error sitting over the route
    // the user actually asked for.
    const { rerender } = render(
      <RouteError resetKey="/broken">
        <Bomb />
      </RouteError>
    );
    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <RouteError resetKey="/other">
        <Bomb />
      </RouteError>
    );

    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });
});

describe('<RouteError> on a chunk-load failure', () => {
  // A lazy chunk that 404s after a deploy can never resolve for this document, and React
  // caches the rejection forever -- so "Try again" re-renders the same rejected element and
  // silently cannot work. This is the case that had no coverage at all.
  const ChunkBomb = () => {
    throw new Error('Failed to fetch dynamically imported module: /assets/UserProfile-abc123.js');
  };

  it('offers a reload rather than a retry that cannot succeed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteError>
        <ChunkBomb />
      </RouteError>
    );

    expect(screen.getByText('This page has been updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('reloads the document when that button is pressed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    const user = userEvent.setup();

    render(
      <RouteError>
        <ChunkBomb />
      </RouteError>
    );
    await user.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
