/**
 * Parses markdown checklists in issue descriptions or completion criteria:
 * `- [ ]`, `- [x]`, `* [ ]`, `* [x]`
 */

export interface ChecklistProgress {
  total: number;
  completed: number;
  percent: number;
}

export function parseChecklist(text: string | null | undefined): ChecklistProgress | null {
  if (!text) return null;
  const matches = text.match(/^\s*[-*]\s+\[([ xX])\]/gm);
  if (!matches || matches.length === 0) return null;

  const total = matches.length;
  const completed = matches.filter((m) => /\[[xX]\]/.test(m)).length;
  const percent = Math.round((completed / total) * 100);

  return { total, completed, percent };
}
