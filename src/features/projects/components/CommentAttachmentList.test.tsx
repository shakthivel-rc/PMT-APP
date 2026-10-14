import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommentAttachmentList } from './CommentAttachmentList';
import type { IssueAttachment } from '@/types';

const mockImageAttachment: IssueAttachment = {
  id: 'att-img-1',
  workspace_id: 'ws1',
  issue_id: 'i1',
  comment_id: 'c1',
  uploader: { id: 'u1', display_name: 'Ada Lovelace' },
  filename: 'screenshot.png',
  file_size: 2048,
  content_type: 'image/png',
  storage_provider: 'aws_s3',
  is_image: true,
  created_at: '2026-10-08T12:00:00Z',
  download_url: '/api/workspaces/ws1/issues/i1/attachments/att-img-1/download',
};

const mockFileAttachment: IssueAttachment = {
  id: 'att-doc-1',
  workspace_id: 'ws1',
  issue_id: 'i1',
  comment_id: 'c1',
  uploader: { id: 'u1', display_name: 'Ada Lovelace' },
  filename: 'logs.txt',
  file_size: 1024,
  content_type: 'text/plain',
  storage_provider: 'azure_blob',
  is_image: false,
  created_at: '2026-10-08T12:00:00Z',
  download_url: '/api/workspaces/ws1/issues/i1/attachments/att-doc-1/download',
};

const mockPdfAttachment: IssueAttachment = {
  id: 'att-pdf-1',
  workspace_id: 'ws1',
  issue_id: 'i1',
  comment_id: 'c1',
  uploader: { id: 'u1', display_name: 'Alan Turing' },
  filename: 'spec.pdf',
  file_size: 4096,
  content_type: 'application/pdf',
  storage_provider: 'local',
  is_image: false,
  created_at: '2026-10-08T12:30:00Z',
  download_url: '/api/workspaces/ws1/issues/i1/attachments/att-pdf-1/download',
};

describe('CommentAttachmentList', () => {
  it('renders nothing when attachments array is empty', () => {
    const { container } = render(<CommentAttachmentList attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders image thumbnail and file card with provider badges', () => {
    render(
      <CommentAttachmentList
        attachments={[mockImageAttachment, mockFileAttachment]}
        canDelete={true}
        onDelete={vi.fn()}
      />
    );

    // Image preview button
    expect(screen.getByRole('button', { name: 'Preview screenshot.png' })).toBeInTheDocument();
    // Non-image file title and badge
    expect(screen.getByText('logs.txt')).toBeInTheDocument();
    expect(screen.getByText('Azure')).toBeInTheDocument();
  });

  it('triggers delete callback when delete button is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentAttachmentList
        attachments={[mockFileAttachment]}
        canDelete={true}
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: 'Delete logs.txt' });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('att-doc-1');
  });

  it('opens lightbox dialog when image thumbnail is clicked', () => {
    render(
      <CommentAttachmentList
        attachments={[mockImageAttachment]}
        canDelete={false}
      />
    );

    const previewBtn = screen.getByRole('button', { name: 'Preview screenshot.png' });
    fireEvent.click(previewBtn);

    // Dialog heading
    expect(screen.getByRole('heading', { name: 'screenshot.png' })).toBeInTheDocument();
  });

  it('opens preview dialog for PDF attachments with PDF badge and viewer', () => {
    render(
      <CommentAttachmentList
        attachments={[mockPdfAttachment]}
        canDelete={false}
      />
    );

    // PDF badge is visible
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('spec.pdf')).toBeInTheDocument();

    // Click preview button on the PDF card
    const previewBtn = screen.getByRole('button', { name: 'Preview spec.pdf' });
    fireEvent.click(previewBtn);

    // Dialog header opens with spec.pdf
    expect(screen.getByRole('heading', { name: 'spec.pdf' })).toBeInTheDocument();
  });
});
