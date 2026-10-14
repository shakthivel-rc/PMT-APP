import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';

vi.mock('@/api/rbac', () => ({
  fetchRolesApi: vi.fn(),
  fetchPermissionsApi: vi.fn(),
  createPermissionApi: vi.fn(),
  updateRolePermissionsApi: vi.fn(),
}));

import { fetchPermissionsApi, fetchRolesApi } from '@/api/rbac';
import RolesAndPermissionsClient from './RolesAndPermissionsClient';
import { makeRole } from '@/test/fixtures';
import type { Permission, RoleDefinition } from '@/types/index';

/**
 * Roles and permissions — two independent paginated lists on one screen.
 *
 * That is the case worth pinning. Both are `<nav>` landmarks, and two landmarks with the
 * same accessible name on one page is genuinely ambiguous in a landmark list, so each one
 * has to name itself. The counts beside the headings are the *unpaged* totals, because a
 * badge that agreed with the visible page would disagree with reality.
 */

const permissions = (count: number): Permission[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    permission_name: `Permission ${String(index + 1).padStart(2, '0')}`,
    machine_name: `perm_${index + 1}`,
  }));

const roles = (count: number): RoleDefinition[] =>
  Array.from({ length: count }, (_, index) =>
    makeRole({ id: `r${index + 1}`, name: `Role ${String(index + 1).padStart(2, '0')}` }),
  );

beforeEach(() => {
  vi.mocked(fetchRolesApi).mockResolvedValue(roles(2));
  vi.mocked(fetchPermissionsApi).mockResolvedValue(permissions(2));
});

const render = () => renderWithProviders(<RolesAndPermissionsClient />);

describe('<RolesAndPermissionsClient>', () => {
  it('names each paginator, so the two lists are not one ambiguous landmark', async () => {
    vi.mocked(fetchRolesApi).mockResolvedValue(roles(14));
    vi.mocked(fetchPermissionsApi).mockResolvedValue(permissions(24));
    render();

    expect(
      await screen.findByRole('navigation', { name: 'Permission pages' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Role pages' })).toBeInTheDocument();
  });

  it('pages the permissions table and counts the whole list beside the heading', async () => {
    vi.mocked(fetchPermissionsApi).mockResolvedValue(permissions(24));
    render();

    expect(await screen.findByText('Permission 01')).toBeInTheDocument();
    expect(screen.queryByText('Permission 11')).toBeNull();

    const nav = screen.getByRole('navigation', { name: 'Permission pages' });
    expect(within(nav).getByRole('status')).toHaveTextContent(
      'Showing 1–10 of 24 permissions',
    );

    await userEvent.click(within(nav).getByRole('button', { name: 'Go to page 2' }));
    expect(screen.getByText('Permission 11')).toBeInTheDocument();
    expect(screen.queryByText('Permission 01')).toBeNull();
  });

  it('pages the role cards separately from the permission table', async () => {
    vi.mocked(fetchRolesApi).mockResolvedValue(roles(14));
    vi.mocked(fetchPermissionsApi).mockResolvedValue(permissions(24));
    render();

    await screen.findByText('Role 01');
    expect(screen.queryByText('Role 07')).toBeNull();

    const roleNav = screen.getByRole('navigation', { name: 'Role pages' });
    await userEvent.click(within(roleNav).getByRole('button', { name: 'Go to page 2' }));

    expect(screen.getByText('Role 07')).toBeInTheDocument();
    // The other list did not move.
    expect(screen.getByText('Permission 01')).toBeInTheDocument();
  });

  it('hides the role paginator while every role fits on one page', async () => {
    render();
    await screen.findByText('Role 01');
    // A control that can only ever say "1 of 1" is noise on a column of two cards.
    expect(screen.queryByRole('navigation', { name: 'Role pages' })).toBeNull();
  });

  it('says there are no permissions yet rather than rendering an empty table', async () => {
    vi.mocked(fetchPermissionsApi).mockResolvedValue([]);
    render();

    await waitFor(() => expect(screen.getByText('No permissions yet')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Permission pages' })).toBeNull();
  });
});
