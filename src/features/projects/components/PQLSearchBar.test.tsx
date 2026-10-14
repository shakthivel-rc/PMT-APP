import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { PQLSearchBar } from './PQLSearchBar';
import { pqlApi } from '../../../api/pql';

vi.mock('../../../api/pql', () => ({
  pqlApi: {
    validate: vi.fn(),
    execute: vi.fn(),
  },
}));

describe('<PQLSearchBar>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with custom placeholder', () => {
    renderWithProviders(
      <PQLSearchBar
        workspaceId="ws-1"
        onSearch={vi.fn()}
        placeholder="Enter custom PQL"
      />
    );

    expect(screen.getByPlaceholderText('Enter custom PQL')).toBeInTheDocument();
  });

  it('validates query and shows valid badge on valid PQL', async () => {
    vi.mocked(pqlApi.validate).mockResolvedValueOnce({
      status: 'success',
      status_code: 200,
      message: 'ok',
      data: { valid: true },
    });

    renderWithProviders(
      <PQLSearchBar workspaceId="ws-1" onSearch={vi.fn()} />
    );

    const input = screen.getByRole('textbox', { name: /pql query input/i });
    fireEvent.change(input, { target: { value: 'priority = "urgent"' } });

    await waitFor(() => {
      expect(pqlApi.validate).toHaveBeenCalledWith('ws-1', 'priority = "urgent"');
    });

    await waitFor(() => {
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });

  it('shows error badge when query is invalid', async () => {
    vi.mocked(pqlApi.validate).mockResolvedValueOnce({
      status: 'error',
      status_code: 200,
      message: 'failed',
      data: { valid: false, error: 'Expected operator at position 12' },
    });

    renderWithProviders(
      <PQLSearchBar workspaceId="ws-1" onSearch={vi.fn()} />
    );

    const input = screen.getByRole('textbox', { name: /pql query input/i });
    fireEvent.change(input, { target: { value: 'priority invalid' } });

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('calls onSearch when Run button is clicked', async () => {
    const handleSearch = vi.fn();
    renderWithProviders(
      <PQLSearchBar workspaceId="ws-1" onSearch={handleSearch} initialQuery='type = "bug"' />
    );

    const runBtn = screen.getByRole('button', { name: /run/i });
    fireEvent.click(runBtn);

    expect(handleSearch).toHaveBeenCalledWith('type = "bug"');
  });

  it('clears query when Clear button is clicked', async () => {
    const handleClear = vi.fn();
    const handleSearch = vi.fn();
    renderWithProviders(
      <PQLSearchBar
        workspaceId="ws-1"
        onSearch={handleSearch}
        onClear={handleClear}
        initialQuery='status = "done"'
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear pql query/i });
    fireEvent.click(clearBtn);

    expect(handleClear).toHaveBeenCalled();
    expect(handleSearch).toHaveBeenCalledWith('');
  });
});
