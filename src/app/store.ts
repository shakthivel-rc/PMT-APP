
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import uiReducer from '../features/ui/uiSlice';
import timerReducer from '../features/time/timerSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    ui: uiReducer,
    timer: timerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
