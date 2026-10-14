import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/renderWithProviders';
import DataTable, { type DataTableColumn } from './DataTable';

/**
 * The generic table every screen renders its rows through.
 *
 * Two kinds of contract are pinned here. What the current callers (UserTable,
 * ActivityLogClient, RolesAndPermissionsClient) depend on: a caption that is always present,
 * and the empty state belonging to the caller rather than to this component. And two generic
 * capabilities no current screen uses, pinned so a derived project can rely on them: a
 * header that can announce its own sort state, and a cell that is itself a control being
 * able to swallow the row click before it navigates.
 */

interface Row {
  id: string;
  name: string;
  count: number;
}

const ROWS: Row[] = [
  { id: 'a', name: 'alpha', count: 3 },
  { id: 'b', name: 'beta', count: 7 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
  { key: 'count', header: 'Count', align: 'right', cell: (row) => row.count },
];

const render = (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) =>
  renderWithProviders(
    <DataTable
      columns={props.columns ?? COLUMNS}
      rows={props.rows ?? ROWS}
      rowKey={(row) => row.id}
      caption="Example rows"
      {...props}
    />,
  );

describe('<DataTable>', () => {
  it('sums into a real <tfoot> row, one cell per column, empty where nothing is given', () => {
    render({ totals: { count: 10 }, animate: false });
    const footer = screen.getByRole('table').querySelector('tfoot') as HTMLElement;
    const cells = within(footer).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(['', '10']);
    expect(cells[1]).toHaveClass('text-right');
  });

  it('has no footer row unless totals are given', () => {
    render();
    expect(screen.getByRole('table').querySelector('tfoot')).toBeNull();
  });

  it('renders one row per record and one cell per column', () => {
    render();
    // Two body rows plus the header row.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(within(screen.getByRole('row', { name: /alpha/ })).getByText('3')).toBeInTheDocument();
  });

  it('always carries a caption, so the table can be identified without seeing it', () => {
    render();
    expect(screen.getByRole('table')).toHaveAccessibleName('Example rows');
  });

  it('prefers an explicit accessible name where the caller gives one', () => {
    render({ ariaLabel: 'Activity logs' });
    expect(screen.getByRole('table')).toHaveAccessibleName('Activity logs');
  });

  it('renders the callers empty state instead of an empty table', () => {
    // "Nothing here" and "nothing matches your filter" are different facts, and only the
    // caller knows which one is true — so the copy is never this component's to write.
    render({ rows: [], empty: <p>No rows match your filter.</p> });
    expect(screen.getByText('No rows match your filter.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders nothing rather than a bare header when there is no empty state', () => {
    const { container } = render({ rows: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it('replaces the whole body with the loading node while one is given', () => {
    render({ loading: <p>Loading rows…</p> });
    expect(screen.getByText('Loading rows…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('reports a sortable columns state to assistive technology, not just an arrow', () => {
    render({
      columns: [
        {
          key: 'name',
          header: 'Name',
          sort: { active: true, direction: 'asc', onToggle: () => {} },
          cell: (row: Row) => row.name,
        },
        COLUMNS[1],
      ],
    });

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // A column that is not the sorted one says so, rather than saying nothing.
    expect(screen.getByRole('columnheader', { name: 'Count' })).not.toHaveAttribute('aria-sort');
  });

  it('says "none" for a sortable column that is not the one being sorted on', () => {
    render({
      columns: [
        {
          key: 'name',
          header: 'Name',
          sort: { active: false, direction: 'desc', onToggle: () => {} },
          cell: (row: Row) => row.name,
        },
      ],
    });
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('makes a sortable header a real button', async () => {
    const onToggle = vi.fn();
    render({
      columns: [
        {
          key: 'name',
          header: 'Name',
          sort: { active: false, direction: 'asc', onToggle },
          cell: (row: Row) => row.name,
        },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('opens a row when the row itself is clicked', async () => {
    const onRowClick = vi.fn();
    render({ onRowClick });

    await userEvent.click(screen.getByRole('row', { name: /beta/ }));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it('lets a control cell swallow the click before the row navigates', async () => {
    // Radix's switch fires on pointer-down and the row handler on click, so without this a
    // press both flips the switch and navigates away from the result it produced.
    const onRowClick = vi.fn();
    render({
      onRowClick,
      columns: [
        COLUMNS[0],
        {
          key: 'toggle',
          header: 'Toggle',
          stopRowClick: true,
          cell: () => <button type="button">Flip</button>,
        },
      ],
    });

    await userEvent.click(screen.getAllByRole('button', { name: 'Flip' })[0]);
    expect(onRowClick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('row', { name: /alpha/ }));
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it('lets the caller add its own classes to a row', () => {
    render({ rowClassName: (row) => (row.id === 'a' ? 'is-alpha' : undefined) });
    expect(screen.getByRole('row', { name: /alpha/ })).toHaveClass('is-alpha');
    expect(screen.getByRole('row', { name: /beta/ })).not.toHaveClass('is-alpha');
  });

  it('marks only the busy row as busy', () => {
    render({ rowBusy: (row) => row.id === 'a' });
    expect(screen.getByRole('row', { name: /alpha/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('row', { name: /beta/ })).not.toHaveAttribute('aria-busy');
  });

  it('renders its footer under the rows', () => {
    render({ footer: <p>Two of two.</p> });
    expect(screen.getByText('Two of two.')).toBeInTheDocument();
  });

  it('renders a pagination bar when it is given one', () => {
    render({
      pagination: {
        page: 1,
        pageSize: 10,
        total: 42,
        onPageChange: () => {},
        label: 'Example pages',
        itemNoun: { one: 'row', other: 'rows' },
      },
    });

    const nav = screen.getByRole('navigation', { name: 'Example pages' });
    expect(within(nav).getByRole('status')).toHaveTextContent('Showing 1–10 of 42 rows');
  });

  it('has no pagination bar unless one is asked for', () => {
    render();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders unanimated rows when the caller turns the animation off', () => {
    // The RBAC permission table opts out: it is a reference list somebody scans, and a
    // staggered fade on every page turn is motion with nothing to say.
    render({ animate: false });
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });
});
