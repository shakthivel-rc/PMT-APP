import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  createUserApi,
  deleteUserApi,
  fetchUserStatsApi,
  fetchUsersApi,
  updateUserApi,
} from '@/api/users';

const ok = (data: unknown) =>
  HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

describe('fetchUsersApi + mapBackendUser', () => {
  it('maps backend records and fills defaults for missing fields', async () => {
    server.use(
      http.get('*/users', () =>
        ok({
          records: [
            {
              id: '1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              username: 'ada',
              email: 'ada@x.com',
              status: true,
              roles: [{ role_id: 'r1', role_name: 'Admin' }],
              permissions: [{ machine_name: 'manage_users', permission_name: 'Manage Users' }],
            },
            { id: '2' }, // everything else missing → defaults
          ],
        })
      )
    );

    const users = await fetchUsersApi();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ id: '1', first_name: 'Ada', roles: [{ role_id: 'r1', role_name: 'Admin' }] });
    expect(users[1]).toMatchObject({
      id: '2',
      first_name: '',
      last_name: '',
      status: true, // status ?? true
      roles: [],
      permissions: [],
    });
  });
});

describe('fetchUserStatsApi aggregation', () => {
  it('computes totals, active count, and roles distribution', async () => {
    server.use(
      http.get('*/users', () =>
        ok({
          records: [
            { id: '1', status: true, roles: [{ role_id: 'r1', role_name: 'Admin' }] },
            { id: '2', status: true, roles: [{ role_id: 'r2', role_name: 'Member' }] },
            { id: '3', status: false, roles: [{ role_id: 'r1', role_name: 'Admin' }] },
            { id: '4', status: true, roles: [] }, // → "No Role"
          ],
        })
      )
    );

    const stats = await fetchUserStatsApi();
    expect(stats.totalUsers).toBe(4);
    expect(stats.activeNow).toBe(3); // status === true
    expect(stats.newThisWeek).toBe(0); // not implemented server-side
    expect(stats.rolesDistribution).toEqual({ Admin: 2, Member: 1, 'No Role': 1 });
  });
});

describe('createUserApi', () => {
  it('creates then resolves the new user by email from the re-fetched list', async () => {
    server.use(
      http.post('*/users', () => ok({})),
      http.get('*/users', () => ok({ records: [{ id: '9', email: 'new@x.com', status: true }] }))
    );

    const created = await createUserApi({
      email: 'new@x.com',
      first_name: 'New',
      last_name: 'User',
      organization: '',
      department: '',
      username: 'newuser',
      role_id: 'r1',
    });
    expect(created).toMatchObject({ id: '9', email: 'new@x.com' });
  });
});

describe('updateUserApi', () => {
  it('PUTs the change then returns the re-fetched, mapped user', async () => {
    server.use(
      http.put('*/users/:id', () => ok({})),
      http.get('*/users/:id', ({ params }) =>
        ok({ id: params.id, first_name: 'Up', last_name: 'Dated', status: true })
      )
    );

    const updated = await updateUserApi('7', {
      first_name: 'Up',
      last_name: 'Dated',
      email: 'u@x.com',
      organization: '',
      department: '',
    });
    expect(updated).toMatchObject({ id: '7', first_name: 'Up', last_name: 'Dated' });
  });
});

describe('deleteUserApi', () => {
  it('returns the deleted id', async () => {
    server.use(http.delete('*/users/:id', () => ok({})));
    expect(await deleteUserApi('5')).toBe('5');
  });
});
