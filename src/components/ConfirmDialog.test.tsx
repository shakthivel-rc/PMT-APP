import { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import ConfirmDialog from '@/components/ConfirmDialog';

describe('<ConfirmDialog>', () => {
  it('renders title, description and the confirm/cancel actions when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete user?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Delete user?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('invokes onConfirm and onOpenChange(false) for the two buttons', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog open onOpenChange={onOpenChange} title="Confirm?" confirmLabel="Yes" onConfirm={onConfirm} />
    );

    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both buttons while loading', () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} title="Working" loading onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('lets the caller decide where focus lands once it has closed', async () => {
    const Harness = () => {
      const [open, setOpen] = useState(true);
      const elsewhere = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={elsewhere} type="button">
            Elsewhere
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Remove?"
            onConfirm={vi.fn()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              elsewhere.current?.focus();
            }}
          />
        </>
      );
    };
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus());
  });
});
