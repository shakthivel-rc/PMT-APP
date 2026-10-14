import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeBoard, makeTree } from '@/test/fixtures';
import type { WorkspaceRole } from '@/types';
import ListView from './ListView';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

/**
 * One list, as a board and as a table.
 *
 * What is pinned: the board draws every status the API sends, including empty ones; both
 * ways of moving a card — dragging and the keyboard menu — send the neighbours the drop
 * produced; a refused move puts the card back; and switching to the table regroups the board
 * already held instead of fetching it again, which is the point of the two views sharing one
 * payload.
 */

const space = makeTree().spaces[0];
const list = space.lists[0];

/** Shows the query string, so a test can see what the view toggle wrote to the URL. */
const Search = () => <output data-testid="search">{useLocation().search}</output>;

const render = (role: WorkspaceRole = 'member', route = '/projects/w1/lists/l1') =>
  renderWithProviders(
    <Routes>
      <Route
        path="/projects/w1/lists/l1"
        element={
          <>
            <ListView workspaceId="w1" space={space} list={list} role={role} />
            <Search />
          </>
        }
      />
    </Routes>,
    { route },
  );

/** Counts board reads, so a test can prove a view switch did not add one. */
function countBoardReads() {
  const reads = { count: 0 };
  server.use(
    http.get('*/workspaces/w1/board', () => {
      reads.count += 1;
      return HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data: makeBoard() });
    }),
  );
  return reads;
}

/** Captures the body of the next move request. */
function captureMove(status = 200) {
  const seen: { issueId?: string; body?: unknown } = {};
  server.use(
    http.post('*/workspaces/w1/issues/:issueId/move', async ({ request, params }) => {
      seen.issueId = String(params.issueId);
      seen.body = await request.json();
      const card = makeBoard().columns.flatMap((c) => c.cards).find((c) => c.id === seen.issueId);
      const { status_id } = seen.body as { status_id: string };
      return status === 200
        ? HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data: { ...card, status_id, rank: 'moved' } })
        : HttpResponse.json({ status: 'error', status_code: status, message: 'Issue not found.', data: null }, { status });
    }),
  );
  return seen;
}

const column = (name: string) => screen.getByRole('region', { name });
const cardKeys = (name: string) =>
  within(column(name))
    .queryAllByRole('listitem')
    .map((li) => li.getAttribute('data-card-id'))
    .filter(Boolean);

describe('<ListView> board', () => {
  it('draws one column per status, empty ones included, with their cards in order', async () => {
    render();

    expect(await screen.findByText('Refund to original card')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'To Do',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(cardKeys('To Do')).toEqual(['i1', 'i2']);
    expect(cardKeys('Done')).toEqual([]);

    // The card carries what a board card promises: key, type, priority, points, PR, assignee.
    const card = within(column('To Do')).getAllByRole('listitem')[0];
    expect(within(card).getByText('PAY-1')).toBeInTheDocument();
    expect(within(card).getByText('Story')).toBeInTheDocument();
    expect(within(card).getByText('High')).toBeInTheDocument();
    expect(within(card).getByText('5 pts')).toBeInTheDocument();
    expect(within(card).getByText('PR open')).toBeInTheDocument();
    expect(within(card).getByText('Assigned to Ada Lovelace')).toBeInTheDocument();
    // The category is shown quietly beside the count.
    expect(within(column('In Progress')).getByText('In progress · 1')).toBeInTheDocument();
  });

  it('moves a card from the keyboard menu, to the bottom of the chosen column', async () => {
    const seen = captureMove();
    render();
    await screen.findByText('Refund to original card');

    const trigger = screen.getByRole('button', { name: 'Move PAY-1 to…' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    // Every other status, and not the one it is already in.
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['In Progress', 'In Review', 'Done']);
    await userEvent.keyboard('{Enter}'); // the first item: In Progress

    await waitFor(() => expect(seen.body).toEqual({ status_id: 's-doing', after_id: 'i3', before_id: null }));
    expect(seen.issueId).toBe('i1');
    expect(cardKeys('In Progress')).toEqual(['i3', 'i1']);
    // The card was re-created in its new column; focus follows it rather than falling to <body>.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move PAY-1 to…' })),
    );
    // Announced, since the card's move happened somewhere focus did not go.
    expect(screen.getByText('PAY-1 moved to In Progress.')).toHaveAttribute('role', 'status');
  });

  it('moves a card by drag and drop, naming the neighbours at the drop point', async () => {
    const seen = captureMove();
    render();
    await screen.findByText('Refund to original card');

    const dataTransfer = { setData: vi.fn(), dropEffect: '', effectAllowed: '' };
    const source = within(column('To Do')).getAllByRole('listitem')[0];
    const target = within(column('In Progress')).getByRole('list');

    fireEvent.dragStart(source, { dataTransfer });
    // jsdom lays nothing out, so every card's midpoint is 0 and a pointer at 0 is below all
    // of them: the drop lands at the bottom of the column.
    fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
    fireEvent.drop(target, { dataTransfer, clientY: 0 });

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'PAY-1');
    await waitFor(() => expect(seen.body).toEqual({ status_id: 's-doing', after_id: 'i3', before_id: null }));
    expect(cardKeys('To Do')).toEqual(['i2']);
  });

  it('ignores a drop that did not start on this board', async () => {
    const seen = captureMove();
    render();
    await screen.findByText('Refund to original card');

    fireEvent.drop(within(column('Done')).getByRole('list'), { dataTransfer: {}, clientY: 0 });
    expect(seen.body).toBeUndefined();
  });

  it('puts the card back and says so when the move is refused', async () => {
    captureMove(404);
    render();
    await screen.findByText('Refund to original card');

    screen.getByRole('button', { name: 'Move PAY-1 to…' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // Done

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The move was undone. Issue not found.'));
    expect(cardKeys('To Do')).toEqual(['i1', 'i2']);
    expect(cardKeys('Done')).toEqual([]);
  });

  it('quick-adds a task at the bottom of the column it was typed in', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/issues', async ({ request }) => {
        body = await request.json();
        const [base] = makeBoard().columns[0].cards;
        return HttpResponse.json(
          { status: 'success', status_code: 201, message: 'ok', data: { ...base, id: 'i-new', key: 'PAY-99', type: 'task', ...(body as object) } },
          { status: 201 },
        );
      }),
    );
    render();
    await screen.findByText('Refund to original card');

    await userEvent.click(within(column('In Review')).getByRole('button', { name: 'Add issue' }));
    const input = within(column('In Review')).getByRole('textbox', { name: 'New issue title in In Review' });
    await userEvent.type(input, 'Chargeback webhook{Enter}');

    await waitFor(() =>
      expect(body).toEqual({ list_id: 'l1', title: 'Chargeback webhook', type: 'task', status_id: 's-review' }),
    );
    expect(await within(column('In Review')).findByText('Chargeback webhook')).toBeInTheDocument();
    // Still open and emptied, ready for the next title.
    expect(input).toHaveValue('');
  });

  it('offers a guest no way to change the board', async () => {
    render('guest');
    await screen.findByText('Refund to original card');

    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add issue' })).toBeNull();
    expect(within(column('To Do')).getAllByRole('listitem')[0]).toHaveAttribute('draggable', 'false');
  });

  it('says so when the list is gone, rather than drawing an empty board', async () => {
    server.use(
      http.get('*/workspaces/w1/board', () =>
        HttpResponse.json({ status: 'error', status_code: 404, message: 'Not found.', data: null }, { status: 404 }),
      ),
    );
    render();
    expect(await screen.findByRole('alert')).toHaveTextContent('This list no longer exists');
  });
});

describe('<ListView> list view', () => {
  it('draws the same issues as rows without fetching the board again', async () => {
    const reads = countBoardReads();
    render();
    await screen.findByText('Refund to original card');
    expect(reads.count).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'List' }));

    const table = screen.getByRole('table', { name: 'Issues' });
    const rows = within(table).getAllByRole('row').slice(1); // minus the header row
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['PAY-1', 'PAY-2', 'PAY-3']);
    expect(within(rows[2]).getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?view=list');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    // The whole point: a view switch regroups data already held.
    expect(reads.count).toBe(1);
  });

  it('opens straight into the list view from the URL, and back to the board without a fetch', async () => {
    const reads = countBoardReads();
    render('member', '/projects/w1/lists/l1?view=list');
    expect(await screen.findByRole('table', { name: 'Issues' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(screen.getByRole('region', { name: 'To Do' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(reads.count).toBe(1);
  });

  it('shows a move made on the board in the list view', async () => {
    captureMove();
    render();
    await screen.findByText('Refund to original card');

    screen.getByRole('button', { name: 'Move PAY-1 to…' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{ArrowDown}{Enter}'); // In Review
    await waitFor(() => expect(cardKeys('In Review')).toEqual(['i1']));

    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    const row = screen.getByRole('row', { name: /PAY-1/ });
    expect(within(row).getByText('In Review')).toBeInTheDocument();
  });
});

describe('<ListView> time', () => {
  it('opens the issue a link names in ?issue=, and keeps the open issue in the URL', async () => {
    // The header's running timer and the timesheet link to an issue this way.
    render('member', '/projects/w1/lists/l1?issue=i1');
    expect(await screen.findByRole('dialog', { name: 'Refund to original card' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?issue=i1');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''));
    await userEvent.click(await screen.findByRole('button', { name: '3DS redirect drops the cart id' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?issue=i2'));
  });

  it("updates a card's time when the drawer reports what was logged", async () => {
    render('member', '/projects/w1/lists/l1?issue=i1');
    await screen.findByRole('dialog', { name: 'Refund to original card' });
    // The default world's panel reports 1h 30m on i1, whose card arrived with nothing logged.
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    const row = await screen.findByRole('row', { name: /PAY-1/ });
    await waitFor(() => expect(within(row).getByText('1h 30m')).toBeInTheDocument());
  });

  it('marks a card over its estimate, in words as well as colour', async () => {
    server.use(
      http.get('*/workspaces/w1/board', () => {
        const board = makeBoard();
        board.columns[0].cards[0] = { ...board.columns[0].cards[0], time_spent_seconds: 7200, time_estimate_seconds: 3600 };
        return HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data: board });
      }),
    );
    render();
    expect(await screen.findByText('2h logged of 1h estimated, over the estimate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByText('(over the estimate)', { exact: false })).toBeInTheDocument();
  });
});
