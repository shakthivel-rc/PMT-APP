import type { ReactElement, ReactNode } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { render, type RenderOptions } from '@testing-library/react';

import authReducer from '@/features/auth/authSlice';
import usersReducer from '@/features/users/usersSlice';
import uiReducer from '@/features/ui/uiSlice';
import timerReducer from '@/features/time/timerSlice';
import type { RootState } from '@/app/store';

/** Build a store from the same 4 reducers as src/app/store.ts, with optional preloaded state. */
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      auth: authReducer,
      users: usersReducer,
      ui: uiReducer,
      timer: timerReducer,
    },
    preloadedState: preloadedState as RootState | undefined,
  });
}

export type TestStore = ReturnType<typeof makeStore>;

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: TestStore;
  /** Convenience for a single initial route. */
  route?: string;
  /** Full control over MemoryRouter history. */
  initialEntries?: string[];
}

/**
 * Render a component inside the real provider stack: Redux + MemoryRouter +
 * MotionConfig (reducedMotion:"always" so animations settle instantly). Returns
 * the created `store` alongside RTL's result.
 */
export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const {
    preloadedState,
    store = makeStore(preloadedState),
    route = '/',
    initialEntries = [route],
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          <MotionConfig reducedMotion="always">{children}</MotionConfig>
        </MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Re-export the Testing Library surface so tests import everything from one place.
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
