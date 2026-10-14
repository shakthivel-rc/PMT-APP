import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class values and skips falsy ones', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('lets later Tailwind utilities win conflicts (twMerge)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm text-muted-foreground', 'text-foreground')).toBe('text-sm text-foreground');
  });

  it('supports conditional object + array syntax (clsx)', () => {
    expect(cn(['a', { b: true, c: false }])).toBe('a b');
  });
});
