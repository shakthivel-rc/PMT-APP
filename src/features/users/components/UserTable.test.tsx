import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import UserTable from './UserTable';
import { loggedInState, makeUser } from '@/test/fixtures';
import type { User } from '@/types/index';
import type { RootState } from '@/app/store';

/**
 * The user table.
 *
 * The list is already in the store, so paging it is a rendering decision. What is pinned
 * here is that it stays honest while it does: the total below the table is the whole list
 * rather than the page, narrowing the search returns to page 1, and a member cannot page
 * their way to a Delete button they were never allowed to see.
 */

const CURRENT = makeUser({ id: 'u0', first_name: 'Ada', last_name: 'Lovelace' });

const people = (count: number): User[] =>
  Array.from({ length: count }, (_, index) =>
    makeUser({
      id: `u${index + 1}`,
      first_name: 'Person',
      last_name: String(index + 1).padStart(2, '0'),
      username: `person${index + 1}`,
      email: `person${index + 1}@example.com`,
    }),
  );

const stateWith = (users: User[], currentUser = CURRENT): Partial<RootState> =>
  ({
    ...loggedInState(currentUser),
    users: { users, status: 'succeeded', error: null, stats: null, statsStatus: 'idle' },
  }) as Partial<RootState>;

const render = (users: User[], currentUser = CURRENT) =>
  renderWithProviders(<UserTable onEditUser={vi.fn()} />, {
    preloadedState: stateWith(users, currentUser),
  });

const paginator = () => screen.getByRole('navigation', { name: 'User pages' });

describe('<UserTable>', () => {
  it('renders one page of users, and counts the whole list under it', () => {
    render(people(24));

    expect(screen.getByText('Person 01')).toBeInTheDocument();
    expect(screen.queryByText('Person 11')).toBeNull();
    expect(within(paginator()).getByRole('status')).toHaveTextContent(
      'Showing 1–10 of 24 users',
    );
  });

  it('moves to the page it is asked for', async () => {
    render(people(24));

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));

    expect(screen.getByText('Person 11')).toBeInTheDocument();
    expect(screen.queryByText('Person 01')).toBeNull();
  });

  it('shows more rows per page when asked, and starts that size at page 1', async () => {
    render(people(24));

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    await userEvent.click(screen.getByLabelText('Rows per page'));
    await userEvent.click(await screen.findByRole('option', { name: '25' }));

    expect(within(paginator()).getByRole('status')).toHaveTextContent(
      'Showing 1–24 of 24 users',
    );
    expect(screen.getByText('Person 01')).toBeInTheDocument();
    expect(screen.getByText('Person 24')).toBeInTheDocument();
  });

  it('returns to page 1 when the search narrows the list', async () => {
    render(people(24));

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    await userEvent.click(screen.getByLabelText('Search users'));
    await userEvent.paste('person1@');

    expect(within(paginator()).getByRole('status')).toHaveTextContent('Showing 1–1 of 1 user');
    expect(screen.getByText('Person 01')).toBeInTheDocument();
  });

  it('says nothing matched rather than rendering an empty table', async () => {
    render(people(4));

    await userEvent.click(screen.getByLabelText('Search users'));
    await userEvent.paste('nobody by that name');

    expect(screen.getByText('No users found')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'User pages' })).toBeNull();
  });

  it('never offers Delete for the signed-in user, on any page', async () => {
    // Paging must not become a way around a permission check: the row is rendered by the
    // same code whichever page it lands on.
    const self = makeUser({ id: 'u12', first_name: 'Person', last_name: '12' });
    render([...people(24)], self);

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));

    expect(screen.getByText('Person 12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Person 12' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Person 11' })).toBeInTheDocument();
  });

  it('offers a member neither Edit nor Delete', () => {
    render(people(3), makeUser({ id: 'u0', permissions: [] }));
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });
});
