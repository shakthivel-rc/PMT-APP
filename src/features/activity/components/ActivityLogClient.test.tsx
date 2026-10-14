import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import ActivityLogClient from './ActivityLogClient';
import { makeActivityLog, makeUser } from '@/test/fixtures';
import type { ActivityLog } from '@/types/index';

/**
 * The audit trail.
 *
 * The whole log arrives in one request, so what is pinned here is the *rendering*: a page
 * of it at a time, the page returning to 1 when the search narrows the list, and the IP
 * address column staying an administrator's column. That last one is not cosmetic — it
 * identifies where somebody else signed in from.
 */

const ADMIN = makeUser();
const MEMBER = makeUser({ permissions: [] });

const logs = (count: number): ActivityLog[] =>
  Array.from({ length: count }, (_, index) =>
    makeActivityLog({
      id: `a${index + 1}`,
      action: `Action ${index + 1}`,
      userName: index % 2 === 0 ? 'Ada Lovelace' : 'Grace Hopper',
      ipAddress: `10.0.0.${index + 1}`,
    }),
  );

const render = (initialLogs: ActivityLog[], currentUser = ADMIN) =>
  renderWithProviders(
    <ActivityLogClient initialLogs={initialLogs} currentUser={currentUser} />,
  );

describe('<ActivityLogClient>', () => {
  it('renders the entries as a table with an accessible name', () => {
    render(logs(2));
    expect(screen.getByRole('table', { name: 'Activity logs' })).toBeInTheDocument();
    expect(screen.getByText('Action 1')).toBeInTheDocument();
  });

  it('shows one page at a time, with the unpaged total beside it', () => {
    render(logs(24));

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.queryByText('Action 11')).toBeNull();

    const nav = screen.getByRole('navigation', { name: 'Activity log pages' });
    expect(within(nav).getByRole('status')).toHaveTextContent('Showing 1–10 of 24 entries');
  });

  it('moves to the page it is asked for', async () => {
    render(logs(24));

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));

    expect(screen.getByText('Action 21')).toBeInTheDocument();
    expect(screen.queryByText('Action 1')).toBeNull();
  });

  it('returns to page 1 when the search narrows the list', async () => {
    // Page 3 of the previous search is not page 3 of this one — keeping the number would
    // land the reader on an empty table and call it a result.
    render(logs(24));

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    expect(screen.getByText('Action 21')).toBeInTheDocument();

    const search = screen.getByLabelText('Search activity logs');
    await userEvent.click(search);
    await userEvent.paste('Grace');

    const nav = screen.getByRole('navigation', { name: 'Activity log pages' });
    expect(within(nav).getByRole('status')).toHaveTextContent('Showing 1–10 of 12 entries');
    expect(screen.getByText('Action 2')).toBeInTheDocument();
  });

  it('says an empty result is empty because of the filter, and hides the paginator', async () => {
    render(logs(4));

    const search = screen.getByLabelText('Search activity logs');
    await userEvent.click(search);
    await userEvent.paste('nothing matches this');

    expect(screen.getByText('No matching activity')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Activity log pages' })).toBeNull();
  });

  it('keeps the IP address an administrators column', () => {
    const { unmount } = render(logs(1), ADMIN);
    expect(screen.getByRole('columnheader', { name: 'IP Address' })).toBeInTheDocument();
    unmount();

    render(logs(1), MEMBER);
    expect(screen.queryByRole('columnheader', { name: 'IP Address' })).toBeNull();
  });

  it('offers a non-admin no search box, and still pages their own entries', () => {
    render(logs(24), MEMBER);
    expect(screen.queryByLabelText('Search activity logs')).toBeNull();
    expect(
      within(screen.getByRole('navigation', { name: 'Activity log pages' })).getByRole('status'),
    ).toHaveTextContent('Showing 1–10 of 24 entries');
  });
});
