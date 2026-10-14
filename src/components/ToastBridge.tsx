import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { removeNotification } from '@/features/ui/uiSlice';

/**
 * Bridges the Redux `ui.notifications` queue to sonner toasts.
 *
 * Every existing `dispatch(addNotification(...))` call site keeps working — this
 * component watches the queue, renders each new entry through sonner (which owns the
 * animation, stacking, reduced-motion and dismissal), then drains it from the store.
 */
const ToastBridge = () => {
  const notifications = useAppSelector((state) => state.ui.notifications);
  const dispatch = useAppDispatch();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const n of notifications) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);

      const fn =
        n.type === 'success'
          ? toast.success
          : n.type === 'error'
            ? toast.error
            : n.type === 'warning'
              ? toast.warning
              : toast.info;

      fn(n.message, {
        id: n.id,
        // Errors stay until dismissed; everything else auto-closes.
        duration: n.type === 'error' ? Infinity : 5000,
        onDismiss: () => dispatch(removeNotification(n.id)),
        onAutoClose: () => dispatch(removeNotification(n.id)),
      });

      // Drain from the store immediately; sonner now owns the visible lifecycle.
      dispatch(removeNotification(n.id));
    }
  }, [notifications, dispatch]);

  return null;
};

export default ToastBridge;
