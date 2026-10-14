import { describe, it, expect } from 'vitest';
import { BRAND_NAME, NAV_ITEMS, titleForAuthPath, titleForPath } from '@/config/nav';

describe('NAV_ITEMS', () => {
  it('has the eight routes with unique paths and only "/" marked end', () => {
    // The order is the sidebar's order. `/` is User Management and the landing screen; it
    // keeps its path wherever it sits in this list — moving the route would break every
    // bookmark; moving the entry only moves the link.
    expect(NAV_ITEMS.map((i) => i.to)).toEqual(['/', '/projects', '/timesheet', '/reports', '/chat', '/rbac', '/activity', '/profile']);
    // Only the root needs `end`: without it every path would prefix-match `/` and the
    // User Management item would look active on every screen.
    expect(NAV_ITEMS.filter((i) => i.end).map((i) => i.to)).toEqual(['/']);
  });

  it('has no duplicate paths, which would make the header title ambiguous', () => {
    const paths = NAV_ITEMS.map((i) => i.to);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('titleForPath', () => {
  it('returns the exact-match title for a known route', () => {
    expect(titleForPath('/')).toBe('User Management');
    expect(titleForPath('/rbac')).toBe('Roles & Permissions');
    expect(titleForPath('/activity')).toBe('Activity Log');
    expect(titleForPath('/profile')).toBe('My Profile'); // label≠title on this one
    expect(titleForPath('/timesheet')).toBe('Timesheet');
    expect(titleForPath('/chat')).toBe('AI Assistant');
  });

  it('resolves nested paths via longest prefix (excluding root)', () => {
    expect(titleForPath('/activity/123')).toBe('Activity Log');
    expect(titleForPath('/rbac/roles/42')).toBe('Roles & Permissions');
    expect(titleForPath('/projects/w1/lists/l1')).toBe('Projects');
    expect(titleForPath('/reports/timesheet')).toBe('Reports');
  });

  it('falls back to the brand name for unknown paths', () => {
    expect(titleForPath('/nope')).toBe(BRAND_NAME);
    expect(titleForPath('/settings/x')).toBe('PMT');
  });
});

describe('titleForAuthPath', () => {
  it('titles both emailed-link screens, so the tab does not read as the bare brand', () => {
    expect(titleForAuthPath('/reset-password')).toBe('Choose a new password');
    expect(titleForAuthPath('/verify-account')).toBe('Activate your account');
    expect(titleForAuthPath('/nope')).toBe(BRAND_NAME);
  });
});
