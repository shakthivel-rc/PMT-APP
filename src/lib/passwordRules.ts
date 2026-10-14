/**
 * Single source of password policy — mirrors the backend's `validate_password_policy`
 * (min length 12, upper, lower, digit, symbol, NO whitespace, at most 72 bytes).
 * Consumed by the strength meter and every client-side validator so the UI
 * never green-lights a password the API will reject.
 *
 * The character classes are Unicode, like Python's `str.isupper()`/`isalnum()` on the API
 * side. They were ASCII (`[A-Z]`, `[^A-Za-z0-9\s]`) until 2026-09-29, which counted an
 * accented letter as a *symbol*: `Abcdefghijk1é` went green here and the API refused it
 * for having no special character. The 72-byte cap is bcrypt's (see the API's
 * `utils/password.py`) and was missing here entirely, so a long passphrase went green and
 * was refused on submit. Bytes, not characters, because that is what bcrypt reads.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

const utf8Length = (p: string) => new TextEncoder().encode(p).length;

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  // Code points, like Python's `len()`: `p.length` counts UTF-16 units, so an emoji is two.
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => [...p].length >= PASSWORD_MIN_LENGTH },
  { label: 'An uppercase letter', test: (p) => /\p{Lu}/u.test(p) },
  { label: 'A lowercase letter', test: (p) => /\p{Ll}/u.test(p) },
  { label: 'A number', test: (p) => /\p{Nd}/u.test(p) },
  { label: 'A symbol', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
  { label: 'No spaces', test: (p) => p.length > 0 && !/\s/.test(p) },
  {
    label: `At most ${PASSWORD_MAX_BYTES} bytes`,
    test: (p) => p.length > 0 && utf8Length(p) <= PASSWORD_MAX_BYTES,
  },
];

export function isPasswordStrong(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

export type StrengthTone = 'danger' | 'warning' | 'info' | 'success';

export interface PasswordStrength {
  passedCount: number;
  total: number;
  percent: number;
  label: string;
  tone: StrengthTone;
}

export function passwordStrength(pw: string): PasswordStrength {
  const total = PASSWORD_RULES.length;
  const passedCount = pw.length === 0 ? 0 : PASSWORD_RULES.filter((r) => r.test(pw)).length;
  const percent = Math.round((passedCount / total) * 100);

  let label = 'Very weak';
  let tone: StrengthTone = 'danger';
  if (passedCount === total) {
    label = 'Strong';
    tone = 'success';
  } else if (passedCount >= total - 1) {
    label = 'Good';
    tone = 'info';
  } else if (passedCount >= total - 3) {
    label = 'Fair';
    tone = 'warning';
  }

  return { passedCount, total, percent, label, tone };
}
