import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import type { RootState } from '@/app/store';
import { renderWithProviders, waitFor } from '@/test/renderWithProviders';
import ToastBridge from '@/components/ToastBridge';

// sonner owns the visible toast lifecycle; we only assert the bridge forwards + drains.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const withNotifications = (notifications: RootState['ui']['notifications']): Partial<RootState> =>
  ({ ui: { theme: 'dark', notifications } }) as Partial<RootState>;

beforeEach(() => vi.clearAllMocks());

describe('<ToastBridge>', () => {
  it('forwards a queued success notification to sonner and drains it from the store', async () => {
    const { store } = renderWithProviders(<ToastBridge />, {
      preloadedState: withNotifications([{ id: 'n1', type: 'success', message: 'Saved!' }]),
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith('Saved!', expect.objectContaining({ id: 'n1' }));
    // drained from the Redux queue
    expect(store.getState().ui.notifications).toHaveLength(0);
  });

  it('routes each notification type to the matching sonner method', async () => {
    renderWithProviders(<ToastBridge />, {
      preloadedState: withNotifications([{ id: 'e1', type: 'error', message: 'Boom' }]),
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Boom', expect.objectContaining({ id: 'e1' })));
  });
});
