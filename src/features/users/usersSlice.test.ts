import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/users', () => ({
  fetchUsersApi: vi.fn(),
  fetchUserStatsApi: vi.fn(),
}));

import { fetchUsersApi, fetchUserStatsApi } from '@/api/users';
import usersReducer, { fetchUsers, fetchUserStats, setUsers } from '@/features/users/usersSlice';
import { logoutUser, sessionExpired } from '@/features/auth/authSlice';
import { makeUser } from '@/test/fixtures';

const INITIAL = {
  users: [],
  status: 'idle',
  error: null,
  stats: null,
  statsStatus: 'idle',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usersSlice', () => {
  it('starts idle with no users', () => {
    expect(usersReducer(undefined, { type: '@@INIT' })).toEqual(INITIAL);
  });

  it('setUsers hydrates the list and marks the load succeeded', () => {
    const users = [makeUser({ id: 'u1' }), makeUser({ id: 'u2' })];
    const state = usersReducer(undefined, setUsers(users));
    expect(state.users).toHaveLength(2);
    expect(state.users.map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(state.status).toBe('succeeded');
  });
});

describe('fetchUsers lifecycle', () => {
  it('moves idle -> loading -> succeeded and stores the list', () => {
    const users = [makeUser({ id: 'u1' })];
    let state = usersReducer(undefined, { type: fetchUsers.pending.type });
    expect(state.status).toBe('loading');

    state = usersReducer(state, { type: fetchUsers.fulfilled.type, payload: users });
    expect(state.status).toBe('succeeded');
    expect(state.users.map((u) => u.id)).toEqual(['u1']);
  });

  it('records the reason on failure instead of silently keeping stale rows', () => {
    const state = usersReducer(undefined, {
      type: fetchUsers.rejected.type,
      error: { message: 'Network down' },
    });
    expect(state.status).toBe('failed');
    expect(state.error).toBe('Network down');
  });

  it('actually calls the API when dispatched through the thunk', async () => {
    vi.mocked(fetchUsersApi).mockResolvedValue([makeUser({ id: 'u9' })]);
    const dispatch = vi.fn();
    await fetchUsers()(dispatch, () => ({}), undefined);
    expect(fetchUsersApi).toHaveBeenCalledTimes(1);
  });
});

describe('fetchUserStats lifecycle', () => {
  it('stores the counts so a mutation can invalidate them', async () => {
    const stats = { totalUsers: 3, activeNow: 2, newThisWeek: 0, rolesDistribution: { Admin: 3 } };
    vi.mocked(fetchUserStatsApi).mockResolvedValue(stats);

    const state = usersReducer(undefined, { type: fetchUserStats.fulfilled.type, payload: stats });
    expect(state.stats).toEqual(stats);
    expect(state.statsStatus).toBe('succeeded');
  });
});

describe('session teardown', () => {
  // The module promise cache this slice replaced survived logout, so a second user signing
  // in on the same tab was served the first user's list. Both endings have to reset it --
  // the 401 handler (sessionExpired) is how most sessions actually end.
  const loaded = usersReducer(undefined, setUsers([makeUser({ id: 'u1' })]));

  it('clears the list on an explicit logout', () => {
    expect(usersReducer(loaded, { type: logoutUser.fulfilled.type })).toEqual(INITIAL);
  });

  it('clears the list when the session expires', () => {
    expect(usersReducer(loaded, sessionExpired())).toEqual(INITIAL);
  });
});
