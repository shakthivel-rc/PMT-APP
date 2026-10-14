import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/renderWithProviders';
import FormMessage from '@/components/FormMessage';

describe('<FormMessage>', () => {
  it('announces errors assertively as an alert (default variant)', () => {
    render(<FormMessage>Invalid credentials</FormMessage>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Invalid credentials');
    expect(el).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces non-error variants politely as status', () => {
    render(<FormMessage variant="success">Saved</FormMessage>);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Saved');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });
});
