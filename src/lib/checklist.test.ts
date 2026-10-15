import { describe, expect, it } from 'vitest';
import { parseChecklist } from './checklist';

describe('checklist parser', () => {
  it('returns null when text is null, undefined, or empty', () => {
    expect(parseChecklist(null)).toBeNull();
    expect(parseChecklist(undefined)).toBeNull();
    expect(parseChecklist('')).toBeNull();
    expect(parseChecklist('Just plain text with no checklists')).toBeNull();
  });

  it('correctly calculates total and completed items', () => {
    const text = `
Here is what we need to do:
- [x] Initial design mockups
- [ ] Implement backend endpoint
- [x] Write integration tests
* [ ] Frontend dropdown UI
`;
    const res = parseChecklist(text);
    expect(res).not.toBeNull();
    expect(res?.total).toBe(4);
    expect(res?.completed).toBe(2);
    expect(res?.percent).toBe(50);
  });

  it('handles 100% completed checklist', () => {
    const text = `
- [X] Step 1
- [x] Step 2
`;
    const res = parseChecklist(text);
    expect(res?.total).toBe(2);
    expect(res?.completed).toBe(2);
    expect(res?.percent).toBe(100);
  });
});
