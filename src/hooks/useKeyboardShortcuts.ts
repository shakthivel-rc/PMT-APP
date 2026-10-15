import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import {
  setCommandPaletteOpen,
  setQuickCreateOpen,
  setShortcutsCheatsheetOpen,
  toggleChatDrawer,
  toggleFocusMode,
  toggleSidebar,
  toggleTree,
} from '@/features/ui/uiSlice';

export function useKeyboardShortcuts() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const pendingChord = useRef<string | null>(null);
  const chordTimeout = useRef<number | null>(null);

  useEffect(() => {
    const clearChord = () => {
      pendingChord.current = null;
      if (chordTimeout.current) {
        clearTimeout(chordTimeout.current);
        chordTimeout.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      // If user is actively typing in a form field, do not hijack normal typing keys
      if (isInput) {
        return;
      }

      // If modifier keys like Ctrl or Cmd or Alt are pressed, let browser or specific hotkeys handle it
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Check if we are waiting for the second key of a chord (e.g. 'G' then key)
      if (pendingChord.current === 'g') {
        clearChord();
        const key = e.key.toLowerCase();
        if (key === 'd') {
          e.preventDefault();
          navigate('/dashboard');
          return;
        }
        if (key === 'p') {
          e.preventDefault();
          navigate('/projects');
          return;
        }
        if (key === 't') {
          e.preventDefault();
          navigate('/timesheet');
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          navigate('/reports');
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          navigate('/activity');
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          dispatch(toggleChatDrawer());
          return;
        }
      }

      // Shift+F for focus mode
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        dispatch(toggleFocusMode());
        return;
      }

      // Question mark '?' (Shift + /) for shortcuts cheatsheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        dispatch(setShortcutsCheatsheetOpen(true));
        return;
      }

      // Forward slash '/' for search / command palette
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        dispatch(setCommandPaletteOpen(true));
        return;
      }

      // 'c' or 'C' for quick create issue
      if ((e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault();
        dispatch(setQuickCreateOpen(true));
        return;
      }

      // Left bracket '[' for sidebar
      if (e.key === '[') {
        e.preventDefault();
        dispatch(toggleSidebar());
        return;
      }

      // Right bracket ']' or backslash '\' for space tree
      if (e.key === ']' || e.key === '\\') {
        e.preventDefault();
        dispatch(toggleTree());
        return;
      }

      // Start 'g' chord
      if ((e.key === 'g' || e.key === 'G') && !e.shiftKey) {
        pendingChord.current = 'g';
        if (chordTimeout.current) clearTimeout(chordTimeout.current);
        chordTimeout.current = window.setTimeout(() => {
          pendingChord.current = null;
        }, 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearChord();
    };
  }, [dispatch, navigate]);
}
