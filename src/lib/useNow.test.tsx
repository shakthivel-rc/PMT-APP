import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { nowSeconds, useNowSeconds } from '@/lib/useNow';

const Clock = ({ label }: { label: string }) => <span data-testid={label}>{useNowSeconds()}</span>;

afterEach(() => {
  vi.useRealTimers();
});

describe('useNowSeconds', () => {
  it('ticks every subscriber off one interval, and stops it when the last one leaves', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(
      <>
        <Clock label="a" />
        <Clock label="b" />
      </>,
    );
    const start = nowSeconds();
    expect(screen.getByTestId('a').textContent).toBe(String(start));
    expect(setSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('a').textContent).toBe(String(start + 3));
    expect(screen.getByTestId('b').textContent).toBe(String(start + 3));

    unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
