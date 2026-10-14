import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeTree } from '@/test/fixtures';
import type { WorkspaceTree } from '@/types';
import Workspace from './Workspace';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * The workspace screen: hierarchy on the left, the chosen list on the right.
 *
 * Pinned: the tree is drawn from one read; the create controls exist for admins and owners
 * and for nobody else; a 404 reads as "not found" without guessing at which of the two
 * things the API folds into it; and a route naming a list opens that list's board.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const render = (route = '/projects/w1') =>
  renderWithProviders(
    <Routes>
      <Route path="/projects/:workspaceId" element={<Workspace />} />
      <Route path="/projects/:workspaceId/lists/:listId" element={<Workspace />} />
      <Route path="/projects/:workspaceId/settings" element={<Workspace section="settings" />} />
    </Routes>,
    { route },
  );

/** Serves `tree` and counts reads of it. */
function serveTree(tree: WorkspaceTree = makeTree()) {
  const reads = { count: 0 };
  server.use(
    http.get('*/workspaces/w1', () => {
      reads.count += 1;
      return ok(tree);
    }),
  );
  return reads;
}

const hierarchy = () => screen.getByRole('navigation', { name: 'Workspace hierarchy' });

describe('<Workspace>', () => {
  it('draws spaces, folders and lists, and asks for a list when none is chosen', async () => {
    render();

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' })).toBeInTheDocument();
    const nav = hierarchy();
    expect(within(nav).getByRole('heading', { name: 'Payments · PAY' })).toBeInTheDocument();
    expect(within(nav).getByText('Q4 initiatives')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Backlog' })).toHaveAttribute('href', '/projects/w1/lists/l1');
    expect(within(nav).getByRole('link', { name: 'Refunds' })).toHaveAttribute('href', '/projects/w1/lists/l2');
    expect(screen.getByText('Pick a list')).toBeInTheDocument();
  });

  it('opens the board of the list the route names, and marks it current', async () => {
    render('/projects/w1/lists/l1');

    expect(await screen.findByRole('heading', { level: 2, name: 'Backlog' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'To Do' })).toBeInTheDocument();
    expect(within(hierarchy()).getByRole('link', { name: 'Backlog' })).toHaveAttribute('aria-current', 'page');
  });

  it('says a list is not found when the route names one this workspace does not have', async () => {
    render('/projects/w1/lists/gone');
    expect(await screen.findByText('List not found')).toBeInTheDocument();
  });

  it('shows the tenancy 404 as not found, without saying which kind', async () => {
    render('/projects/someone-elses');

    expect(await screen.findByText('Workspace not found')).toBeInTheDocument();
    expect(screen.getByText('It does not exist, or you are not a member of it.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All workspaces' })).toHaveAttribute('href', '/projects');
  });

  it('shows any other failure as the API worded it', async () => {
    server.use(
      http.get('*/workspaces/w1', () =>
        HttpResponse.json({ status: 'error', status_code: 500, message: 'Database unavailable.', data: null }, { status: 500 }),
      ),
    );
    render();
    expect(await screen.findByText('This workspace could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Database unavailable.')).toBeInTheDocument();
  });

  it.each(['member', 'guest'] as const)('offers a %s no create controls', async (role) => {
    serveTree(makeTree({ role }));
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    expect(screen.queryByRole('button', { name: 'New space' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^New list in/ })).toBeNull();
  });

  it('lets an admin create a space, then reads the tree again to show it', async () => {
    const reads = serveTree(makeTree({ role: 'admin' }));
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/spaces', async ({ request }) => {
        body = await request.json();
        return ok({ id: 'sp2', name: 'Ops', key: 'OPS', statuses: [], folders: [], lists: [] }, 201);
      }),
    );
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    await userEvent.click(screen.getByRole('button', { name: 'New space' }));
    const dialog = screen.getByRole('dialog', { name: 'New space' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ops');
    // Upper-cased as typed, since the API accepts nothing else.
    await userEvent.type(within(dialog).getByLabelText('Key prefix'), 'ops');
    expect(within(dialog).getByLabelText('Key prefix')).toHaveValue('OPS');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body).toEqual({ name: 'Ops', key: 'OPS' });
    expect(reads.count).toBe(2);
  });

  it('explains a whole issue key typed as the prefix, and sends nothing until it is fixed', async () => {
    serveTree(makeTree({ role: 'admin' }));
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/spaces', async ({ request }) => {
        body = await request.json();
        return ok({ id: 'sp2', name: 'Development', key: 'PAY', statuses: [], folders: [], lists: [] }, 201);
      }),
    );
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    await userEvent.click(screen.getByRole('button', { name: 'New space' }));
    const dialog = screen.getByRole('dialog', { name: 'New space' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Development');
    const key = within(dialog).getByLabelText('Key prefix');
    await userEvent.type(key, 'PAY-1');
    // Said while typing: no amount of further typing would make `PAY-1` a prefix.
    const fix = 'Leave out the number: enter PAY, and issues become PAY-1, PAY-2 and so on.';
    expect(within(dialog).getByText(fix)).toBeInTheDocument();
    expect(key).toHaveAttribute('aria-invalid', 'true');
    expect(key).toHaveAccessibleDescription(expect.stringContaining(fix));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(key).toHaveFocus();
    expect(body).toBeUndefined();

    await userEvent.type(key, '{Backspace}{Backspace}');
    expect(within(dialog).queryByText(fix)).toBeNull();
    expect(key).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).getByText('PAY-1')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(body).toEqual({ name: 'Development', key: 'PAY' }));
  });

  it('waits until the key field is left before calling a prefix too short', async () => {
    serveTree(makeTree({ role: 'admin' }));
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    await userEvent.click(screen.getByRole('button', { name: 'New space' }));
    const dialog = screen.getByRole('dialog', { name: 'New space' });
    await userEvent.type(within(dialog).getByLabelText('Key prefix'), 'P');
    expect(within(dialog).queryByText('Use at least 2 characters.')).toBeNull();
    await userEvent.click(within(dialog).getByLabelText('Name'));
    expect(within(dialog).getByText('Use at least 2 characters.')).toBeInTheDocument();
  });

  it('creates a list inside a folder and opens it', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/lists', async ({ request }) => {
        body = await request.json();
        return ok({ id: 'l2', name: 'Chargebacks', folder_id: 'f1', position: 1 }, 201);
      }),
    );
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    await userEvent.click(screen.getByRole('button', { name: 'New list in Q4 initiatives' }));
    const dialog = screen.getByRole('dialog', { name: 'New list in Q4 initiatives' });
    expect(within(dialog).queryByLabelText('Key prefix')).toBeNull();
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Chargebacks');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(body).toEqual({ space_id: 'sp1', folder_id: 'f1', name: 'Chargebacks' }));
    // Navigated to the new list — `l2` is in the fixture tree as "Refunds".
    expect(await screen.findByRole('heading', { level: 2, name: 'Refunds' })).toBeInTheDocument();
  });

  it('keeps the dialog open with the API’s reason when a create is refused', async () => {
    server.use(
      http.post('*/workspaces/w1/spaces', () =>
        HttpResponse.json({ status: 'error', status_code: 409, message: 'Key PAY is taken.', data: null }, { status: 409 }),
      ),
    );
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    await userEvent.click(screen.getByRole('button', { name: 'New space' }));
    const dialog = screen.getByRole('dialog', { name: 'New space' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Payments 2');
    await userEvent.type(within(dialog).getByLabelText('Key prefix'), 'PAY');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Key PAY is taken.');
    expect(screen.getByRole('dialog', { name: 'New space' })).toBeInTheDocument();
  });

  it('carries the list view across lists', async () => {
    render('/projects/w1/lists/l1?view=list');
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });
    expect(within(hierarchy()).getByRole('link', { name: 'Refunds' })).toHaveAttribute(
      'href',
      '/projects/w1/lists/l2?view=list',
    );
  });

  it('renders Project Settings navigation link for spaces in hierarchy', async () => {
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    const settingsLink = within(hierarchy()).getByRole('link', { name: /project settings/i });
    expect(settingsLink).toHaveAttribute('href', '/projects/w1/spaces/sp1/settings');
  });

  it('prompts for a first space in an empty workspace', async () => {
    serveTree(makeTree({ spaces: [] }));
    render();
    expect(await screen.findByText('No spaces yet.')).toBeInTheDocument();
    expect(screen.getByText(/This workspace has no spaces yet/)).toBeInTheDocument();
  });

  it('disables space tree collapse button when no list is selected', async () => {
    render();
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    const toggleBtn = screen.getByRole('button', {
      name: 'Select a list from the hierarchy to collapse space tree',
    });
    expect(toggleBtn).toBeDisabled();
    expect(toggleBtn).toHaveClass('opacity-40');
    expect(toggleBtn).toHaveClass('cursor-not-allowed');

    // Attempting to click does not collapse the tree
    await userEvent.click(toggleBtn);
    expect(hierarchy()).toBeInTheDocument();
    expect(screen.getByText('Pick a list')).toBeInTheDocument();
  });

  it('enables space tree collapse button once a list is selected', async () => {
    render('/projects/w1/lists/l1');
    await screen.findByRole('heading', { level: 2, name: 'Backlog' });

    const collapseBtn = screen.getByRole('button', { name: 'Collapse space tree' });
    expect(collapseBtn).toBeEnabled();
    expect(collapseBtn).not.toHaveClass('opacity-40');

    await userEvent.click(collapseBtn);

    const expandBtn = await screen.findByRole('button', { name: 'Expand space tree' });
    expect(expandBtn).toBeInTheDocument();
  });

  it('renders and opens Common Project Settings with active navigation link', async () => {
    server.use(
      http.get('*/workspaces/w1/settings/governance', () =>
        ok({
          default_workflow_template: 'default',
          require_space_charter: false,
          require_epic_owner_and_criteria: true,
          inactive_after_days: 90,
        }),
      ),
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
      http.get('*/workspaces/w1/members', () => ok([])),
      http.get('*/workspaces/w1/storage', () => ok({ provider: 'local', fallback_to_local: true, configured: true })),
    );

    render('/projects/w1/settings');
    await screen.findByRole('heading', { level: 1, name: 'Acme Engineering' });

    expect(await screen.findByRole('heading', { name: 'Project Governance & Defaults' })).toBeInTheDocument();

    const commonSettingsLinks = within(hierarchy()).getAllByRole('link', { name: /common settings/i });
    expect(commonSettingsLinks.length).toBeGreaterThanOrEqual(1);
    expect(commonSettingsLinks[0]).toHaveAttribute('href', '/projects/w1/settings');
  });
});
