import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import Pagination from './Pagination';

/**
 * The shared pagination control.
 *
 * Most of what is pinned here is *what the control is allowed to claim*: the summary line
 * has to describe the window that is actually on screen, the current page has to be
 * announced and not merely filled in, and the ends have to be dead rather than able to
 * request a page that does not exist. The rest is the landmark, which is what lets two
 * paginated lists share a screen without becoming ambiguous.
 */

const render = (props: Partial<React.ComponentProps<typeof Pagination>> = {}) =>
  renderWithProviders(
    <Pagination
      page={props.page ?? 1}
      pageSize={props.pageSize ?? 10}
      total={props.total ?? 137}
      onPageChange={props.onPageChange ?? (() => {})}
      {...props}
    />,
  );

describe('<Pagination>', () => {
  it('describes the window that is on screen, with the unpaged total beside it', () => {
    render({ page: 5, pageSize: 10, total: 137 });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 41–50 of 137 items');
  });

  it('stops the upper bound at the total on the last page', () => {
    // "Showing 131–140 of 137" is the lie this exists to prevent.
    render({ page: 14, pageSize: 10, total: 137 });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 131–137 of 137 items');
  });

  it('uses the callers noun, singular when there is one of them', () => {
    render({ total: 1, itemNoun: { one: 'user', other: 'users' } });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–1 of 1 user');
  });

  it('renders nothing at all for an empty list', () => {
    // The empty state says what is going on; a paginator underneath it would be a control
    // for navigating nothing.
    const { container } = render({ total: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it('can be hidden when everything already fits on one page', () => {
    const { container } = render({ total: 4, pageSize: 10, hideWhenSinglePage: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders a single page when it is not asked to hide, so the count is visible', () => {
    render({ total: 4, pageSize: 10 });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–4 of 4 items');
  });

  it('announces which button is the current page rather than only filling it in', () => {
    render({ page: 3, pageSize: 10, total: 137 });
    expect(screen.getByRole('button', { name: 'Go to page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Go to page 2' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('moves one page at a time, and jumps to either end', async () => {
    const onPageChange = vi.fn();
    render({ page: 5, pageSize: 10, total: 137, onPageChange });

    await userEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);

    await userEvent.click(screen.getByRole('button', { name: 'Go to previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    await userEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    await userEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(14);
  });

  it('jumps straight to a numbered page', async () => {
    const onPageChange = vi.fn();
    render({ page: 1, pageSize: 10, total: 137, onPageChange });

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('disables both ends on the first page', () => {
    render({ page: 1, pageSize: 10, total: 137 });
    expect(screen.getByRole('button', { name: 'Go to first page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeEnabled();
  });

  it('disables both ends on the last page', () => {
    render({ page: 14, pageSize: 10, total: 137 });
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to last page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeEnabled();
  });

  it('never asks for the page it is already on', async () => {
    // Clicking the current number would otherwise re-request a page that is already
    // rendered — a pointless re-render for a client-paged list, and a wasted round trip
    // once a list pages on the server.
    const onPageChange = vi.fn();
    render({ page: 3, pageSize: 10, total: 137, onPageChange });

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('renders a page number outside the range as the last real page', () => {
    // A stale page against a list that shrank must not produce a dead control.
    render({ page: 99, pageSize: 10, total: 23 });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 21–23 of 23 items');
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
  });

  it('locks every control while a page request is in flight', () => {
    render({ page: 5, pageSize: 10, total: 137, disabled: true });
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeDisabled();
  });

  it('omits the rows-per-page picker unless the caller can act on it', () => {
    render({ total: 137 });
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument();
  });

  it('offers the rows-per-page picker when the caller owns the size', async () => {
    const onPageSizeChange = vi.fn();
    render({ total: 137, pageSize: 10, onPageSizeChange });

    await userEvent.click(screen.getByLabelText('Rows per page'));
    await userEvent.click(await screen.findByRole('option', { name: '25' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('shows a size that is not one of the shared options, rather than an empty trigger', () => {
    render({ total: 137, pageSize: 15, onPageSizeChange: () => {} });
    expect(screen.getByLabelText('Rows per page')).toHaveTextContent('15');
  });

  it('names its landmark, so two paginated lists on one screen stay distinguishable', () => {
    render({ total: 137, label: 'Example pages' });
    const nav = screen.getByRole('navigation', { name: 'Example pages' });
    expect(within(nav).getByRole('status')).toBeInTheDocument();
  });
});
