
import { createSlice, createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchUsersApi, fetchUserStatsApi, type UserStats } from '../../api/users';
import { logoutUser, sessionExpired } from '../auth/authSlice';
import type { User } from '../../types/index';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface UsersState {
  users: User[];
  status: RequestStatus;
  error: string | null;
  stats: UserStats | null;
  statsStatus: RequestStatus;
}

const initialState: UsersState = {
  users: [],
  status: 'idle',
  error: null,
  stats: null,
  statsStatus: 'idle',
};

/**
 * The single owner of the user list.
 *
 * This replaces a module-scoped promise that fed `use()` and was never invalidated on
 * success — only inside `.catch`. Because routes are `React.lazy` and unmount on
 * navigation, revisiting the dashboard replayed the promise resolved *before* a mutation
 * and dispatched the stale array over the fresh one, so a deleted user came back and a
 * created one vanished. It also outlived logout, serving one user's list to the next.
 *
 * `use()` is a legitimate way to read a cached promise; what it does not give you is
 * invalidation, a staleness policy or a per-session cache key, which is exactly where all
 * three defects lived.
 */
export const fetchUsers = createAsyncThunk('users/fetch', () => fetchUsersApi());

export const fetchUserStats = createAsyncThunk('users/fetchStats', () => fetchUserStatsApi());

// Kept for callers that already hold a fresh list; the store is still the only reader.
export const setUsers = createAction<User[]>('users/setUsers');

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setUsers, (state, action) => {
        state.users = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchUsers.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.users = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to load users.';
      })
      .addCase(fetchUserStats.pending, (state) => {
        state.statsStatus = 'loading';
      })
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.stats = action.payload;
        state.statsStatus = 'succeeded';
      })
      .addCase(fetchUserStats.rejected, (state) => {
        state.statsStatus = 'failed';
      })
      // Signing out has to reset this, or the next user on the same tab is served the
      // previous one's list — the cross-session leak the module cache had, in a new form.
      // `sessionExpired` matters as much as an explicit logout: the 401 handler is how
      // most sessions actually end.
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(sessionExpired, () => initialState);
  },
});

export default usersSlice.reducer;
