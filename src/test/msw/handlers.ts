import { http, HttpResponse } from 'msw';
import {
  makeAIJob,
  makeBoard,
  makeComment,
  makeIssueDetail,
  makeIssueTime,
  makeReportCatalog,
  makeReportResult,
  makeTimeEntry,
  makeTimeReport,
  makeTimeSettings,
  makeTree,
  makeUser,
  makeWorkspace,
} from '../fixtures';

// Every endpoint is registered with a leading `*/` wildcard so the handler matches
// regardless of the resolved BASE_URL (`/api`, an absolute host, whatever `.env` bakes in).
const ok = (data: unknown, message = 'success') =>
  HttpResponse.json({ status: 'success', status_code: 200, message, data });

// The project routes answer 201 on create and 202 on the AI request, and the envelope's
// `status_code` repeats the HTTP one.
const created = (data: unknown, status = 201) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'created', data }, { status });

/** The tenancy refusal: not a member and does not exist are the same answer. */
export const notFound = () =>
  HttpResponse.json(
    { status: 'error', status_code: 404, message: 'Workspace not found.', data: null },
    { status: 404 },
  );

export const handlers = [
  // --- auth ---
  http.post('*/user/login', () =>
    ok({ access_token: 'test-access-token', refresh_token: 'test-refresh-token' })
  ),
  http.post('*/user/refresh', () =>
    ok({ access_token: 'test-access-token-2', refresh_token: 'test-refresh-token-2' })
  ),
  http.post('*/user/logout', () => ok({})),
  http.post('*/user/register', () => ok({}, 'OTP sent to your email.')),
  http.post('*/user/verify-otp', () => ok({}, 'OTP verified.')),
  http.post('*/user/resend-otp', () => ok({}, 'New OTP sent.')),
  http.post('*/user/set-password-registration', () =>
    ok({}, 'Account created successfully!')
  ),
  http.post('*/user/forgot-password', () => ok({}, 'Reset instructions sent.')),
  http.post('*/user/reset-password', () => ok({}, 'Password has been successfully reset.')),
  http.post('*/user/set-password', () => ok({}, 'Password set successfully')),

  // --- profile / users ---
  // `GET /users/profile` returns the frontend `User` shape directly (no mapping layer).
  http.get('*/users/profile', () => ok(makeUser())),
  http.get('*/users', () => ok({ records: [] })),

  // --- activity ---
  http.get('*/activity-logs', () => ok({ records: [] })),

  // --- projects ---
  // Served from the fixture world in ../fixtures.ts: workspace `w1` only, so any other id
  // gets the same 404 a non-member does.
  http.get('*/workspaces', () => ok([makeWorkspace()])),
  http.post('*/workspaces', async ({ request }) =>
    created(makeWorkspace({ id: 'w-new', ...((await request.json()) as object) })),
  ),
  http.get('*/workspaces/:workspaceId', ({ params }) =>
    params.workspaceId === 'w1' ? ok(makeTree()) : notFound(),
  ),
  http.get('*/workspaces/:workspaceId/board', () => ok(makeBoard())),
  http.post('*/workspaces/:workspaceId/issues', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return created(makeIssueDetail({ id: 'i-new', key: 'PAY-99', type: 'task', ...body }));
  }),
  http.get('*/workspaces/:workspaceId/issues/:issueId', () => ok(makeIssueDetail())),
  http.post('*/workspaces/:workspaceId/issues/:issueId/move', async ({ request, params }) => {
    const body = (await request.json()) as { status_id: string };
    return ok({ ...makeIssueDetail({ id: String(params.issueId) }), status_id: body.status_id, rank: 'moved' });
  }),
  http.get('*/workspaces/:workspaceId/issues/:issueId/comments', () => ok([makeComment()])),
  http.post('*/workspaces/:workspaceId/issues/:issueId/comments', async ({ request }) => {
    const body = (await request.json()) as { body: string };
    return created(makeComment({ id: 'c-new', author: { id: 'u1', display_name: 'Ada Lovelace' }, body: body.body }));
  }),
  http.patch('*/workspaces/:workspaceId/issues/:issueId/comments/:commentId', async ({ request, params }) => {
    const body = (await request.json()) as { body: string };
    return ok(makeComment({ id: String(params.commentId), body: body.body }));
  }),
  http.delete('*/workspaces/:workspaceId/issues/:issueId/comments/:commentId', ({ params }) => {
    return ok({ id: String(params.commentId) });
  }),
  http.post('*/workspaces/:workspaceId/issues/:issueId/summary', () => created(makeAIJob(), 202)),
  http.get('*/workspaces/:workspaceId/ai-jobs/:jobId', () =>
    ok(
      makeAIJob({
        status: 'succeeded',
        model: 'test-model',
        result: { tldr: 'Refunds work.', decisions: [], open_questions: [], action_items: [] },
      }),
    ),
  ),

  // --- time tracking ---
  // The header asks for the timer on every authenticated screen; nothing running is the
  // default world, so every existing screen test sees the app as it was before timers.
  http.get('*/timer', () => ok(null)),
  http.post('*/timer/stop', () => ok({ entry: null, capped: false })),
  http.delete('*/timer', () => ok({ discarded: false })),
  http.get('*/workspaces/:workspaceId/issues/:issueId/time-tracking', () => ok(makeIssueTime())),
  http.post('*/workspaces/:workspaceId/issues/:issueId/time-entries', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return created(makeTimeEntry({ id: 't-new', ...body }));
  }),
  http.patch('*/workspaces/:workspaceId/time-entries/:entryId', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok(makeTimeEntry({ id: String(params.entryId), ...body }));
  }),
  http.delete('*/workspaces/:workspaceId/time-entries/:entryId', ({ params }) => ok({ id: params.entryId })),
  http.get('*/workspaces/:workspaceId/time-entries', () => ok({ records: [makeTimeEntry()], total: 1, total_seconds: 5400 })),
  http.get('*/workspaces/:workspaceId/time-report', () => ok(makeTimeReport())),
  http.get('*/workspaces/:workspaceId/settings/time-tracking', () => ok(makeTimeSettings())),
  http.patch('*/workspaces/:workspaceId/settings/time-tracking', async ({ request }) =>
    ok(makeTimeSettings((await request.json()) as object)),
  ),
  // --- reports ---
  http.get('*/workspaces/:workspaceId/reports/catalog', () => ok(makeReportCatalog())),
  http.get('*/workspaces/:workspaceId/reports/:reportType', () => ok(makeReportResult())),
  http.get('*/workspaces/:workspaceId/saved-reports', () => ok([])),
  http.get('*/workspaces/:workspaceId/report-jobs', () => ok([])),
  http.get('*/workspaces/:workspaceId/spaces/:spaceId/sprints', () => ok([])),
  http.patch('*/workspaces/:workspaceId/issues/:issueId', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok(makeIssueDetail({ id: String(params.issueId), ...body, version: Number(body.version || 1) + 1 }));
  }),
  http.get('*/workspaces/:workspaceId/issues/:issueId/fix-versions', () => ok([])),
  http.put('*/workspaces/:workspaceId/issues/:issueId/fix-versions', async ({ request }) => {
    const body = (await request.json()) as { release_ids: string[] };
    return ok(body.release_ids.map((id) => ({ id, space_id: 'sp1', name: `v${id}`, state: 'unreleased', release_date: null, released_at: null, start_date: null })));
  }),
  http.get('*/workspaces/:workspaceId/spaces/:spaceId/releases', () => ok([])),
  http.get('*/workspaces/:workspaceId/members', () =>
    ok([
      { user_id: 'u1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', role: 'owner' },
      { user_id: 'u2', email: 'grace@example.com', first_name: 'Grace', last_name: 'Hopper', role: 'member' },
    ]),
  ),
  // --- storage settings & attachments ---
  http.get('*/workspaces/:workspaceId/settings/storage', () =>
    ok({
      provider: 'local',
      aws_access_key_id: '',
      aws_secret_access_key: '',
      aws_bucket_name: '',
      aws_region: 'us-east-1',
      aws_endpoint_url: null,
      azure_account_name: '',
      azure_account_key: '',
      azure_container_name: '',
      fallback_to_local: true,
      is_configured: true,
    }),
  ),
  http.patch('*/workspaces/:workspaceId/settings/storage', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({
      provider: body.provider || 'local',
      aws_access_key_id: body.aws_access_key_id ? 'AKI...PLE' : '',
      aws_secret_access_key: body.aws_secret_access_key ? '******' : '',
      aws_bucket_name: body.aws_bucket_name || '',
      aws_region: body.aws_region || 'us-east-1',
      aws_endpoint_url: body.aws_endpoint_url || null,
      azure_account_name: body.azure_account_name || '',
      azure_account_key: body.azure_account_key ? '******' : '',
      azure_container_name: body.azure_container_name || '',
      fallback_to_local: body.fallback_to_local ?? true,
      is_configured: true,
    });
  }),
  http.post('*/workspaces/:workspaceId/settings/storage/test', async ({ request }) => {
    const body = (await request.json()) as { provider: string };
    return ok({
      success: true,
      message: `Connection to ${body.provider} succeeded.`,
      provider: body.provider,
      details: null,
    });
  }),
  http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () => ok([])),
  http.post('*/workspaces/:workspaceId/issues/:issueId/attachments', async ({ request, params }) => {
    const body = (await request.json()) as { filename?: string; content_type?: string; comment_id?: string };
    const url = new URL(request.url);
    const commentId = body.comment_id || url.searchParams.get('comment_id') || null;
    const filename = body.filename || 'attachment.png';
    const isImage = (body.content_type || '').startsWith('image/') || filename.endsWith('.png');
    return created({
      id: 'att-1',
      workspace_id: String(params.workspaceId),
      issue_id: String(params.issueId),
      comment_id: commentId,
      uploader: { id: 'u1', display_name: 'Ada Lovelace' },
      filename,
      file_size: 1024,
      content_type: body.content_type || 'image/png',
      storage_provider: 'local',
      is_image: isImage,
      created_at: new Date().toISOString(),
      download_url: `/api/workspaces/${params.workspaceId}/issues/${params.issueId}/attachments/att-1/download`,
    });
  }),
  http.delete('*/workspaces/:workspaceId/issues/:issueId/attachments/:attachmentId', () =>
    ok({ deleted: true }),
  ),
  http.get('*/workspaces/:workspaceId/issues/:issueId/attachments/:attachmentId/download', () => {
    return new HttpResponse(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="mock.png"',
      },
    });
  }),
];
