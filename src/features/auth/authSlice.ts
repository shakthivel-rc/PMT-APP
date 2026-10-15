
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthTokens } from '../../types/index';
import { addNotification } from '../ui/uiSlice';
import { api, ApiError, setTokens, clearTokens, getAccessToken } from '../../api/client';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  forgotPasswordStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  resetPasswordStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  registerStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  verifyOTPStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  setPasswordRegStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  acceptInviteStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  authMessage: string | null;
  initializing: boolean;
}

const initialState: AuthState = {
  user: null,
  tokens: null,
  status: 'idle',
  error: null,
  forgotPasswordStatus: 'idle',
  resetPasswordStatus: 'idle',
  registerStatus: 'idle',
  verifyOTPStatus: 'idle',
  setPasswordRegStatus: 'idle',
  acceptInviteStatus: 'idle',
  authMessage: null,
  initializing: true,
};

// Check for existing token on app load and fetch user profile
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async () => {
    const token = getAccessToken();
    if (!token) {
      return null;
    }
    try {
      const profileRes = await api.get<any>('/users/profile');
      return profileRes.data as User;
    } catch {
      clearTokens();
      return null;
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      // Backend expects { username, password } where username is email
      const loginRes = await api.post<{ access_token: string; refresh_token: string }>(
        '/user/login',
        { username: email, password }
      );

      const tokens: AuthTokens = {
        access_token: loginRes.data.access_token,
        refresh_token: loginRes.data.refresh_token,
      };

      // Store tokens so subsequent requests use them
      setTokens(tokens.access_token, tokens.refresh_token);

      // Fetch user profile
      const profileRes = await api.get<any>('/users/profile');
      const user = profileRes.data as User;

      return { user, tokens };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Invalid email or password');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (
    data: { email: string; first_name: string; last_name: string; username: string; organization?: string; department?: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post<any>('/user/register', data);
      dispatch(addNotification({ type: 'success', message: res.message || 'OTP sent to your email.' }));
      return res.message;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Registration failed');
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ email, otp }: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      const res = await api.post<any>('/user/verify-otp', { email, otp });
      return res.message;
    } catch (error: any) {
      return rejectWithValue(error.message || 'OTP verification failed');
    }
  }
);

export const resendOTP = createAsyncThunk(
  'auth/resendOTP',
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post<any>('/user/resend-otp', { email });
      dispatch(addNotification({ type: 'info', message: res.message || 'New OTP sent.' }));
      return res.message;
    } catch (error: any) {
      dispatch(addNotification({ type: 'error', message: error.message || 'Failed to resend OTP' }));
      return rejectWithValue(error.message || 'Failed to resend OTP');
    }
  }
);

export const setPasswordAfterRegistration = createAsyncThunk(
  'auth/setPasswordAfterRegistration',
  async (
    data: { email: string; otp: string; new_password: string; confirm_password: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post<any>('/user/set-password-registration', data);
      dispatch(addNotification({ type: 'success', message: res.message || 'Account created successfully!' }));
      return res.message;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to set password');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async () => {
    try {
      await api.post('/user/logout');
    } catch {
      // Even if backend logout fails, clear local state
    }
    clearTokens();
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: { first_name: string; last_name: string; organization?: string; department?: string }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const userId = state.auth.user?.id;
      if (!userId) throw new Error('No user logged in');

      await api.put(`/users/${userId}`, data);

      // Re-fetch profile to get updated data
      const profileRes = await api.get<any>('/users/profile');
      dispatch(addNotification({ type: 'success', message: 'Profile updated successfully' }));
      return profileRes.data as User;
    } catch (error: any) {
      dispatch(addNotification({ type: 'error', message: 'Failed to update profile' }));
      return rejectWithValue(error.message);
    }
  }
);

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post<any>('/user/forgot-password', { email });
      dispatch(addNotification({ type: 'info', message: 'Reset instructions sent' }));
      return res.message || 'If an account exists for this email, you will receive password reset instructions.';
    } catch (error: any) {
      dispatch(addNotification({ type: 'error', message: 'Failed to process request' }));
      return rejectWithValue(error.message);
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (
    data: { current_password: string; new_password: string; confirm_password: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post<any>('/users/change-password', data);
      dispatch(addNotification({ type: 'success', message: res.message || 'Password changed successfully' }));
      return res.message;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to change password');
    }
  }
);

/**
 * What to tell someone whose emailed-link submission the API refused.
 *
 * - **404** is a token that matches no account: the link was already used (both endpoints
 *   clear the token on success) or never valid. The API's own text for it is "User doesn't
 *   exists with this token", which reads as "your account is gone" to someone who has just
 *   activated it and pressed Back.
 * - **`data.errors`** is where the password-policy refusal puts the actual reasons ("must
 *   include at least one special character"); `message` is only their heading. Keeping the
 *   heading alone told the person their password was wrong without saying how.
 * - Anything else — an expired link, a mismatch — has a `message` written to be shown.
 */
function linkRefusal(error: unknown, spent: string, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return spent;
    const reasons = (error.data as { errors?: unknown } | null)?.errors;
    if (Array.isArray(reasons)) {
      const text = reasons.filter((r): r is string => typeof r === 'string');
      if (text.length) return text.join(' ');
    }
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async ({ password, token }: { password: string; token: string }, { dispatch, rejectWithValue }) => {
    try {
      // The token in the body, never the URL: a URL is copied into every access log and
      // proxy log it passes through (the API's SEC-4).
      const res = await api.post<unknown>('/user/reset-password', {
        token,
        new_password: password,
        confirm_password: password,
      });
      dispatch(addNotification({ type: 'success', message: 'Password reset successfully. Please login.' }));
      return res.message || 'Password has been successfully reset.';
    } catch (error) {
      dispatch(addNotification({ type: 'error', message: 'Failed to reset password' }));
      return rejectWithValue(
        linkRefusal(
          error,
          'This reset link has already been used or is no longer valid. Request a new one from the sign-in page.',
          'Failed to reset password'
        )
      );
    }
  }
);

/**
 * Accept an administrator's invite. The invite email opens `/verify-account?token=…`
 * (`utils/token.py:app_link` in the API), and the token goes back unchanged in the JSON
 * body — not the URL, for the same reason as the reset. `POST /user/set-password` both sets
 * the password and activates the account, so there is no separate "verify" step to call.
 */
export const acceptInvite = createAsyncThunk(
  'auth/acceptInvite',
  async ({ password, token }: { password: string; token: string }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post<unknown>('/user/set-password', {
        token,
        new_password: password,
        confirm_password: password,
      });
      dispatch(addNotification({ type: 'success', message: 'Account activated. Please sign in.' }));
      return res.message || 'Your account is ready.';
    } catch (error) {
      return rejectWithValue(
        linkRefusal(
          error,
          'This invitation link has already been used or is no longer valid. If you have already set your password, sign in.',
          'Failed to activate account'
        )
      );
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthMessages: (state) => {
      state.forgotPasswordStatus = 'idle';
      state.resetPasswordStatus = 'idle';
      state.registerStatus = 'idle';
      state.verifyOTPStatus = 'idle';
      state.setPasswordRegStatus = 'idle';
      state.acceptInviteStatus = 'idle';
      state.authMessage = null;
      state.error = null;
    },
    // Local-only sign-out for an expired/invalid session (no API call — the token
    // is already dead). Tokens are cleared in the API client; this resets Redux so
    // the route guards send the user to /login without a full page reload.
    sessionExpired: (state) => {
      state.user = null;
      state.tokens = null;
      state.status = 'idle';
      state.error = null;
      state.initializing = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Auth
      .addCase(initializeAuth.pending, (state) => {
        state.initializing = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.initializing = false;
        if (action.payload) {
          state.user = action.payload;
          state.status = 'succeeded';
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.initializing = false;
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.tokens = null;
        state.status = 'idle';
        state.error = null;
        state.forgotPasswordStatus = 'idle';
        state.resetPasswordStatus = 'idle';
        state.verifyOTPStatus = 'idle';
        state.setPasswordRegStatus = 'idle';
        state.acceptInviteStatus = 'idle';
        state.authMessage = null;
        state.initializing = false;
      })
      // Update Profile
      .addCase(updateUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string | undefined) || action.error.message || 'Failed to update profile';
      })
      // Request Password Reset
      .addCase(requestPasswordReset.pending, (state) => {
        state.forgotPasswordStatus = 'loading';
        state.authMessage = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.forgotPasswordStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.forgotPasswordStatus = 'failed';
        state.error = (action.payload as string | undefined) || action.error.message || 'Something went wrong';
      })
      // Confirm Password Reset
      .addCase(confirmPasswordReset.pending, (state) => {
        state.resetPasswordStatus = 'loading';
        state.authMessage = null;
        state.error = null;
      })
      // A result that lands after the person left the screen — `clearAuthMessages` has already
      // put the status back to 'idle' — is dropped. Written into the shared `error`, it would
      // surface on whichever auth screen they went to instead ("token expired" on sign-in).
      .addCase(confirmPasswordReset.fulfilled, (state, action) => {
        if (state.resetPasswordStatus !== 'loading') return;
        state.resetPasswordStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        if (state.resetPasswordStatus !== 'loading') return;
        state.resetPasswordStatus = 'failed';
        // The thunk rejects *with a value*, so `action.error.message` is RTK's generic
        // "Rejected" and the server's reason — "The verification token is expired" — is in
        // the payload. Reading the wrong one left the screen saying "try again" to someone
        // whose link could never work again.
        state.error = (action.payload as string | undefined) || 'Failed to reset password';
      })
      // Accept Invite
      .addCase(acceptInvite.pending, (state) => {
        state.acceptInviteStatus = 'loading';
        state.authMessage = null;
        state.error = null;
      })
      .addCase(acceptInvite.fulfilled, (state, action) => {
        if (state.acceptInviteStatus !== 'loading') return;
        state.acceptInviteStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(acceptInvite.rejected, (state, action) => {
        if (state.acceptInviteStatus !== 'loading') return;
        state.acceptInviteStatus = 'failed';
        state.error = (action.payload as string | undefined) || 'Failed to activate account';
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.registerStatus = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.registerStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.registerStatus = 'failed';
        state.error = action.payload as string;
      })
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.verifyOTPStatus = 'loading';
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.verifyOTPStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.verifyOTPStatus = 'failed';
        state.error = action.payload as string;
      })
      // Set Password After Registration
      .addCase(setPasswordAfterRegistration.pending, (state) => {
        state.setPasswordRegStatus = 'loading';
        state.error = null;
      })
      .addCase(setPasswordAfterRegistration.fulfilled, (state, action) => {
        state.setPasswordRegStatus = 'succeeded';
        state.authMessage = action.payload;
      })
      .addCase(setPasswordAfterRegistration.rejected, (state, action) => {
        state.setPasswordRegStatus = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { clearAuthMessages, sessionExpired } = authSlice.actions;

export default authSlice.reducer;
