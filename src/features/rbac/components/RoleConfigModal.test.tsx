import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import RoleConfigModal from './RoleConfigModal';
import { makeRole } from '@/test/fixtures';
import type { Permission } from '@/types/index';

/**
 * The dialog that assigns permissions to a role.
 *
 * The list used to be a 400px scroll box, which on a deployment with thirty permissions hid
 * most of them behind a scrollbar and gave no way to say where you were. What is pinned
 * here is that paging it did not cost the thing the dialog is for: a switch flipped on page
 * 2 has to still be selected when page 1 comes back.
 */

const permissions = (count: number): Permission[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    permission_name: `Permission ${String(index + 1).padStart(2, '0')}`,
    machine_name: `perm_${index + 1}`,
  }));

const render = (all: Permission[], role = makeRole({ permissions: [] })) =>
  renderWithProviders(
    <RoleConfigModal
      isOpen
      onClose={vi.fn()}
      role={role}
      allPermissions={all}
      onSuccess={vi.fn()}
    />,
  );

const paginator = () => screen.getByRole('navigation', { name: 'Permission list pages' });

describe('<RoleConfigModal>', () => {
  it('shows one page of switches at a time', () => {
    render(permissions(20));
    expect(screen.getByLabelText('Toggle Permission 01')).toBeInTheDocument();
    expect(screen.queryByLabelText('Toggle Permission 07')).toBeNull();
    expect(within(paginator()).getByRole('status')).toHaveTextContent(
      'Showing 1–6 of 20 permissions',
    );
  });

  it('keeps a selection made on one page when another is shown', async () => {
    // The dialog's whole job. Paging is a view change, not a form reset.
    render(permissions(20));

    await userEvent.click(screen.getByLabelText('Toggle Permission 02'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(within(paginator()).getByRole('button', { name: 'Go to page 2' }));
    await userEvent.click(screen.getByLabelText('Toggle Permission 08'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(within(paginator()).getByRole('button', { name: 'Go to page 1' }));
    expect(screen.getByLabelText('Toggle Permission 02')).toBeChecked();
  });

  it('starts a role already holding a permission with that switch on', () => {
    render(permissions(20), makeRole({ permissions: [{ id: 'p3', permission_name: 'x' }] }));
    expect(screen.getByLabelText('Toggle Permission 03')).toBeChecked();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('hides the paginator when every permission already fits', () => {
    render(permissions(4));
    expect(screen.queryByRole('navigation', { name: 'Permission list pages' })).toBeNull();
  });

  it('says there is nothing to assign rather than rendering an empty list', () => {
    render([]);
    expect(screen.getByText('No permissions available')).toBeInTheDocument();
  });
});
