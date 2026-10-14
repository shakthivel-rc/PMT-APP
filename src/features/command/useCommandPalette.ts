import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { setCommandPaletteOpen, toggleCommandPalette } from '@/features/ui/uiSlice';

export function useCommandPalette() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        dispatch(toggleCommandPalette());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return {
    open: () => dispatch(setCommandPaletteOpen(true)),
    close: () => dispatch(setCommandPaletteOpen(false)),
    toggle: () => dispatch(toggleCommandPalette()),
  };
}
