import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { verifyOTP, resendOTP } from '../authSlice';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import FormMessage from '@/components/FormMessage';

interface OTPVerificationProps {
  email: string;
  onVerified: (email: string, otp: string) => void;
  onLogin: () => void;
}

const OTP_LENGTH = 6;

const OTPVerification: React.FC<OTPVerificationProps> = ({ email, onVerified, onLogin }) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dispatch = useAppDispatch();
  const { verifyOTPStatus, error } = useAppSelector((state) => state.auth);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Navigate on success
  useEffect(() => {
    if (verifyOTPStatus === 'succeeded') {
      const otp = digits.join('');
      onVerified(email, otp);
    }
  }, [verifyOTPStatus]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted) {
      const newDigits = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      // Focus last filled input or the next empty one
      const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) return;
    dispatch(verifyOTP({ email, otp }));
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setResendMessage('');
    dispatch(resendOTP(email)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setResendMessage('New OTP sent to your email.');
        setCooldown(60);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    });
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  const isComplete = digits.every(d => d !== '');
  const loading = verifyOTPStatus === 'loading';

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>
          We&apos;ve sent a 6-digit code to <span className="font-medium text-foreground">{maskedEmail}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            role="group"
            aria-label="Enter the 6-digit verification code"
            onPaste={handlePaste}
            className="flex justify-center gap-2"
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                aria-label={`Digit ${i + 1} of 6`}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                className="h-14 w-12 rounded-md border border-input bg-transparent text-center text-xl font-semibold shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              />
            ))}
          </div>

          {error && <FormMessage variant="error">{error}</FormMessage>}
          {resendMessage && <FormMessage variant="success">{resendMessage}</FormMessage>}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isComplete || loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Verify OTP
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the code?{' '}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 align-baseline"
            onClick={handleResend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
          </Button>
        </p>
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

export default OTPVerification;
