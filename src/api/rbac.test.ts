import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  createPermissionApi,
  fetchPermissionsApi,
  fetchRolesApi,
  updateRolePermissionsApi,
} from '@/api/rbac';

const ok = (data: unknown) =>
  HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

describe('fetchPermissionsApi', () => {
  it('maps records with name/machine_name fallbacks', async () => {
    server.use(
      http.get('*/permissions', () =>
        ok({
          records: [
            { id: 'p1', permission_name: 'Manage Users', machine_name: 'manage_users' },
            { id: 'p2', name: 'Audit Read' }, // no permission_name/machine_name
          ],
        })
      )
    );

    const perms = await fetchPermissionsApi();
    expect(perms[0]).toMatchObject({ id: 'p1', permission_name: 'Manage Users', machine_name: 'manage_users' });
    expect(perms[1]).toMatchObject({ id: 'p2', permission_name: 'Audit Read', machine_name: '' });
  });
});

describe('fetchRolesApi', () => {
  it('hydrates each role with its permissions and falls back to empty perms when detail fails', async () => {
    server.use(
      http.get('*/roles', () => ok({ records: [{ id: 'r1', name: 'Admin' }, { id: 'r2', name: 'Broken' }] })),
      http.get('*/roles/r1', () =>
        ok({ id: 'r1', name: 'Admin', permissions: [{ id: 'p1', permission_name: 'Manage Users' }] })
      ),
      http.get('*/roles/r2', () => new HttpResponse(null, { status: 500 }))
    );

    const roles = await fetchRolesApi();
    expect(roles[0]).toMatchObject({ id: 'r1', name: 'Admin', permissions: [{ id: 'p1', permission_name: 'Manage Users' }] });
    // r2 detail 500 → caught → empty permissions, name from the list record
    expect(roles[1]).toMatchObject({ id: 'r2', name: 'Broken', permissions: [] });
  });

  it('fetches the role details concurrently rather than in a waterfall', async () => {
    // `await` inside a `for…of` meant request k+1 did not start until k had returned, so
    // the "Add member" dropdown stayed empty for (1+N) round trips in series. Asserted by
    // holding every detail response open until all of them have been requested: under the
    // old serial loop only the first would ever arrive and this deadlocks.
    const ids = ['r1', 'r2', 'r3', 'r4'];
    let started = 0;
    let releaseAll: () => void;
    const allStarted = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });

    server.use(
      http.get('*/roles', () => ok({ records: ids.map((id) => ({ id, name: id.toUpperCase() })) })),
      ...ids.map((id) =>
        http.get(`*/roles/${id}`, async () => {
          started += 1;
          if (started === ids.length) releaseAll();
          await allStarted;
          return ok({ id, name: id.toUpperCase(), permissions: [] });
        }),
      ),
    );

    const roles = await fetchRolesApi();

    expect(started).toBe(ids.length);
    expect(roles.map((r) => r.id)).toEqual(ids); // order preserved despite concurrency
  });
});

describe('createPermissionApi', () => {
  it('posts the permission and maps the response', async () => {
    server.use(
      http.post('*/permissions', () =>
        ok({ permission_id: 'p9', permission_name: 'New Perm', machine_name: 'new_perm' })
      )
    );
    const created = await createPermissionApi({ name: 'New Perm' });
    expect(created).toMatchObject({ id: 'p9', permission_name: 'New Perm', machine_name: 'new_perm' });
  });
});

describe('updateRolePermissionsApi', () => {
  it('PUTs {name, permission_ids} and returns the re-fetched role (name supplied)', async () => {
    let putBody: unknown;
    server.use(
      http.put('*/roles/:id', async ({ request }) => {
        putBody = await request.json();
        return ok({});
      }),
      http.get('*/roles/r1', () =>
        ok({ id: 'r1', name: 'Admin', permissions: [{ id: 'p1', permission_name: 'Manage Users' }] })
      )
    );

    const role = await updateRolePermissionsApi('r1', ['p1', 'p2'], 'Admin');
    expect(putBody).toEqual({ name: 'Admin', permission_ids: ['p1', 'p2'] });
    expect(role).toMatchObject({ id: 'r1', name: 'Admin' });
  });

  it('looks up the role name first when it is not supplied', async () => {
    server.use(
      http.get('*/roles/r5', () => ok({ id: 'r5', name: 'Editor', permissions: [] })),
      http.put('*/roles/:id', () => ok({}))
    );
    const role = await updateRolePermissionsApi('r5', ['p1']);
    expect(role.name).toBe('Editor');
  });
});
