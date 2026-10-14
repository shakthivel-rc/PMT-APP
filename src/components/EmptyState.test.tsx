import { describe, it, expect } from 'vitest';
import { Inbox } from 'lucide-react';
import { render, screen } from '@/test/renderWithProviders';
import EmptyState from '@/components/EmptyState';

describe('<EmptyState>', () => {
  it('renders title, description and an optional action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here yet"
        description="Add your first item to get started."
        action={<button type="button">New item</button>}
      />
    );
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.getByText('Add your first item to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New item' })).toBeInTheDocument();
  });

  it('renders without a description or action', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole('heading', { name: 'Empty' })).toBeInTheDocument();
  });
});
