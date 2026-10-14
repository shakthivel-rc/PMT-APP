import React from 'react';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { confirmPasswordReset } from '../authSlice';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import IncompleteLink from './IncompleteLink';
import NewPasswordForm from './NewPasswordForm';

interface ResetPasswordProps {
  onLogin: () => void;
  /** From the reset email's `/reset-password?token=…` (the API's `utils/token.py:app_link`). */
  token: string | null;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onLogin, token }) => {
  const dispatch = useAppDispatch();
  const { resetPasswordStatus, authMessage, error } = useAppSelector((state) => state.auth);

  if (!token) {
    return (
      <IncompleteLink title="This reset link is incomplete" onLogin={onLogin}>
        Open the link from your reset email again, or request a new one from the sign-in page.
      </IncompleteLink>
    );
  }

  if (resetPasswordStatus === 'succeeded') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Password reset</CardTitle>
          <CardDescription>{authMessage || 'Your password has been updated.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" onClick={onLogin}>
            Sign in with new password
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Set new password</CardTitle>
        <CardDescription>Please enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm
          submitLabel="Reset password"
          loading={resetPasswordStatus === 'loading'}
          serverError={resetPasswordStatus === 'failed' ? error : null}
          onSubmit={(password) => dispatch(confirmPasswordReset({ password, token }))}
        />
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

export default ResetPassword;
