import { describe, it, expect } from 'vitest';
import { Shield } from 'lucide-react';
import { render, screen } from '@/test/renderWithProviders';
import PageHeader from '@/components/PageHeader';

describe('<PageHeader>', () => {
  it('renders the title as a heading, plus description and actions', () => {
    render(
      <PageHeader
        icon={Shield}
        title="Roles & Permissions"
        description="Manage access"
        actions={<button type="button">New role</button>}
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Roles & Permissions' })).toBeInTheDocument();
    expect(screen.getByText('Manage access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New role' })).toBeInTheDocument();
  });

  it('renders with only a title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
