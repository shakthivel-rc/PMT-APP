import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import type { IssueAttachment } from '@/types';
import { IssueAttachments } from './IssueAttachments';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const mockAttachments: IssueAttachment[] = [
  {
    id: 'att-1',
    workspace_id: 'ws-1',
    issue_id: 'iss-1',
    uploader: { id: 'u1', display_name: 'Ada Lovelace' },
    filename: 'screenshot.png',
    file_size: 2048,
    content_type: 'image/png',
    storage_provider: 'aws_s3',
    is_image: true,
    created_at: '2026-10-07T12:00:00Z',
    download_url: '/api/workspaces/ws-1/issues/iss-1/attachments/att-1/download',
  },
  {
    id: 'att-2',
    workspace_id: 'ws-1',
    issue_id: 'iss-1',
    uploader: { id: 'u2', display_name: 'Grace Hopper' },
    filename: 'architecture.pdf',
    file_size: 1048576,
    content_type: 'application/pdf',
    storage_provider: 'local',
    is_image: false,
    created_at: '2026-10-07T12:30:00Z',
    download_url: '/api/workspaces/ws-1/issues/iss-1/attachments/att-2/download',
  },
];

describe('<IssueAttachments>', () => {
  it('renders attachments list with metadata and image badge', async () => {
    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () =>
        ok(mockAttachments),
      ),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
      expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    });

    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('S3')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('renders upload dropzone when canWrite is true', async () => {
    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () => ok([])),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });
  });

  it('hides upload dropzone and delete buttons when canWrite is false', async () => {
    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () =>
        ok(mockAttachments),
      ),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={false} />,
    );

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    });

    expect(screen.queryByText(/drag and drop files here/i)).toBeNull();
    expect(screen.queryByTitle(/Delete screenshot.png/i)).toBeNull();
  });

  it('allows deleting an attachment', async () => {
    const user = userEvent.setup();
    let deletedId: string | null = null;

    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () =>
        ok(mockAttachments),
      ),
      http.delete(
        '*/workspaces/:workspaceId/issues/:issueId/attachments/:attachmentId',
        ({ params }) => {
          deletedId = String(params.attachmentId);
          return ok({ deleted: true });
        },
      ),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Delete screenshot.png');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(deletedId).toBe('att-1');
    });
  });

  it('opens preview dialog for image attachments with zoom controls', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () =>
        ok(mockAttachments),
      ),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    });

    const previewBtn = screen.getByTitle('Preview screenshot.png');
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-modal')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'screenshot.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom Out' })).toBeInTheDocument();
  });

  it('opens preview dialog for PDF attachments with document viewer', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/workspaces/:workspaceId/issues/:issueId/attachments', () =>
        ok(mockAttachments),
      ),
    );

    renderWithProviders(
      <IssueAttachments workspaceId="ws-1" issueId="iss-1" canWrite={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    });

    const previewBtn = screen.getByTitle('Preview architecture.pdf');
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-modal')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'architecture.pdf' })).toBeInTheDocument();
    expect(screen.getByTitle('PDF Preview: architecture.pdf')).toBeInTheDocument();
  });
});
