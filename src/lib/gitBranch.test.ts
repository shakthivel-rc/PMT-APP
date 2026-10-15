import { describe, expect, it } from 'vitest';
import { generateBranchName, generateGitCheckoutCommand } from './gitBranch';

describe('gitBranch utils', () => {
  it('generates bugfix branch for bug type', () => {
    const branch = generateBranchName('CP-101', 'Fix login session timeout', 'bug');
    expect(branch).toBe('bugfix/cp-101-fix-login-session-timeout');

    const cmd = generateGitCheckoutCommand('CP-101', 'Fix login session timeout', 'bug');
    expect(cmd).toBe('git checkout -b bugfix/cp-101-fix-login-session-timeout');
  });

  it('generates feature branch for story or epic', () => {
    const branch = generateBranchName('PAY-42', 'Integrate Stripe Webhooks', 'story');
    expect(branch).toBe('feature/pay-42-integrate-stripe-webhooks');
  });

  it('generates task branch for task type', () => {
    const branch = generateBranchName('DEV-5', 'Upgrade Docker containers to Node 24', 'task');
    expect(branch).toBe('task/dev-5-upgrade-docker-containers-to-node-2');
  });

  it('cleans special characters and trims slugs properly', () => {
    const branch = generateBranchName('CORE-1', '  [Refactor]: Clean up API routes & auth!  ', 'task');
    expect(branch).toBe('task/core-1-refactor-clean-up-api-routes-auth');
  });
});
