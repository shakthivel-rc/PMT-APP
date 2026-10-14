import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/renderWithProviders';
import StatusBadge, { activityTone } from '@/components/StatusBadge';

describe('activityTone', () => {
  it('activityTone maps each activity type (with neutral default)', () => {
    expect(activityTone('create')).toBe('success');
    expect(activityTone('update')).toBe('info');
    expect(activityTone('delete')).toBe('danger');
    expect(activityTone('login')).toBe('primary');
    expect(activityTone('security')).toBe('warning');
    expect(activityTone('logout')).toBe('neutral');
    expect(activityTone('whatever')).toBe('neutral');
  });
});

describe('<StatusBadge>', () => {
  it('renders children and applies the tone class', () => {
    render(<StatusBadge tone="success">Active</StatusBadge>);
    const badge = screen.getByText('Active');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-success');
  });
});
