import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/ui/uiSlice', () => ({
  setCommandPaletteOpen: (val: boolean) => ({ type: 'ui/setCommandPaletteOpen', payload: val }),
  setQuickCreateOpen: (val: boolean) => ({ type: 'ui/setQuickCreateOpen', payload: val }),
  setShortcutsCheatsheetOpen: (val: boolean) => ({ type: 'ui/setShortcutsCheatsheetOpen', payload: val }),
  toggleChatDrawer: () => ({ type: 'ui/toggleChatDrawer' }),
  toggleFocusMode: () => ({ type: 'ui/toggleFocusMode' }),
  toggleSidebar: () => ({ type: 'ui/toggleSidebar' }),
  toggleTree: () => ({ type: 'ui/toggleTree' }),
}));

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers quick create when pressing "c"', () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/setQuickCreateOpen', payload: true });
  });

  it('triggers cheatsheet when pressing "?"', () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/setShortcutsCheatsheetOpen', payload: true });
  });

  it('triggers search when pressing "/"', () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/setCommandPaletteOpen', payload: true });
  });

  it('navigates to dashboard on "g" then "d" chord', () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to projects on "g" then "p" chord', () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('ignores keys when typing in input element', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'c' });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    window.dispatchEvent(event);

    expect(mockDispatch).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
