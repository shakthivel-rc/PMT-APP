import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeStore } from '@/test/renderWithProviders';
import authReducer, { acceptInvite, clearAuthMessages, confirmPasswordReset } from './authSlice';

const initial = () => authReducer(undefined, { type: '@@init' });

describe('emailed-link results that land after the person left the screen', () => {
  // `auth.error` is shared by every auth screen, and "Back to sign in" stays enabled while a
  // submission is in flight. A refusal that arrived after `clearAuthMessages` (which runs on
  // every auth-route change) used to be written anyway, and sign-in then showed "The
  // verification token is expired" to someone who had only gone back to sign in.
  it.each([
    ['acceptInvite', acceptInvite, 'acceptInviteStatus'],
    ['confirmPasswordReset', confirmPasswordReset, 'resetPasswordStatus'],
  ] as const)('%s: a late refusal is dropped', (_name, thunk, status) => {
    const arg = { password: 'x', token: 't' };
    let state = authReducer(initial(), thunk.pending('req', arg));
    expect(state[status]).toBe('loading');

    state = authReducer(state, clearAuthMessages());
    state = authReducer(state, thunk.rejected(null, 'req', arg, 'The verification token is expired'));

    expect(state[status]).toBe('idle');
    expect(state.error).toBeNull();
  });

  it.each([
    ['acceptInvite', acceptInvite, 'acceptInviteStatus'],
    ['confirmPasswordReset', confirmPasswordReset, 'resetPasswordStatus'],
  ] as const)('%s: an on-screen refusal is kept', (_name, thunk, status) => {
    const arg = { password: 'x', token: 't' };
    let state = authReducer(initial(), thunk.pending('req', arg));
    state = authReducer(state, thunk.rejected(null, 'req', arg, 'The verification token is expired'));

    expect(state[status]).toBe('failed');
    expect(state.error).toBe('The verification token is expired');
  });
});

describe('what an emailed-link refusal tells the person', () => {
  const arg = { password: 'Sup3r!Secret!Pass', token: 't' };
  const refuse = (status: number, message: string, data: unknown = null) => () =>
    HttpResponse.json({ status: 'error', status_code: status, message, data }, { status });

  it('says a spent reset link is spent, with the next step', async () => {
    server.use(http.post('*/user/reset-password', refuse(404, "User doesn't exists with this token")));
    const store = makeStore();
    await store.dispatch(confirmPasswordReset(arg));
    expect(store.getState().auth.error).toMatch(/reset link has already been used.*Request a new one/);
  });

  it('falls back to the message when the refusal carries no reasons', async () => {
    server.use(
      http.post('*/user/set-password', refuse(400, 'Passwords don\'t match', { errors: [] }))
    );
    const store = makeStore();
    await store.dispatch(acceptInvite(arg));
    expect(store.getState().auth.error).toBe("Passwords don't match");
  });

  it('keeps a failure with no response readable, rather than RTK\'s "Rejected"', async () => {
    server.use(http.post('*/user/set-password', () => HttpResponse.error()));
    const store = makeStore();
    await store.dispatch(acceptInvite(arg));
    const { error } = store.getState().auth;
    expect(error).toBeTruthy();
    expect(error).not.toBe('Rejected');
  });

  it('confirms success in its own words when the API sends none', async () => {
    server.use(
      http.post('*/user/set-password', () =>
        HttpResponse.json({ status: 'success', status_code: 201, message: '', data: {} })
      )
    );
    const store = makeStore();
    await store.dispatch(acceptInvite(arg));
    expect(store.getState().auth.authMessage).toBe('Your account is ready.');
  });
});
