import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/renderWithProviders';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

describe('<PasswordStrengthMeter>', () => {
  it('shows 0% and no label for an empty password, and lists all seven rules', () => {
    render(<PasswordStrengthMeter password="" />);
    const bar = screen.getByRole('progressbar', { name: 'Password strength' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    // no strength label rendered while empty
    expect(screen.queryByText('Strong')).not.toBeInTheDocument();
  });

  it('reports full strength for a compliant password', () => {
    render(<PasswordStrengthMeter password="Abcdef123!@#" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('reports a partial score for a weak password', () => {
    render(<PasswordStrengthMeter password="abcABC" />); // 4/7 → Fair, 57%
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '57');
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });
});
