import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { loggedInState, makeUser } from '@/test/fixtures';
import type { MemberSummary } from '@/types';
import MembersDialog from './MembersDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const refuse = (status: number, message: string, data: unknown = null) =>
  HttpResponse.json({ status: 'error', status_code: status, message, data }, { status });

const owner: MemberSummary = {
  user_id: 'u1',
  email: 'owner@x.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  role: 'owner',
};

const render = (role: MemberSummary['role']) =>
  renderWithProviders(<MembersDialog workspaceId="w1" workspaceName="Acme" role={role} onClose={vi.fn()} />);

describe('MembersDialog', () => {
  it('lists members and adds one by email', async () => {
    let body: unknown;
    server.use(
      http.get('*/workspaces/w1/members', () => ok([owner])),
      http.post('*/workspaces/w1/members', async ({ request }) => {
        body = await request.json();
        return ok({ user_id: 'u2', email: 'dev@x.com', first_name: 'Dev', last_name: 'One', role: 'member' }, 201);
      }),
    );
    render('owner');

    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).getByText('Ada Lovelace')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'dev@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await within(list).findByText('Dev One')).toBeInTheDocument();
    expect(body).toEqual({ email: 'dev@x.com', role: 'member' });
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('shows the API refusal for an unknown address', async () => {
    server.use(
      http.get('*/workspaces/w1/members', () => ok([owner])),
      http.post('*/workspaces/w1/members', () =>
        HttpResponse.json(
          { status: 'error', status_code: 404, message: 'No active account uses that address. Invite them first.' },
          { status: 404 },
        ),
      ),
    );
    render('admin');
    await screen.findByRole('list', { name: 'Members' });
    await userEvent.type(screen.getByLabelText('Email'), 'ghost@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText(/No active account uses that address/)).toBeInTheDocument();
  });

  it('is read-only for a member', async () => {
    server.use(http.get('*/workspaces/w1/members', () => ok([owner])));
    render('member');
    await screen.findByRole('list', { name: 'Members' });
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  });
});

/**
 * Changing roles, removing and leaving. Pinned: which rows offer what to whom (the rules in
 * `lib/workspaceRules.ts`), the confirm step before anything is removed, the API's 403 and 409
 * shown in the dialog as worded, and where focus goes once a confirm closes.
 */
describe('MembersDialog changing members', () => {
  const admin: MemberSummary = {
    user_id: 'u2',
    email: 'grace@x.com',
    first_name: 'Grace',
    last_name: 'Hopper',
    role: 'admin',
  };
  const member: MemberSummary = {
    user_id: 'u3',
    email: 'alan@x.com',
    first_name: 'Alan',
    last_name: 'Turing',
    role: 'member',
  };

  /** Signed in as `me`, whose role is whatever `rows` gives them. */
  function open(me: string, rows: MemberSummary[], onClose = vi.fn()) {
    server.use(http.get('*/workspaces/w1/members', () => ok(rows)));
    const role = rows.find((m) => m.user_id === me)?.role ?? 'guest';
    renderWithProviders(
      <Routes>
        <Route path="/projects" element={<p>Back on the list</p>} />
        <Route
          path="/projects/:workspaceId"
          element={<MembersDialog workspaceId="w1" workspaceName="Acme" role={role} onClose={onClose} />}
        />
      </Routes>,
      { route: '/projects/w1', preloadedState: loggedInState(makeUser({ id: me })) },
    );
    return onClose;
  }

  const row = async (name: string) =>
    within(await screen.findByRole('list', { name: 'Members' }))
      .getByText(name)
      .closest('li') as HTMLElement;

  const optionsOf = async (select: HTMLElement) => {
    await userEvent.click(select);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    await userEvent.keyboard('{Escape}');
    return options;
  };

  it('gives an owner a role select on every row, Owner among its roles, and Remove for everyone else', async () => {
    open('u1', [owner, admin, member]);

    const own = await row('Ada Lovelace');
    expect(within(own).getByRole('combobox', { name: 'Role of Ada Lovelace' })).toHaveTextContent('Owner');
    expect(within(own).getByRole('button', { name: 'Leave workspace' })).toBeInTheDocument();
    expect(within(own).queryByRole('button', { name: /^Remove/ })).toBeNull();

    const other = await row('Grace Hopper');
    expect(within(other).getByRole('button', { name: 'Remove Grace Hopper' })).toBeInTheDocument();
    expect(within(other).queryByRole('button', { name: 'Leave workspace' })).toBeNull();
    expect(await optionsOf(within(other).getByRole('combobox', { name: 'Role of Grace Hopper' }))).toEqual([
      'Guest',
      'Member',
      'Admin',
      'Owner',
    ]);
  });

  it('leaves an owner’s row alone for an admin, and offers an admin no Owner to give', async () => {
    open('u2', [owner, admin, member]);

    const ownerRow = await row('Ada Lovelace');
    expect(within(ownerRow).queryByRole('combobox')).toBeNull();
    expect(within(ownerRow).queryByRole('button')).toBeNull();
    expect(within(ownerRow).getByText('Owner')).toBeInTheDocument();

    const memberRow = await row('Alan Turing');
    expect(within(memberRow).getByRole('button', { name: 'Remove Alan Turing' })).toBeInTheDocument();
    expect(await optionsOf(within(memberRow).getByRole('combobox', { name: 'Role of Alan Turing' }))).toEqual([
      'Guest',
      'Member',
      'Admin',
    ]);
    // The add form follows the same rule.
    expect(await optionsOf(screen.getByRole('combobox', { name: 'Role' }))).toEqual(['Guest', 'Member', 'Admin']);
  });

  it.each(['member', 'guest'] as const)('is read-only for a %s, apart from leaving', async (role) => {
    open('u3', [owner, { ...member, role }]);

    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).queryByRole('combobox')).toBeNull();
    expect(within(list).queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(within(await row('Alan Turing')).getByRole('button', { name: 'Leave workspace' })).toBeInTheDocument();
    expect(within(await row('Ada Lovelace')).queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('changes a role, shows it at once, and keeps it once the API agrees', async () => {
    let body: unknown;
    server.use(
      http.patch('*/workspaces/w1/members/u3', async ({ request }) => {
        body = await request.json();
        return ok({ ...member, role: 'admin' });
      }),
    );
    open('u1', [owner, admin, member]);

    const select = within(await row('Alan Turing')).getByRole('combobox', { name: 'Role of Alan Turing' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Admin' }));

    // Someone else's role changes without a confirm: it is undone the same way.
    expect(select).toHaveTextContent('Admin');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alan Turing is now Admin.'));
    expect(body).toEqual({ role: 'admin' });
    expect(select).toHaveTextContent('Admin');
  });

  it('puts the role back, and shows the API’s reason in the dialog, when a change is refused', async () => {
    const reason = 'Only an owner can change an owner’s role.';
    server.use(http.patch('*/workspaces/w1/members/u3', () => refuse(403, reason)));
    open('u1', [owner, admin, member]);

    const select = within(await row('Alan Turing')).getByRole('combobox', { name: 'Role of Alan Turing' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Guest' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(select).toHaveTextContent('Member');
  });

  it('asks before you lower your own role, and shows why the last owner cannot', async () => {
    const reason = 'A workspace needs at least one owner. Make someone else an owner first.';
    let patches = 0;
    server.use(
      http.patch('*/workspaces/w1/members/u1', () => {
        patches += 1;
        return refuse(409, reason);
      }),
    );
    open('u1', [owner, admin]);

    const select = within(await row('Ada Lovelace')).getByRole('combobox', { name: 'Role of Ada Lovelace' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Admin' }));

    let confirm = screen.getByRole('dialog', { name: 'Change your own role to Admin?' });
    expect(confirm).toHaveTextContent('You cannot undo this yourself: another owner would have to.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(patches).toBe(0);
    expect(select).toHaveTextContent('Owner');
    await waitFor(() => expect(select).toHaveFocus());

    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    confirm = screen.getByRole('dialog', { name: 'Change your own role to Admin?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Change my role' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(patches).toBe(1);
    expect(select).toHaveTextContent('Owner');
    await waitFor(() => expect(select).toHaveFocus());
  });

  it('removes a member only after a confirm, and then puts focus on the list', async () => {
    let removed = 0;
    server.use(
      http.delete('*/workspaces/w1/members/u3', () => {
        removed += 1;
        return ok({ user_id: 'u3' });
      }),
    );
    open('u1', [owner, admin, member]);

    const remove = within(await row('Alan Turing')).getByRole('button', { name: 'Remove Alan Turing' });
    await userEvent.click(remove);
    let confirm = screen.getByRole('dialog', { name: 'Remove Alan Turing?' });
    expect(confirm).toHaveTextContent('Issues assigned to them stay assigned, and their history is kept.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(removed).toBe(0);
    await waitFor(() => expect(remove).toHaveFocus());

    await userEvent.click(remove);
    confirm = screen.getByRole('dialog', { name: 'Remove Alan Turing?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));

    const list = screen.getByRole('list', { name: 'Members' });
    await waitFor(() => expect(within(list).queryByText('Alan Turing')).toBeNull());
    expect(removed).toBe(1);
    expect(toast.success).toHaveBeenCalledWith('Alan Turing removed from Acme.');
    await waitFor(() => expect(list).toHaveFocus());
  });

  it('keeps a member whose removal is refused, and says what to change first', async () => {
    const reason = 'Alan Turing owns the space PAY. Give it another owner first.';
    server.use(http.delete('*/workspaces/w1/members/u3', () => refuse(409, reason, { spaces: ['PAY'] })));
    open('u1', [owner, member]);

    const remove = within(await row('Alan Turing')).getByRole('button', { name: 'Remove Alan Turing' });
    await userEvent.click(remove);
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Remove Alan Turing?' })).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(within(screen.getByRole('list', { name: 'Members' })).getByText('Alan Turing')).toBeInTheDocument();
    await waitFor(() => expect(remove).toHaveFocus());
  });

  it('leaves after a confirm, and goes back to the workspace list', async () => {
    let removed = '';
    server.use(
      http.delete('*/workspaces/w1/members/:userId', ({ params }) => {
        removed = String(params.userId);
        return ok({ user_id: removed });
      }),
    );
    const onClose = open('u3', [owner, member]);

    await userEvent.click(within(await row('Alan Turing')).getByRole('button', { name: 'Leave workspace' }));
    const confirm = screen.getByRole('dialog', { name: 'Leave Acme?' });
    expect(confirm).toHaveTextContent('To come back, an admin or owner has to add you again.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Leave workspace' }));

    expect(await screen.findByText('Back on the list')).toBeInTheDocument();
    expect(removed).toBe('u3');
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('You left Acme.');
  });

  it('keeps the last owner in, and says why', async () => {
    const reason = 'A workspace needs at least one owner. Make someone else an owner first.';
    server.use(http.delete('*/workspaces/w1/members/u1', () => refuse(409, reason)));
    const onClose = open('u1', [owner, member]);

    await userEvent.click(within(await row('Ada Lovelace')).getByRole('button', { name: 'Leave workspace' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Leave Acme?' })).getByRole('button', { name: 'Leave workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(screen.queryByText('Back on the list')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
