import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import type { RoleDefinition, User } from '@/types/index';
import UserModal from './UserModal';

// fetchRolesApi is the request whose resolution used to wipe the form. Deferring it by
// hand is the whole point: the bug only reproduces while it is in flight.
const { rolesPromise, resolveRoles } = vi.hoisted(() => {
  let resolve!: (roles: unknown[]) => void;
  const promise = new Promise<unknown[]>((r) => {
    resolve = r;
  });
  return { rolesPromise: promise, resolveRoles: resolve };
});

vi.mock('@/api/rbac', () => ({
  fetchRolesApi: () => rolesPromise,
}));

vi.mock('@/actions/userActions', () => ({
  saveUserAction: vi.fn(async () => ({ success: true })),
}));

const ROLES: RoleDefinition[] = [
  { id: 'role-admin', name: 'Admin', permissions: [] },
  { id: 'role-member', name: 'Member', permissions: [] },
];

const makeUser = (over: Partial<User> = {}): User => ({
  id: 'u1',
  first_name: 'Grace',
  last_name: 'Hopper',
  username: 'ghopper',
  email: 'grace@example.com',
  organization: 'Navy',
  department: 'Research',
  status: true,
  roles: [{ role_id: 'role-admin', role_name: 'Admin' }],
  permissions: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<UserModal> while the roles request is in flight', () => {
  it('keeps typed input when the roles response arrives', async () => {
    // The regression: the reset effect listed `roles` in its dependency array, so the
    // arriving array's new identity re-ran it, `user` was null for a create, and the else
    // branch blanked all seven fields. On a slow network that window is seconds wide.
    renderWithProviders(<UserModal isOpen user={null} onClose={() => {}} />);

    const firstName = screen.getByLabelText('First Name');
    await userEvent.type(firstName, 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');

    resolveRoles(ROLES);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Admin'));

    expect(firstName).toHaveValue('Ada');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('shows the first role as the default without writing it into the form state', async () => {
    renderWithProviders(<UserModal isOpen user={null} onClose={() => {}} />);
    resolveRoles(ROLES);

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Admin'));
  });
});

describe('<UserModal> reset between users', () => {
  it('shows the new member when remounted under a different key', async () => {
    // DashboardClient passes key={editingUser?.id ?? 'new'}; this asserts what that buys,
    // since the effect that used to do the resetting is gone.
    const { rerender } = renderWithProviders(
      <UserModal key="u1" isOpen user={makeUser()} onClose={() => {}} />,
    );
    expect(screen.getByLabelText('First Name')).toHaveValue('Grace');

    rerender(
      <UserModal
        key="u2"
        isOpen
        user={makeUser({ id: 'u2', first_name: 'Alan', last_name: 'Turing' })}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveValue('Alan'));
    expect(screen.getByLabelText('Last Name')).toHaveValue('Turing');
  });
});
