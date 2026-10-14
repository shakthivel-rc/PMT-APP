import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { loginUser } from '../authSlice';
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
import PasswordInput from '@/components/PasswordInput';
import FormMessage from '@/components/FormMessage';

const REMEMBER_KEY = 'remembered_email';

interface LoginProps {
  onForgotPassword: () => void;
  onRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onForgotPassword, onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
      // Focus password field when email is pre-filled
      setTimeout(() => passwordRef.current?.focus(), 0);
    } else {
      emailRef.current?.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    dispatch(loginUser({ email, password }));
  };

  const loading = status === 'loading';

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to continue to your dashboard.</CardDescription>
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

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <Label htmlFor="rememberMe" className="font-normal text-muted-foreground">
                Remember me
              </Label>
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={onForgotPassword}
            >
              Forgot password?
            </Button>
          </div>

          {error && <FormMessage variant="error">{error}</FormMessage>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 align-baseline"
            onClick={onRegister}
          >
            Sign up
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
};

export default Login;
