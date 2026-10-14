/**
 * The busy button.
 *
 * The defect these tests exist for: against a local API almost every request answers inside
 * a frame, so a spinner driven by "request in flight" is mounted and unmounted without ever
 * being drawn, and a press looks like nothing happened. What is asserted below is that the
 * acknowledgement survives an instant answer — and that it never outstays a slow one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Trash2 } from 'lucide-react';

import ActionButton from '@/components/ActionButton';
import { MIN_BUSY_MS } from '@/lib/useBusy';
import { act, render, screen, renderWithProviders } from '@/test/renderWithProviders';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const press = async (name: RegExp | string) => {
  await act(async () => {
    screen.getByRole('button', { name }).click();
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('<ActionButton>', () => {
  it('runs the action it was given', async () => {
    const action = vi.fn();
    renderWithProviders(<ActionButton onAction={action}>Do it</ActionButton>);

    await press('Do it');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('stays busy long enough to be seen when the action answers instantly', async () => {
    renderWithProviders(
      <ActionButton onAction={() => Promise.resolve()} icon={Trash2}>
        Delete
      </ActionButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });

    await press('Delete');
    expect(button).toHaveAttribute('aria-busy', 'true');

    await advance(MIN_BUSY_MS - 1);
    expect(button).toHaveAttribute('aria-busy', 'true');

    await advance(1);
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('cannot be pressed twice into the same work', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ActionButton onAction={action}>Do it</ActionButton>);

    await press('Do it');
    expect(screen.getByRole('button', { name: 'Do it' })).toBeDisabled();

    await press('Do it');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('swaps the icon for a spinner rather than showing two glyphs', async () => {
    const { container } = renderWithProviders(
      <ActionButton onAction={() => Promise.resolve()} icon={Trash2}>
        Delete
      </ActionButton>,
    );

    expect(container.querySelectorAll('svg')).toHaveLength(1);
    await press('Delete');
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('spins the icon in place when it is already a rotation glyph', async () => {
    const { container } = renderWithProviders(
      <ActionButton onAction={() => Promise.resolve()} icon={Trash2} spinIcon>
        Sync
      </ActionButton>,
    );

    await press('Sync');
    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('animate-spin');
    // Still the caller's icon, not a substituted spinner.
    expect(icon).toHaveClass('lucide-trash-2');
  });

  it('keeps the label steady unless a busy label was asked for', async () => {
    renderWithProviders(
      <ActionButton onAction={() => Promise.resolve()} busyLabel="Deleting…">
        Delete
      </ActionButton>,
    );

    await press('Delete');
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeInTheDocument();

    await advance(MIN_BUSY_MS);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows a busy state the caller raised elsewhere, not only its own press', async () => {
    const { rerender } = renderWithProviders(
      <ActionButton onAction={vi.fn()} busy>
        Save
      </ActionButton>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');

    rerender(
      <ActionButton onAction={vi.fn()} busy={false}>
        Save
      </ActionButton>,
    );
    await advance(MIN_BUSY_MS);
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy');
  });

  it('takes the press that follows a fast reload, while still showing its tail', async () => {
    // The hold is feedback, not a lock. A page hook that raises `loading` for 20 ms leaves
    // this button spinning for the rest of the 600 ms, and a press landing in that window
    // must still be taken — an earlier cut disabled the button for the whole tail, so a
    // second press right after a fast reload was silently refused.
    const action = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderWithProviders(
      <ActionButton onAction={action} busy>
        Reload
      </ActionButton>,
    );

    rerender(
      <ActionButton onAction={action} busy={false}>
        Reload
      </ActionButton>,
    );

    const button = screen.getByRole('button', { name: 'Reload' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeEnabled();

    await press('Reload');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('stays disabled while the caller says the work is genuinely still running', async () => {
    const action = vi.fn();
    render(
      <ActionButton onAction={action} busy>
        Save
      </ActionButton>,
    );

    await press('Save');
    expect(action).not.toHaveBeenCalled();
  });

  it('stays disabled when the caller disabled it, without ever running', async () => {
    const action = vi.fn();
    render(
      <ActionButton onAction={action} disabled>
        Do it
      </ActionButton>,
    );

    await press('Do it');
    expect(action).not.toHaveBeenCalled();
  });

  it('lets go of a failed action, and records it rather than dropping it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const action = vi.fn().mockRejectedValue(new Error('refused'));
    renderWithProviders(<ActionButton onAction={action}>Do it</ActionButton>);

    await press('Do it');
    await advance(MIN_BUSY_MS);

    expect(screen.getByRole('button', { name: 'Do it' })).toBeEnabled();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('[action]'), expect.any(Error));
    logged.mockRestore();
  });
});
