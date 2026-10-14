import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { setPasswordAfterRegistration } from '../authSlice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import FormMessage from '@/components/FormMessage';
import { isPasswordStrong } from '@/lib/passwordRules';

interface SetPasswordRegistrationProps {
  email: string;
  otp: string;
  onLogin: () => void;
}

const SetPasswordRegistration: React.FC<SetPasswordRegistrationProps> = ({ email, otp, onLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [localError, setLocalError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const dispatch = useAppDispatch();
  const { setPasswordRegStatus, error, authMessage } = useAppSelector((state) => state.auth);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!isPasswordStrong(password)) {
      setLocalError('Password does not meet all strength requirements');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    if (!agreedToTerms) {
      setLocalError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    dispatch(setPasswordAfterRegistration({
      email,
      otp,
      new_password: password,
      confirm_password: confirmPassword,
    }));
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (setPasswordRegStatus === 'succeeded') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Account created!</CardTitle>
          <CardDescription>
            {authMessage || 'Your account has been created successfully. You can now sign in.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" onClick={onLogin}>
            Go to login
          </Button>
        </CardContent>
      </Card>
    );
  }

  const loading = setPasswordRegStatus === 'loading';

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Set your password</CardTitle>
        <CardDescription>Create a strong password to secure your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <PasswordInput
              id="new-password"
              name="password"
              autoComplete="new-password"
              required
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={passwordsMismatch || undefined}
            />
            {passwordsMismatch && (
              <p className="text-xs text-danger">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-success">Passwords match</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <input
              id="agreeTerms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => { setAgreedToTerms(e.target.checked); setLocalError(''); }}
              className="mt-0.5 size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="agreeTerms" className="font-normal leading-snug text-muted-foreground">
              I agree to the{' '}
              <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </a>
            </Label>
          </div>

          {(error || localError) && (
            <FormMessage variant="error">{localError || error}</FormMessage>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-muted-foreground"
          onClick={onLogin}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SetPasswordRegistration;
