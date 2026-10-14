import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { requestPasswordReset } from '../authSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import FormMessage from '@/components/FormMessage';

interface ForgotPasswordProps {
  onLogin: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const { forgotPasswordStatus, authMessage, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(requestPasswordReset(email));
  };

  if (forgotPasswordStatus === 'succeeded') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            Didn&apos;t receive the email? Check your spam folder or try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormMessage variant="success">
            {authMessage ||
              'If an account exists for this email, you will receive password reset instructions.'}
          </FormMessage>
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
  }

  const loading = forgotPasswordStatus === 'loading';

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-address">Email address</Label>
            <Input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ref={emailRef}
            />
          </div>

          {error && <FormMessage variant="error">{error}</FormMessage>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Send reset link
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

export default ForgotPassword;
