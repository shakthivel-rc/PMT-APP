import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/renderWithProviders';
import PageLoader from '@/components/PageLoader';

describe('<PageLoader>', () => {
  it('exposes an accessible loading status', () => {
    render(<PageLoader />);
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Loading');
  });
});
