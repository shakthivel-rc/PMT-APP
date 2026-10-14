import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeAIJob, makeIssueDetail, STATUSES } from '@/test/fixtures';
import type { AIJobSummary } from '@/types';
import IssueDrawer from './IssueDrawer';

// The real polling loop, against MSW, with the interval shortened: the behaviour under test
// is "polls until terminal", not "waits 1.5 s", and a real interval would make every summary
// test cost seconds.
vi.mock('@/api/issues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/issues')>();
  return {
    ...actual,
    waitForAIJobApi: (...[workspaceId, jobId, options]: Parameters<typeof actual.waitForAIJobApi>) =>
      actual.waitForAIJobApi(workspaceId, jobId, { ...options, intervalMs: 5 }),
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * The issue drawer: detail, thread, and the AI summary.
 *
 * Two properties matter beyond "it renders". Everything a person wrote — and the summary
 * built from it — is text, never markup. And the summary is a job to be polled, which stops
 * when the job ends and says in plain words when AI is switched off.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const onOpenIssue = vi.fn();

const render = (canWrite = true) =>
  renderWithProviders(
    <IssueDrawer
      workspaceId="w1"
      issueId="i1"
      statuses={STATUSES}
      canWrite={canWrite}
      onOpenIssue={onOpenIssue}
      onClose={vi.fn()}
    />,
  );

const drawer = async () => {
  await screen.findByRole('heading', { name: 'Refund to original card' });
  return screen.getByRole('dialog', { name: 'Refund to original card' });
};

describe('<IssueDrawer> detail', () => {
  it('shows the issue, its children and its linked pull requests', async () => {
    render();
    const panel = await drawer();

    expect(within(panel).getByText('PAY-1')).toBeInTheDocument();
    expect(within(panel).getByText('Story · To Do')).toBeInTheDocument();
    const field = (term: string) => within(panel).getByText(term, { selector: 'dt' }).nextElementSibling;
    expect(field('Status')).toHaveTextContent('To Do');
    expect(field('Assignee')).toHaveTextContent('Ada Lovelace');
    expect(field('Story points')).toHaveTextContent('5');
    expect(field('Priority')).toHaveTextContent('High');

    const pr = within(panel).getByRole('link', { name: /Refund to original card/ });
    expect(pr).toHaveAttribute('href', 'https://github.com/acme/payments/pull/42');
    expect(pr).toHaveAttribute('target', '_blank');
    expect(pr).toHaveAttribute('rel', 'noopener noreferrer');

    await userEvent.click(within(panel).getByRole('button', { name: /PAY-9/ }));
    expect(onOpenIssue).toHaveBeenCalledWith('i9');
  });

  it('renders the description as text, whitespace kept, markup inert', async () => {
    const hostile = '<img src=x onerror="alert(1)">\n  indented line';
    server.use(http.get('*/workspaces/w1/issues/i1', () => ok(makeIssueDetail({ description: hostile }))));
    render();
    const panel = await drawer();

    const description = within(panel).getByText((_, el) => el?.tagName === 'P' && el.textContent === hostile);
    expect(description).toHaveClass('whitespace-pre-wrap');
    expect(panel.querySelector('img')).toBeNull();
  });

  it('never turns a non-web URL into a link', async () => {
    server.use(
      http.get('*/workspaces/w1/issues/i1', () =>
        ok(makeIssueDetail({ links: [{ ...makeIssueDetail().links[0], url: 'javascript:alert(1)', title: 'Sneaky' }] })),
      ),
    );
    render();
    const panel = await drawer();

    expect(within(panel).getByText('Sneaky')).toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: /Sneaky/ })).toBeNull();
  });

  it('says the issue is not found on a 404, without claiming to know why', async () => {
    server.use(
      http.get('*/workspaces/w1/issues/i1', () =>
        HttpResponse.json({ status: 'error', status_code: 404, message: 'Not found.', data: null }, { status: 404 }),
      ),
    );
    render();
    expect(await screen.findByRole('dialog', { name: 'Issue unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This issue does not exist, or you cannot see it.');
  });
});

describe('<IssueDrawer> comments', () => {
  it('loads the thread and posts to it', async () => {
    let posted: unknown;
    server.use(
      http.post('*/workspaces/w1/issues/i1/comments', async ({ request }) => {
        posted = await request.json();
        return ok(
          { id: 'c2', author: { id: 'u1', display_name: 'Ada Lovelace' }, body: 'Fixed in #42', created_at: '2026-09-28T11:00:00Z' },
          201,
        );
      }),
    );
    render();
    const panel = await drawer();

    expect(within(panel).getByText('Reproduced on staging.')).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Comments (1)' })).toBeInTheDocument();

    await userEvent.type(within(panel).getByLabelText('Add a comment'), 'Fixed in #42');
    await userEvent.click(within(panel).getByRole('button', { name: 'Comment' }));

    expect(await within(panel).findByText('Fixed in #42')).toBeInTheDocument();
    expect(posted).toEqual({ body: 'Fixed in #42' });
    expect(within(panel).getByRole('heading', { name: 'Comments (2)' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Add a comment')).toHaveValue('');
  });

  it('offers a guest the thread but no form', async () => {
    render(false);
    const panel = await drawer();
    expect(within(panel).getByText('Reproduced on staging.')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Add a comment')).toBeNull();
  });
});

describe('<IssueDrawer> thread summary', () => {
  /** Answers each poll with the next job in `jobs`, repeating the last one. */
  function pollSequence(jobs: Partial<AIJobSummary>[]) {
    let polls = 0;
    server.use(
      http.post('*/workspaces/w1/issues/i1/summary', () => ok(makeAIJob(), 202)),
      http.get('*/workspaces/w1/ai-jobs/job1', () => {
        const job = jobs[Math.min(polls, jobs.length - 1)];
        polls += 1;
        return ok(makeAIJob(job));
      }),
    );
    return () => polls;
  }

  const summary = {
    tldr: 'Refunds go back to the original card.',
    decisions: ['Use the processor refund API'],
    open_questions: ['What about expired cards?'],
    action_items: [
      { owner: 'Ada', text: 'Wire the endpoint' },
      { owner: null, text: 'Write the runbook' },
    ],
  };

  it('polls the job to success and renders each section as text', async () => {
    const polls = pollSequence([
      { status: 'running' },
      { status: 'succeeded', result: summary, model: 'claude-test', finished_at: '2026-09-28T10:01:00Z' },
    ]);
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Summarize thread' }));

    expect(await within(panel).findByText('Refunds go back to the original card.')).toBeInTheDocument();
    expect(polls()).toBe(2);
    for (const heading of ['TL;DR', 'Decisions', 'Open questions', 'Action items']) {
      expect(within(panel).getByRole('heading', { name: heading, level: 4 })).toBeInTheDocument();
    }
    expect(within(panel).getByText('Use the processor refund API')).toBeInTheDocument();
    expect(within(panel).getByText('What about expired cards?')).toBeInTheDocument();
    expect(within(panel).getByText('Ada:')).toBeInTheDocument();
    expect(within(panel).getByText('Write the runbook')).toBeInTheDocument();
    expect(within(panel).getByText(/AI-generated by claude-test/)).toBeInTheDocument();
    expect(within(panel).queryByText(/Reused/)).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Summarize again' })).toBeEnabled();
  });

  it('notes a reused summary, and does not poll one that came back finished', async () => {
    const polls = pollSequence([]);
    server.use(
      http.post('*/workspaces/w1/issues/i1/summary', () =>
        ok(makeAIJob({ status: 'succeeded', cached: true, result: { ...summary, decisions: [] } }), 202),
      ),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Summarize thread' }));

    expect(await within(panel).findByText(/Reused: the thread has not changed/)).toBeInTheDocument();
    expect(within(panel).getByText('None.')).toBeInTheDocument(); // the empty Decisions list
    expect(polls()).toBe(0);
  });

  it('shows a failed job’s own error', async () => {
    pollSequence([{ status: 'failed', error: 'The model could not be reached. Try again later.' }]);
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Summarize thread' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('The model could not be reached. Try again later.');
  });

  it('shows the 503 message as information when AI is switched off', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/summary', () =>
        HttpResponse.json(
          { status: 'error', status_code: 503, message: 'AI features are turned off on this deployment.', data: null },
          { status: 503 },
        ),
      ),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Summarize thread' }));

    const message = await within(panel).findByText('AI features are turned off on this deployment.');
    // Information, not an error: it is a fact about the deployment, not something that broke.
    expect(message).toHaveAttribute('role', 'status');
    expect(within(panel).queryByRole('alert')).toBeNull();
  });

  it('stops polling when the drawer goes away', async () => {
    const polls = pollSequence([{ status: 'running' }]);
    const { unmount } = render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Summarize thread' }));
    await waitFor(() => expect(polls()).toBeGreaterThan(0));
    unmount();
    const after = polls();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // At most the one request already in flight when it closed.
    expect(polls() - after).toBeLessThanOrEqual(1);
  });
});

describe('<IssueDrawer> dynamic editable fields and versions', () => {
  it('edits the title inline and saves changes via PATCH', async () => {
    let patched: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        patched = await request.json();
        return ok(makeIssueDetail({ title: 'New updated title', version: 2 }));
      }),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Edit title' }));
    const input = within(panel).getByDisplayValue('Refund to original card');
    await userEvent.clear(input);
    await userEvent.type(input, 'New updated title');
    await userEvent.click(within(panel).getByRole('button', { name: 'Save title' }));

    expect(patched).toEqual({ version: 1, title: 'New updated title' });
    expect(await within(panel).findByRole('heading', { name: 'New updated title' })).toBeInTheDocument();
  });

  it('edits story points and saves changes via PATCH', async () => {
    let patched: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        patched = await request.json();
        return ok(makeIssueDetail({ story_points: 8, version: 2 }));
      }),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Edit story points' }));
    const input = within(panel).getByDisplayValue('5');
    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await userEvent.click(within(panel).getByRole('button', { name: 'Save story points' }));

    expect(patched).toEqual({ version: 1, story_points: 8 });
  });

  it('edits description using the rich markdown editor', async () => {
    let patched: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        patched = await request.json();
        return ok(makeIssueDetail({ description: '## Updated Description\n- item 1\n- item 2', version: 2 }));
      }),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Edit description' }));
    const textarea = within(panel).getByLabelText('Issue description');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New rich content');
    await userEvent.click(within(panel).getByRole('button', { name: 'Save description' }));

    expect(patched).toEqual({ version: 1, description: 'New rich content' });
  });

  it('marks an issue as blocked with reason and unblocks it', async () => {
    let patchedBlock: unknown;
    let patchedUnblock: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        const body = await request.json();
        if ((body as { blocked?: boolean }).blocked) {
          patchedBlock = body;
          return ok(makeIssueDetail({ blocked: true, blocked_reason: 'Waiting for vendor API', version: 2 }));
        } else {
          patchedUnblock = body;
          return ok(makeIssueDetail({ blocked: false, blocked_reason: null, version: 3 }));
        }
      }),
    );
    render();
    const panel = await drawer();

    await userEvent.click(within(panel).getByRole('button', { name: 'Mark as blocked' }));
    const reasonInput = within(panel).getByLabelText('Blocker reason (required)');
    await userEvent.type(reasonInput, 'Waiting for vendor API');
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirm block' }));

    expect(patchedBlock).toEqual({ version: 1, blocked: true, blocked_reason: 'Waiting for vendor API' });
    expect(await within(panel).findByText('This issue is blocked')).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'Unblock issue' }));
    expect(patchedUnblock).toEqual({ version: 2, blocked: false, blocked_reason: null });
  });

  it('displays fix versions and links a new release version', async () => {
    server.use(
      http.get('*/workspaces/w1/issues/i1/fix-versions', () =>
        ok([{ id: 'rel-1', space_id: 'sp1', name: 'v1.0.0', state: 'unreleased', start_date: null, release_date: '2026-12-01', released_at: null }]),
      ),
    );
    render();
    const panel = await drawer();

    expect(await within(panel).findByText('v1.0.0')).toBeInTheDocument();
    expect(within(panel).getByText('Unreleased')).toBeInTheDocument();
  });

  it('allows editing an existing comment with rich markdown editor and saving changes', async () => {
    let patchedComment: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1/comments/c1', async ({ request }) => {
        patchedComment = await request.json();
        return ok({
          id: 'c1',
          author: { id: 'u1', display_name: 'Ada Lovelace' },
          body: 'Updated comment with markdown **bold**',
          created_at: '2026-09-28T10:00:00Z',
        });
      }),
    );
    render();
    const panel = await drawer();

    expect(within(panel).getByText('Reproduced on staging.')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Edit comment' }));

    const editor = within(panel).getByLabelText('Edit comment body');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'Updated comment with markdown **bold**');
    await userEvent.click(within(panel).getByRole('button', { name: 'Save' }));

    expect(patchedComment).toEqual({ body: 'Updated comment with markdown **bold**' });
    expect(await within(panel).findByText('Updated comment with markdown')).toBeInTheDocument();
  });

  it('allows deleting an existing comment after confirmation', async () => {
    let deletedCommentId: string | null = null;
    server.use(
      http.delete('*/workspaces/w1/issues/i1/comments/:commentId', ({ params }) => {
        deletedCommentId = String(params.commentId);
        return ok({ id: deletedCommentId });
      }),
    );
    render();
    const panel = await drawer();

    expect(within(panel).getByText('Reproduced on staging.')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Delete comment' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirm delete comment' }));

    await waitFor(() => {
      expect(within(panel).queryByText('Reproduced on staging.')).toBeNull();
    });
    expect(deletedCommentId).toBe('c1');
  });

  it('allows switching between Side Drawer mode and Full Modal Pop-up mode', async () => {
    render();
    const panel = await drawer();

    // In drawer mode, the button offers to switch to modal
    const modalBtn = within(panel).getByRole('button', { name: 'Open in full modal pop-up mode' });
    expect(modalBtn).toBeInTheDocument();

    await userEvent.click(modalBtn);

    // Now in modal mode, the button offers to switch back to drawer
    const drawerBtn = await screen.findByRole('button', { name: 'Switch to side drawer mode' });
    expect(drawerBtn).toBeInTheDocument();

    const dialogContent = screen.getByTestId('issue-modal-content');
    expect(dialogContent).toHaveClass('translate-x-[-50%]');
    expect(dialogContent).toHaveClass('translate-y-[-50%]');
    expect(dialogContent).toHaveClass('top-[50%]');
    expect(dialogContent).toHaveClass('left-[50%]');
    expect(dialogContent).toHaveClass('max-w-[calc(100%-2rem)]');

    // In modal mode, fullscreen toggle is also available
    const fullscreenBtn = screen.getByRole('button', { name: 'Expand full screen' });
    expect(fullscreenBtn).toBeInTheDocument();

    await userEvent.click(fullscreenBtn);
    const exitBtn = screen.getByRole('button', { name: 'Exit full screen' });
    expect(exitBtn).toBeInTheDocument();

    // Centering coordinates are preserved while fullscreen sizing is applied
    expect(dialogContent).toHaveClass('translate-x-[-50%]');
    expect(dialogContent).toHaveClass('translate-y-[-50%]');
    expect(dialogContent).toHaveClass('top-[50%]');
    expect(dialogContent).toHaveClass('left-[50%]');
    expect(dialogContent).toHaveClass('w-[calc(100vw-1rem)]');
    expect(dialogContent).not.toHaveClass('inset-2');

    // Toggle back to windowed modal
    await userEvent.click(exitBtn);
    expect(screen.getByRole('button', { name: 'Expand full screen' })).toBeInTheDocument();
    expect(dialogContent).toHaveClass('max-w-[calc(100%-2rem)]');
  });
});

