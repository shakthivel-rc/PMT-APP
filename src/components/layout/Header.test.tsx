import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({ focusMode: false, chatDrawerOpen: false }),
}));

vi.mock('@/components/TimerIndicator', () => ({
  default: () => <div data-testid="timer-indicator" />,
}));

vi.mock('@/components/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center" />,
}));

describe('Header', () => {
  it('renders title, new issue button, and action controls', () => {
    render(
      <Header
        title="Active Sprint"
        user={{
          id: 'u-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          role: 'admin',
          username: 'johndoe',
          status: 'active',
          roles: [],
        } as any}
        onOpenSidebar={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Active Sprint')).toBeInTheDocument();
    expect(screen.getByText('New Issue')).toBeInTheDocument();
    expect(screen.getByText('Search...')).toBeInTheDocument();
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();
    expect(screen.getByTestId('timer-indicator')).toBeInTheDocument();
  });
});
