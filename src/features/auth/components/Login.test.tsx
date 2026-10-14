import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { getAccessToken } from '@/api/client';
import Login from '@/features/auth/components/Login';

const renderLogin = (props: Partial<React.ComponentProps<typeof Login>> = {}) =>
  renderWithProviders(<Login onForgotPassword={vi.fn()} onRegister={vi.fn()} {...props} />);

describe('<Login>', () => {
  it('wires the forgot-password and register links to their callbacks', async () => {
    const user = userEvent.setup();
    const onForgotPassword = vi.fn();
    const onRegister = vi.fn();
    renderLogin({ onForgotPassword, onRegister });

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(onForgotPassword).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(onRegister).toHaveBeenCalled();
  });

  it('logs in successfully and stores tokens (remember-me persists the email)', async () => {
    const user = userEvent.setup();
    const { store } = renderLogin();

    await user.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef123!@#');
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(store.getState().auth.user).toBeTruthy());
    expect(getAccessToken()).toBe('test-access-token');
    expect(localStorage.getItem('remembered_email')).toBe('ada@example.com');
  });

  it('shows an error banner when the credentials are rejected', async () => {
    server.use(
      http.post('*/user/login', () =>
        HttpResponse.json(
          { status: 'error', status_code: 400, message: 'Invalid email or password', data: null },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email address'), 'nope@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password');
  });
});
