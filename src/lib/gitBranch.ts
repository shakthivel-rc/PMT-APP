/**
 * Generates standard git branch name and checkout command from an issue key, title, and type.
 * Follows industry best practices (Linear, GitHub, GitLab):
 * - bug -> bugfix/KEY-123-slug
 * - story, epic -> feature/KEY-123-slug
 * - task -> task/KEY-123-slug
 */

export function generateBranchName(key: string, title: string, type: string = 'task'): string {
  const cleanKey = key.trim().toLowerCase();
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 35)
    .replace(/^-+|-+$/g, '');

  let prefix = 'feature';
  const t = type.toLowerCase();
  if (t === 'bug') {
    prefix = 'bugfix';
  } else if (t === 'task') {
    prefix = 'task';
  } else if (t === 'story' || t === 'epic') {
    prefix = 'feature';
  }

  return slug ? `${prefix}/${cleanKey}-${slug}` : `${prefix}/${cleanKey}`;
}

export function generateGitCheckoutCommand(key: string, title: string, type: string = 'task'): string {
  const branchName = generateBranchName(key, title, type);
  return `git checkout -b ${branchName}`;
}
