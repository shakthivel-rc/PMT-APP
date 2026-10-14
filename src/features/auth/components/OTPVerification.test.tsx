import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import OTPVerification from '@/features/auth/components/OTPVerification';

const renderOtp = (props: Partial<React.ComponentProps<typeof OTPVerification>> = {}) =>
  renderWithProviders(
    <OTPVerification email="ada@example.com" onVerified={vi.fn()} onLogin={vi.fn()} {...props} />
  );

const inputs = () => screen.getAllByRole('textbox') as HTMLInputElement[];

describe('<OTPVerification>', () => {
  it('masks the email and disables verify until all six digits are entered', () => {
    renderOtp();
    expect(screen.getByText(/ad\*\*\*@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
    expect(inputs()).toHaveLength(6);
  });

  it('auto-advances focus on entry and steps back on Backspace', async () => {
    const user = userEvent.setup();
    renderOtp();
    const boxes = inputs();

    await user.type(boxes[0], '1');
    expect(boxes[1]).toHaveFocus();

    // Backspace on an empty box moves focus to the previous box
    await user.type(boxes[1], '{Backspace}');
    expect(boxes[0]).toHaveFocus();
  });

  it('fills all boxes from a paste and verifies, invoking onVerified with the code', async () => {
    const user = userEvent.setup();
    const onVerified = vi.fn();
    renderOtp({ onVerified });
    const boxes = inputs();

    boxes[0].focus();
    await user.paste('123456');
    expect(boxes.map((b) => b.value).join('')).toBe('123456');

    await user.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('ada@example.com', '123456'));
  });
});
