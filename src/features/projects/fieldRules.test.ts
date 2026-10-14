import { describe, expect, it } from 'vitest';
import { slugProblem, spaceKeyProblem } from './fieldRules';

/**
 * The client copies of the API's key and slug rules. Pinned: they accept exactly what the API
 * accepts, each refusal says how to fix it, and only a refusal that more typing could fix is
 * marked incomplete (so it waits for the field to be left).
 */

describe('spaceKeyProblem', () => {
  it.each(['PAY', 'OPS2', 'AB', 'ABCDEFGHIJ'])('accepts %s', (key) => {
    expect(spaceKeyProblem(key)).toBeNull();
  });

  it('leaves an empty field to `required`', () => {
    expect(spaceKeyProblem('')).toBeNull();
  });

  it.each([
    ['PAY-1', 'Leave out the number: enter PAY, and issues become PAY-1, PAY-2 and so on.', false],
    ['PAY-', 'Leave out the number: enter PAY, and issues become PAY-1, PAY-2 and so on.', false],
    ['PA Y', 'Use only the letters A–Z and digits 0–9.', false],
    ['ÉQUIPE', 'Use only the letters A–Z and digits 0–9.', false],
    ['1PAY', 'Start with a letter.', false],
    ['P', 'Use at least 2 characters.', true],
    ['ABCDEFGHIJK', 'Use at most 10 characters.', false],
  ])('refuses %s: %s', (key, message, incomplete) => {
    expect(spaceKeyProblem(key)).toEqual({ message, incomplete });
  });
});

describe('slugProblem', () => {
  it.each(['acme', 'acme-eng', 'a1', '42'])('accepts %s', (slug) => {
    expect(slugProblem(slug)).toBeNull();
  });

  it.each([
    ['acme_eng', 'Use only lower-case letters a–z, digits and hyphens.', false],
    ['Acme', 'Use only lower-case letters a–z, digits and hyphens.', false],
    ['a', 'Use at least 2 characters.', true],
    ['-acme', 'Start with a letter or digit, not a hyphen.', false],
    ['acme-', 'End with a letter or digit, not a hyphen.', true],
  ])('refuses %s: %s', (slug, message, incomplete) => {
    expect(slugProblem(slug)).toEqual({ message, incomplete });
  });
});
