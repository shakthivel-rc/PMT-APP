import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import FormMessage from '@/components/FormMessage';
import { isPasswordStrong } from '@/lib/passwordRules';

interface NewPasswordFormProps {
  submitLabel: string;
  loading: boolean;
  /** Why the server refused the last submission, e.g. "The verification token is expired". */
  serverError?: string | null;
  /** Called only with a password that meets the policy and matches its confirmation. */
  onSubmit: (password: string) => void;
}

/**
 * The choose-a-password form behind both emailed links — the password reset and the admin
 * invite. One component rather than a copy per screen, because the rules it enforces
 * (`lib/passwordRules`, mirroring the API's policy) must be identical wherever a password is
 * chosen, and two copies of a validation rule drift the first time someone edits one.
 *
 * It owns only what is local: the two fields, the strength meter, the match hint and the
 * client-side refusal. What happens on submit — which endpoint, which token — belongs to the
 * screen, so the same form serves both flows unchanged.
 */
const NewPasswordForm = ({ submitLabel, loading, serverError, onSubmit }: NewPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordStrong(password)) {
      setError('Password does not meet all strength requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    onSubmit(password);
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  // A fresh local refusal is about what is on screen now; a server refusal is about the
  // last attempt. Showing both would put two answers to one question side by side.
  const message = error || serverError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
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
        {passwordsMismatch && <p className="text-xs text-danger">Passwords do not match</p>}
        {passwordsMatch && <p className="text-xs text-success">Passwords match</p>}
      </div>

      {message && <FormMessage variant="error">{message}</FormMessage>}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {submitLabel}
      </Button>
    </form>
  );
};

export default NewPasswordForm;
