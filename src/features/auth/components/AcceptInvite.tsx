import React from 'react';
import { ArrowLeft, CheckCircle2, UserCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { acceptInvite } from '../authSlice';
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

interface AcceptInviteProps {
  onLogin: () => void;
  /** From the invite email's `/verify-account?token=…` (the API's `utils/token.py:app_link`). */
  token: string | null;
}

/**
 * Where an administrator's invite lands. The account already exists — `POST /users` created
 * it inactive and emailed this link — so the one thing left is for its owner to choose a
 * password, which also activates it. Self-registration is a different flow (OTP, then
 * `/set-password`) and does not come through here.
 */
const AcceptInvite: React.FC<AcceptInviteProps> = ({ onLogin, token }) => {
  const dispatch = useAppDispatch();
  const { acceptInviteStatus, authMessage, error } = useAppSelector((state) => state.auth);

  if (!token) {
    return (
      <IncompleteLink title="This invitation link is incomplete" onLogin={onLogin}>
        Open the link from your invitation email again. If it still does not work, contact
        your administrator.
      </IncompleteLink>
    );
  }

  if (acceptInviteStatus === 'succeeded') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Account activated</CardTitle>
          <CardDescription>{authMessage || 'Your account is ready.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" onClick={onLogin}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserCheck className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Activate your account</CardTitle>
        <CardDescription>Choose a password to finish setting up your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm
          submitLabel="Activate account"
          loading={acceptInviteStatus === 'loading'}
          serverError={acceptInviteStatus === 'failed' ? error : null}
          onSubmit={(password) => dispatch(acceptInvite({ password, token }))}
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

export default AcceptInvite;
