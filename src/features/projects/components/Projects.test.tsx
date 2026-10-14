import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeWorkspace } from '@/test/fixtures';
import type { WorkspaceSummary } from '@/types';
import Projects from './Projects';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * `/projects`: the caller's workspaces, the way to start one when there are none, and, for
 * admins and owners, the way to change one.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const Opened = () => <p>Opened workspace {useParams().workspaceId}</p>;

const render = () =>
  renderWithProviders(
    <Routes>
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:workspaceId" element={<Opened />} />
    </Routes>,
    { route: '/projects' },
  );

describe('<Projects>', () => {
  it('lists the caller’s workspaces as links into each', async () => {
    server.use(
      http.get('*/workspaces', () => ok([makeWorkspace(), makeWorkspace({ id: 'w2', name: 'Side project', slug: 'side', role: 'guest' })])),
    );
    render();

    const list = await screen.findByRole('list', { name: 'Workspaces' });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/projects/w1', '/projects/w2']);
    expect(within(links[1]).getByText('Guest')).toBeInTheDocument();
    // A second workspace can still be started from here.
    expect(screen.getByRole('heading', { name: 'New workspace' })).toBeInTheDocument();
  });

  it('offers the create form in the empty state, and opens the workspace it made', async () => {
    let body: unknown;
    server.use(
      http.get('*/workspaces', () => ok([])),
      http.post('*/workspaces', async ({ request }) => {
        body = await request.json();
        return ok(makeWorkspace({ id: 'w9', name: 'Acme Engineering', slug: 'acme-engineering' }), 201);
      }),
    );
    render();

    expect(await screen.findByText('No workspaces yet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'Acme Engineering');
    // The slug follows the name until someone edits it.
    expect(screen.getByLabelText('Slug')).toHaveValue('acme-engineering');
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByText('Opened workspace w9')).toBeInTheDocument();
    expect(body).toEqual({ name: 'Acme Engineering', slug: 'acme-engineering' });
  });

  it('stops suggesting a slug once it has been edited by hand', async () => {
    server.use(http.get('*/workspaces', () => ok([])));
    render();
    await screen.findByText('No workspaces yet');

    await userEvent.type(screen.getByLabelText('Slug'), 'acme');
    await userEvent.type(screen.getByLabelText('Name'), 'Something Else');
    expect(screen.getByLabelText('Slug')).toHaveValue('acme');
  });

  it('lower-cases the slug as typed and explains one it cannot send', async () => {
    let posted = false;
    server.use(
      http.get('*/workspaces', () => ok([])),
      http.post('*/workspaces', () => {
        posted = true;
        return ok(makeWorkspace(), 201);
      }),
    );
    render();
    await screen.findByText('No workspaces yet');

    await userEvent.type(screen.getByLabelText('Name'), 'Acme');
    const slug = screen.getByLabelText('Slug');
    await userEvent.clear(slug);
    await userEvent.type(slug, 'Acme_Eng');
    expect(slug).toHaveValue('acme_eng');
    expect(screen.getByText('Use only lower-case letters a–z, digits and hyphens.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(slug).toHaveFocus();
    expect(posted).toBe(false);
  });

  it('shows the API’s reason when the slug is refused', async () => {
    server.use(
      http.get('*/workspaces', () => ok([])),
      http.post('*/workspaces', () =>
        HttpResponse.json({ status: 'error', status_code: 409, message: 'That slug is taken.', data: null }, { status: 409 }),
      ),
    );
    render();
    await screen.findByText('No workspaces yet');

    await userEvent.type(screen.getByLabelText('Name'), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That slug is taken.');
  });

  it('says so when the workspaces cannot be read', async () => {
    server.use(
      http.get('*/workspaces', () =>
        HttpResponse.json({ status: 'error', status_code: 500, message: 'Database unavailable.', data: null }, { status: 500 }),
      ),
    );
    render();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable.');
  });
});

/**
 * Edit and Delete, from each card's actions menu. Pinned: who is offered which, that a delete
 * waits for the exact name, that the list is read again after either, that a refusal stays in
 * its dialog in the API's words, and where focus goes once a dialog closes.
 */
describe('<Projects> changing a workspace', () => {
  const owned = makeWorkspace();
  const administered = makeWorkspace({ id: 'w2', name: 'Side project', slug: 'side', role: 'admin' });

  const refuse = (status: number, message: string, data: unknown = null) =>
    HttpResponse.json({ status: 'error', status_code: status, message, data }, { status });

  /** Serves the list as it stands, so a re-read after a change sees the change. */
  function serveList(initial: WorkspaceSummary[]) {
    const state = { list: initial, reads: 0 };
    server.use(
      http.get('*/workspaces', () => {
        state.reads += 1;
        return ok(state.list);
      }),
    );
    return state;
  }

  const openAction = async (workspace: string, action: 'Edit' | 'Delete') => {
    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${workspace}` }));
    await userEvent.click(screen.getByRole('menuitem', { name: action }));
  };

  it('offers Edit to admins and owners, Delete to owners only, and members and guests nothing', async () => {
    serveList([
      owned,
      administered,
      makeWorkspace({ id: 'w3', name: 'Ops', role: 'member' }),
      makeWorkspace({ id: 'w4', name: 'Archive', role: 'guest' }),
    ]);
    render();
    await screen.findByRole('list', { name: 'Workspaces' });

    expect(screen.queryByRole('button', { name: 'Actions for Ops' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Actions for Archive' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme Engineering' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit', 'Delete']);
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Side project' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit']);
  });

  it('renames without touching the slug, reads the list again, and gives focus back to the menu button', async () => {
    const state = serveList([owned]);
    let body: unknown;
    server.use(
      http.patch('*/workspaces/w1', async ({ request }) => {
        body = await request.json();
        state.list = [makeWorkspace({ name: 'Acme Platform' })];
        return ok(state.list[0]);
      }),
    );
    render();
    await openAction('Acme Engineering', 'Edit');

    const dialog = screen.getByRole('dialog', { name: 'Edit Acme Engineering' });
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('Acme Engineering');
    await userEvent.clear(name);
    await userEvent.type(name, 'Acme Platform');
    // The slug is already in links, so unlike on create it does not follow the name.
    expect(within(dialog).getByLabelText('Slug')).toHaveValue('acme-eng');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Only what changed.
    expect(body).toEqual({ name: 'Acme Platform' });
    expect(toast.success).toHaveBeenCalledWith('Acme Platform saved.');
    expect(state.reads).toBe(2);
    const trigger = await screen.findByRole('button', { name: 'Actions for Acme Platform' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('checks the slug as on create, and keeps the dialog open with the API’s reason for a taken one', async () => {
    serveList([owned]);
    let patches = 0;
    server.use(
      http.patch('*/workspaces/w1', () => {
        patches += 1;
        return refuse(409, 'That slug is taken, possibly by a deleted workspace, which keeps it.');
      }),
    );
    render();
    await openAction('Acme Engineering', 'Edit');

    const dialog = screen.getByRole('dialog', { name: 'Edit Acme Engineering' });
    const slug = within(dialog).getByLabelText('Slug');
    await userEvent.clear(slug);
    await userEvent.type(slug, 'Acme_Eng');
    expect(slug).toHaveValue('acme_eng');
    expect(within(dialog).getByText('Use only lower-case letters a–z, digits and hyphens.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(slug).toHaveFocus();
    expect(patches).toBe(0);

    await userEvent.clear(slug);
    await userEvent.type(slug, 'acme');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That slug is taken, possibly by a deleted workspace');
    expect(screen.getByRole('dialog', { name: 'Edit Acme Engineering' })).toBeInTheDocument();
  });

  it('closes without a request when nothing was changed', async () => {
    // No PATCH handler: one sent would fail the test as an unhandled request.
    serveList([owned]);
    render();
    await openAction('Acme Engineering', 'Edit');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('deletes only once the exact name is typed, says what it means, and lands focus on what is left', async () => {
    const state = serveList([owned, administered]);
    let deletes = 0;
    server.use(
      http.delete('*/workspaces/w1', () => {
        deletes += 1;
        state.list = [administered];
        return ok({ id: 'w1' });
      }),
    );
    render();
    await openAction('Acme Engineering', 'Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete Acme Engineering?' });
    // What it means is the dialog's description, so it is read out with the title.
    expect(dialog).toHaveAccessibleDescription(
      'Every member loses the workspace and everything in it: its spaces, lists, issues and logged time. ' +
        'Its history is kept, but it is not shown anywhere any more.',
    );
    const confirm = within(dialog).getByRole('button', { name: 'Delete workspace' });
    expect(confirm).toBeDisabled();

    const field = within(dialog).getByLabelText('To confirm, type Acme Engineering');
    await userEvent.type(field, 'acme engineering');
    expect(confirm).toBeDisabled();
    // Enter submits the form even with its button disabled; nothing may be sent.
    await userEvent.type(field, '{Enter}');
    expect(deletes).toBe(0);

    await userEvent.clear(field);
    await userEvent.type(field, 'Acme Engineering');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deletes).toBe(1);
    expect(toast.success).toHaveBeenCalledWith('Acme Engineering deleted.');
    const list = screen.getByRole('list', { name: 'Workspaces' });
    expect(within(list).queryByText('Acme Engineering')).toBeNull();
    expect(state.reads).toBe(2);
    // Its row, and the menu button focus would have gone back to, are gone.
    await waitFor(() => expect(list).toHaveFocus());
  });

  it('keeps a refused delete in its dialog in the API’s words, and Cancel gives focus back', async () => {
    serveList([owned]);
    server.use(
      http.delete('*/workspaces/w1', () =>
        refuse(409, 'A timer is running on PAY-1. Stop it first.', { issue_keys: ['PAY-1'] }),
      ),
    );
    render();
    await openAction('Acme Engineering', 'Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete Acme Engineering?' });
    await userEvent.type(within(dialog).getByLabelText('To confirm, type Acme Engineering'), 'Acme Engineering');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A timer is running on PAY-1. Stop it first.');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Acme Engineering')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for Acme Engineering' })).toHaveFocus());
  });

  it('offers the create form, focused, once the last workspace is deleted', async () => {
    const state = serveList([owned]);
    server.use(
      http.delete('*/workspaces/w1', () => {
        state.list = [];
        return ok({ id: 'w1' });
      }),
    );
    render();
    await openAction('Acme Engineering', 'Delete');
    const dialog = screen.getByRole('dialog', { name: 'Delete Acme Engineering?' });
    await userEvent.type(within(dialog).getByLabelText('To confirm, type Acme Engineering'), 'Acme Engineering');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }));

    expect(await screen.findByText('No workspaces yet')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
  });

  it('leaves the URLs of the workspace it deletes, should that one be open', async () => {
    serveList([owned]);
    server.use(http.delete('*/workspaces/w1', () => ok({ id: 'w1' })));
    renderWithProviders(
      <Routes>
        <Route path="/projects" element={<p>Back on the list</p>} />
        <Route path="/projects/:workspaceId/*" element={<Projects />} />
      </Routes>,
      { route: '/projects/w1/lists/l1' },
    );
    await openAction('Acme Engineering', 'Delete');
    const dialog = screen.getByRole('dialog', { name: 'Delete Acme Engineering?' });
    await userEvent.type(within(dialog).getByLabelText('To confirm, type Acme Engineering'), 'Acme Engineering');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workspace' }));

    expect(await screen.findByText('Back on the list')).toBeInTheDocument();
  });
});
