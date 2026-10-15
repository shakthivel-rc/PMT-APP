import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutsCheatsheetModal } from './ShortcutsCheatsheetModal';

const mockDispatch = vi.fn();
let mockIsOpen = true;

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: { ui: { shortcutsCheatsheetOpen: boolean } }) => boolean) =>
    selector({ ui: { shortcutsCheatsheetOpen: mockIsOpen } }),
}));

describe('ShortcutsCheatsheetModal', () => {
  it('renders modal content when open', () => {
    mockIsOpen = true;
    render(<ShortcutsCheatsheetModal />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Quick Create Issue (Anywhere)')).toBeInTheDocument();
    expect(screen.getByText('Navigation Chords')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    mockIsOpen = false;
    render(<ShortcutsCheatsheetModal />);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
