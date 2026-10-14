import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import AcceptInvite from '@/features/auth/components/AcceptInvite';

const STRONG = 'Sup3r!Secret!Pass';

const fillAndSubmit = async (password = STRONG) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm password'), password);
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
};

describe('<AcceptInvite>', () => {
  it('sends the token from the link back in the body, unchanged, and confirms activation', async () => {
    // Base64 padding and the characters a URL treats specially: the token has to reach the
    // API byte-identical or it will not decrypt.
    const token = 'gAAAAB+abc/def==';
    let sent: { query: string; body: unknown } | null = null;
    server.use(
      http.post('*/user/set-password', async ({ request }) => {
        sent = { query: new URL(request.url).search, body: await request.json() };
        return HttpResponse.json({
          status: 'success',
          status_code: 201,
          message: 'Password set successfully',
          data: {},
        });
      })
    );
    const onLogin = vi.fn();
    renderWithProviders(<AcceptInvite token={token} onLogin={onLogin} />);

    await fillAndSubmit();

    expect(await screen.findByText('Account activated')).toBeInTheDocument();
    // Nothing in the URL: a token there is a token in every access log (the API's SEC-4).
    expect(sent).toEqual({
      query: '',
      body: { token, new_password: STRONG, confirm_password: STRONG },
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onLogin).toHaveBeenCalled();
  });

  it("shows the API's reason when the invite is refused, not a generic retry", async () => {
    server.use(
      http.post('*/user/set-password', () =>
        HttpResponse.json(
          { status: 'error', status_code: 400, message: 'The verification token is expired', data: {} },
          { status: 400 }
        )
      )
    );
    renderWithProviders(<AcceptInvite token="expired" onLogin={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('The verification token is expired');
    expect(screen.queryByText('Account activated')).not.toBeInTheDocument();
  });

  it("shows the policy's reasons, not just its heading, when the API refuses the password", async () => {
    server.use(
      http.post('*/user/set-password', () =>
        HttpResponse.json(
          {
            status: 'error',
            status_code: 400,
            message: 'Password does not meet policy requirements',
            data: { errors: ['Password must include at least one special character.'] },
          },
          { status: 400 }
        )
      )
    );
    renderWithProviders(<AcceptInvite token="t" onLogin={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must include at least one special character.'
    );
  });

  it('says a spent link is spent, rather than relaying "User doesn\'t exists"', async () => {
    // The API clears the token on success, so reopening the link (Back, or the email again)
    // gets a 404 whose own text suggests the account is gone.
    server.use(
      http.post('*/user/set-password', () =>
        HttpResponse.json(
          { status: 'error', status_code: 400, message: "User doesn't exists with this token", data: null },
          { status: 404 }
        )
      )
    );
    renderWithProviders(<AcceptInvite token="used" onLogin={vi.fn()} />);

    await fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already been used or is no longer valid/);
    expect(alert).not.toHaveTextContent("doesn't exists");
  });

  it('refuses a weak password locally, without a round trip', async () => {
    let called = false;
    server.use(
      http.post('*/user/set-password', () => {
        called = true;
        return HttpResponse.json({ status: 'success', status_code: 201, message: 'ok', data: {} });
      })
    );
    renderWithProviders(<AcceptInvite token="t" onLogin={vi.fn()} />);

    await fillAndSubmit('weak');

    expect(await screen.findByRole('alert')).toHaveTextContent(/strength requirements/);
    await waitFor(() => expect(called).toBe(false));
  });

  it('explains an incomplete link instead of asking for a password it cannot use', () => {
    renderWithProviders(<AcceptInvite token={null} onLogin={vi.fn()} />);

    expect(screen.getByText('This invitation link is incomplete')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
