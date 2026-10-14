import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { registerUser } from '../authSlice';
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

interface RegisterProps {
  onLogin: () => void;
  onRegistered: (email: string) => void;
}

const Register: React.FC<RegisterProps> = ({ onLogin, onRegistered }) => {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    organization: '',
    department: '',
  });
  const dispatch = useAppDispatch();
  const { registerStatus, error } = useAppSelector((state) => state.auth);
  const [localError, setLocalError] = useState('');
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  // Navigate to OTP screen when registration succeeds
  useEffect(() => {
    if (registerStatus === 'succeeded') {
      onRegistered(form.email);
    }
  }, [registerStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setLocalError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    dispatch(registerUser(form));
  };

  const loading = registerStatus === 'loading';

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription>Sign up to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                required
                placeholder="John"
                value={form.first_name}
                onChange={handleChange}
                ref={firstNameRef}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                required
                placeholder="Doe"
                value={form.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                name="organization"
                type="text"
                autoComplete="organization"
                placeholder="Optional"
                value={form.organization}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                name="department"
                type="text"
                autoComplete="off"
                placeholder="Optional"
                value={form.department}
                onChange={handleChange}
              />
            </div>
          </div>

          {(error || localError) && (
            <FormMessage variant="error">{localError || error}</FormMessage>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Continue
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 align-baseline"
            onClick={onLogin}
          >
            Sign in
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
};

export default Register;
