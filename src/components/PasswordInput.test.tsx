import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '@/test/renderWithProviders';
import PasswordInput from '@/components/PasswordInput';

describe('<PasswordInput>', () => {
  it('masks input by default and exposes a show-password toggle', () => {
    const { container } = render(<PasswordInput defaultValue="secret" />);
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('reveals and re-hides the value when the toggle is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput defaultValue="secret" />);
    const input = container.querySelector('input')!;

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
