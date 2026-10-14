import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  isPasswordStrong,
  passwordStrength,
} from '@/lib/passwordRules';

// This policy mirrors the backend `validate_password_policy`; the two test suites
// (here + pmt-api/tests/unit/test_password.py) must agree rule-for-rule.
describe('PASSWORD_RULES', () => {
  it('declares the seven documented rules with the backend-matching limits', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_BYTES).toBe(72);
    expect(PASSWORD_RULES).toHaveLength(7);
    expect(PASSWORD_RULES.map((r) => r.label)).toEqual([
      'At least 12 characters',
      'An uppercase letter',
      'A lowercase letter',
      'A number',
      'A symbol',
      'No spaces',
      'At most 72 bytes',
    ]);
  });

  it('each rule passes/fails the expected input', () => {
    const [len, upper, lower, digit, symbol, noSpace, maxBytes] = PASSWORD_RULES;
    expect(len.test('a'.repeat(12))).toBe(true);
    expect(len.test('a'.repeat(11))).toBe(false);
    expect(upper.test('A')).toBe(true);
    expect(upper.test('a')).toBe(false);
    expect(lower.test('a')).toBe(true);
    expect(lower.test('A')).toBe(false);
    expect(digit.test('7')).toBe(true);
    expect(digit.test('x')).toBe(false);
    expect(symbol.test('!')).toBe(true);
    expect(symbol.test('abc')).toBe(false);
    expect(noSpace.test('abc')).toBe(true);
    expect(noSpace.test('a b')).toBe(false);
    expect(noSpace.test('')).toBe(false); // empty is not "no spaces"
    expect(maxBytes.test('a'.repeat(72))).toBe(true);
    expect(maxBytes.test('a'.repeat(73))).toBe(false);
    expect(maxBytes.test('')).toBe(false);
  });

  it('classifies characters the way the API does, not by the ASCII table', () => {
    // Python's str.isupper()/isalnum() are Unicode-aware; an accented letter is a letter.
    const [len, upper, lower, , symbol, , maxBytes] = PASSWORD_RULES;
    expect(upper.test('É')).toBe(true);
    expect(lower.test('é')).toBe(true);
    expect(symbol.test('é')).toBe(false); // the bug: this used to count as a symbol
    // Length is code points, like Python's len(); the byte cap is UTF-8, like bcrypt.
    expect(len.test('😀'.repeat(12))).toBe(true);
    expect(len.test('😀'.repeat(11))).toBe(false);
    expect(maxBytes.test('é'.repeat(36))).toBe(true); // 72 bytes
    expect(maxBytes.test('é'.repeat(37))).toBe(false); // 74 bytes, 37 characters
  });
});

describe('isPasswordStrong', () => {
  it('accepts a password that satisfies every rule', () => {
    expect(isPasswordStrong('Abcdef123!@#')).toBe(true);
  });

  it('rejects when any single rule fails', () => {
    expect(isPasswordStrong('abcdef123!@#')).toBe(false); // no uppercase
    expect(isPasswordStrong('ABCDEF123!@#')).toBe(false); // no lowercase
    expect(isPasswordStrong('Abcdefghi!@#')).toBe(false); // no digit
    expect(isPasswordStrong('Abcdef123456')).toBe(false); // no symbol
    expect(isPasswordStrong('Abc1!')).toBe(false); // too short
    expect(isPasswordStrong('Abcdef 123!@')).toBe(false); // contains whitespace
    expect(isPasswordStrong('Abcdefghijk1é')).toBe(false); // é is a letter, so no symbol
    expect(isPasswordStrong(`Abcdef123!@#${'x'.repeat(61)}`)).toBe(false); // 73 bytes
  });
});

describe('passwordStrength', () => {
  it('scores an empty password as zero / Very weak', () => {
    expect(passwordStrength('')).toEqual({
      passedCount: 0,
      total: 7,
      percent: 0,
      label: 'Very weak',
      tone: 'danger',
    });
  });

  it('maps passed-rule counts to the documented label/tone thresholds', () => {
    // 3 rules (lower + no-space + byte cap) → Very weak
    expect(passwordStrength('abc')).toMatchObject({ passedCount: 3, label: 'Very weak', tone: 'danger' });
    // 4 rules (upper + lower + no-space + byte cap) → Fair
    expect(passwordStrength('abcABC')).toMatchObject({ passedCount: 4, label: 'Fair', tone: 'warning' });
    // 5 rules (upper + lower + digit + no-space + byte cap) → Fair
    expect(passwordStrength('abcABC12')).toMatchObject({ passedCount: 5, label: 'Fair', tone: 'warning' });
    // 6 rules (fails only length) → Good
    expect(passwordStrength('Abc1!x')).toMatchObject({ passedCount: 6, label: 'Good', tone: 'info' });
    // all 7 → Strong
    expect(passwordStrength('Abcdef123!@#')).toMatchObject({ passedCount: 7, label: 'Strong', tone: 'success' });
  });

  it('computes percent as round(passed/total*100)', () => {
    expect(passwordStrength('abcABC').percent).toBe(57); // 4/7 → 57.14 → 57
    expect(passwordStrength('Abc1!x').percent).toBe(86); // 6/7 → 85.71 → 86
    expect(passwordStrength('Abcdef123!@#').percent).toBe(100);
  });
});
