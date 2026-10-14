import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import ResetPassword from '@/features/auth/components/ResetPassword';

const STRONG = 'Sup3r!Secret!Pass';

const fillAndSubmit = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), STRONG);
  await user.type(screen.getByLabelText('Confirm password'), STRONG);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
};

describe('<ResetPassword>', () => {
  it('sends the token from the link back in the body, unchanged, and confirms the reset', async () => {
    const token = 'gAAAAB+abc/def==';
    let sent: { query: string; body: unknown } | null = null;
    server.use(
      http.post('*/user/reset-password', async ({ request }) => {
        sent = { query: new URL(request.url).search, body: await request.json() };
        return HttpResponse.json({
          status: 'success',
          status_code: 201,
          message: 'Password set successfully',
          data: {},
        });
      })
    );
    renderWithProviders(<ResetPassword token={token} onLogin={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByText('Password reset')).toBeInTheDocument();
    expect(sent).toEqual({
      query: '',
      body: { token, new_password: STRONG, confirm_password: STRONG },
    });
  });

  it("shows the API's reason when the link is refused, not a generic retry", async () => {
    // "Please try again" is the wrong advice for an expired link: no retry can succeed, and
    // the person needs to know to request a new email instead.
    server.use(
      http.post('*/user/reset-password', () =>
        HttpResponse.json(
          { status: 'error', status_code: 400, message: 'The verification token is expired', data: {} },
          { status: 400 }
        )
      )
    );
    renderWithProviders(<ResetPassword token="expired" onLogin={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('The verification token is expired');
  });

  it('explains an incomplete link instead of asking for a password it cannot use', () => {
    renderWithProviders(<ResetPassword token={null} onLogin={vi.fn()} />);

    expect(screen.getByText('This reset link is incomplete')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
