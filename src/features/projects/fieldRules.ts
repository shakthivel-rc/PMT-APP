import { useState } from 'react';

/**
 * The API's format rules for a space key and a workspace slug, each explaining a refusal in
 * words that say how to fix it. An HTML `pattern` can only say "Please match the requested
 * format", which does not help someone who typed the issue key `PAY-1` where the prefix `PAY`
 * was wanted. The API still validates both; these checks save a round trip and name the fix.
 */

export interface FieldProblem {
  message: string;
  /** Typing more could still fix it (too short, a trailing hyphen), so wait until the field is left. */
  incomplete: boolean;
}

/** `SpaceCreate.key`, the same as `SPACE_KEY_PATTERN` in `utils/issue_keys.py`. */
export const SPACE_KEY = /^[A-Z][A-Z0-9]{1,9}$/;

/** `WorkspaceCreate.slug`. */
export const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Why `key` cannot be a space's key prefix, or null if it can (or is still empty). */
export const spaceKeyProblem = (key: string): FieldProblem | null => {
  if (key === '' || SPACE_KEY.test(key)) return null;
  // The likely mistake: a whole issue key. Name the prefix that was meant.
  const whole = /^([A-Z][A-Z0-9]{1,9})-[0-9]*$/.exec(key);
  if (whole) {
    const prefix = whole[1];
    return {
      message: `Leave out the number: enter ${prefix}, and issues become ${prefix}-1, ${prefix}-2 and so on.`,
      incomplete: false,
    };
  }
  if (/[^A-Z0-9]/.test(key)) return { message: 'Use only the letters A–Z and digits 0–9.', incomplete: false };
  if (!/^[A-Z]/.test(key)) return { message: 'Start with a letter.', incomplete: false };
  if (key.length < 2) return { message: 'Use at least 2 characters.', incomplete: true };
  return { message: 'Use at most 10 characters.', incomplete: false };
};

/** Why `slug` cannot be a workspace slug, or null if it can (or is still empty). */
export const slugProblem = (slug: string): FieldProblem | null => {
  if (slug === '' || SLUG.test(slug)) return null;
  if (/[^a-z0-9-]/.test(slug)) {
    return { message: 'Use only lower-case letters a–z, digits and hyphens.', incomplete: false };
  }
  if (slug.length < 2) return { message: 'Use at least 2 characters.', incomplete: true };
  if (slug.startsWith('-')) return { message: 'Start with a letter or digit, not a hyphen.', incomplete: false };
  return { message: 'End with a letter or digit, not a hyphen.', incomplete: true };
};

/**
 * When to show a field's problem. A problem that more typing cannot fix is shown at once; an
 * incomplete one waits until the field is left or a submit is tried, so `P` is not called too
 * short while `PAY` is still being typed.
 */
export const useFieldProblem = (problem: FieldProblem | null) => {
  const [revealed, setRevealed] = useState(false);
  const shown = problem && (revealed || !problem.incomplete) ? problem.message : null;
  const reveal = () => setRevealed(true);
  return { shown, reveal };
};
