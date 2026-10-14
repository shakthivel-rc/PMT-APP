import { describe, it, expect } from 'vitest';
import { Users } from 'lucide-react';
import { render, screen } from '@/test/renderWithProviders';
import StatCard from '@/components/StatCard';

describe('<StatCard>', () => {
  it('renders the label, value and hint', () => {
    render(<StatCard label="Total users" value={42} icon={Users} hint="+3 this week" />);
    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('+3 this week')).toBeInTheDocument();
  });

  it('accepts a string value and renders without a hint', () => {
    render(<StatCard label="Status" value="Healthy" icon={Users} tone="success" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
