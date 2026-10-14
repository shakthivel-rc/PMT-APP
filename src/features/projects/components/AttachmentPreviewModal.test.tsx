import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { IssueAttachment } from '@/types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockImage: IssueAttachment = {
  id: 'att-img',
  workspace_id: 'ws-1',
  issue_id: 'iss-1',
  uploader: { id: 'u1', display_name: 'Margaret Hamilton' },
  filename: 'apollo_guidance.png',
  file_size: 4096,
  content_type: 'image/png',
  storage_provider: 'local',
  is_image: true,
  created_at: '2026-10-08T10:00:00Z',
  download_url: '/api/workspaces/ws-1/issues/iss-1/attachments/att-img/download',
};

const mockPdf: IssueAttachment = {
  id: 'att-pdf',
  workspace_id: 'ws-1',
  issue_id: 'iss-1',
  uploader: { id: 'u2', display_name: 'Katherine Johnson' },
  filename: 'flight_trajectory.pdf',
  file_size: 1048576,
  content_type: 'application/pdf',
  storage_provider: 'aws_s3',
  is_image: false,
  created_at: '2026-10-08T10:30:00Z',
  download_url: '/api/workspaces/ws-1/issues/iss-1/attachments/att-pdf/download',
};

describe('<AttachmentPreviewModal>', () => {
  it('renders nothing when closed or attachment is null', () => {
    const { container } = render(
      <AttachmentPreviewModal attachment={null} open={false} onOpenChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image lightbox with zoom controls and image tag', async () => {
    render(
      <AttachmentPreviewModal attachment={mockImage} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'apollo_guidance.png' })).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('4 KB')).toBeInTheDocument();

    // Zoom buttons
    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom Out' });
    const zoomResetBtn = screen.getByRole('button', { name: 'Reset Zoom' });

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(zoomResetBtn).toHaveTextContent('100%');

    fireEvent.click(zoomInBtn);
    expect(zoomResetBtn).toHaveTextContent('125%');

    fireEvent.click(zoomOutBtn);
    expect(zoomResetBtn).toHaveTextContent('100%');

    // Download button
    const dlBtn = screen.getByRole('link', { name: /Download/i });
    expect(dlBtn).toHaveAttribute('download', 'apollo_guidance.png');
  });

  it('renders PDF viewer iframe for PDF documents', async () => {
    render(
      <AttachmentPreviewModal attachment={mockPdf} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'flight_trajectory.pdf' })).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();

    await waitFor(() => {
      const iframe = screen.getByTitle('PDF Preview: flight_trajectory.pdf');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });
  });

  it('copies markdown link when copy link button is clicked', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    render(
      <AttachmentPreviewModal attachment={mockPdf} open={true} onOpenChange={vi.fn()} />,
    );

    const copyBtn = screen.getByRole('button', { name: /Copy Link/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(
      `[flight_trajectory.pdf](${mockPdf.download_url})`,
    );
  });
});
