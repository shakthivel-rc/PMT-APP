import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderWithProviders, screen, waitFor, makeStore } from '@/test/renderWithProviders';

vi.mock('@/api/users', () => ({
  fetchUsersApi: vi.fn(),
  fetchUserStatsApi: vi.fn(async () => ({
    totalUsers: 0,
    activeNow: 0,
    newThisWeek: 0,
    rolesDistribution: {},
  })),
}));

vi.mock('@/api/rbac', () => ({
  fetchRolesApi: vi.fn(async () => []),
  fetchPermissionsApi: vi.fn(async () => []),
}));

import { fetchUsersApi } from '@/api/users';
import { makeUser } from '@/test/fixtures';
import DashboardClient from './DashboardClient';

const ADA = makeUser({ id: 'u1', first_name: 'Ada', last_name: 'Lovelace' });
const GRACE = makeUser({ id: 'u2', first_name: 'Grace', last_name: 'Hopper' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<DashboardClient> data ownership', () => {
  it('renders the list the store holds after a mutation, not a replayed first response', async () => {
    // The exact defect this replaces: routes are React.lazy and unmount on navigation, so
    // revisiting the dashboard re-ran `use(getUsers())` against a module promise resolved
    // BEFORE the delete, and the mount effect dispatched that stale array over the fresh
    // one -- putting the deleted user back on screen.
    vi.mocked(fetchUsersApi).mockResolvedValueOnce([ADA, GRACE]);
    const store = makeStore();

    const first = renderWithProviders(<DashboardClient />, { store });
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    // Ada is deleted; the next fetch returns only Grace.
    vi.mocked(fetchUsersApi).mockResolvedValue([GRACE]);
    const { fetchUsers } = await import('../usersSlice');
    await act(async () => {
      await store.dispatch(fetchUsers());
    });

    first.unmount();
    renderWithProviders(<DashboardClient />, { store });

    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('does not refetch on a remount that the store can already serve', async () => {
    vi.mocked(fetchUsersApi).mockResolvedValue([ADA]);
    const store = makeStore();

    const first = renderWithProviders(<DashboardClient />, { store });
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(fetchUsersApi).toHaveBeenCalledTimes(1);

    first.unmount();
    renderWithProviders(<DashboardClient />, { store });

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(fetchUsersApi).toHaveBeenCalledTimes(1);
  });
});
