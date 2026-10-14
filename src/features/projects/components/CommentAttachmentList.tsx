import { useState } from 'react';
import {
  Copy,
  Download,
  Eye,
  FileText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAttachmentDownloadUrl, isPdfAttachment } from '@/api/storage';
import { Badge } from '@/components/ui/badge';
import type { IssueAttachment } from '@/types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { formatBytes } from './IssueAttachments';

export interface CommentAttachmentListProps {
  attachments: IssueAttachment[];
  canDelete?: boolean;
  onDelete?: (attachmentId: string) => Promise<void> | void;
}

export const CommentAttachmentList = ({
  attachments,
  canDelete = false,
  onDelete,
}: CommentAttachmentListProps) => {
  const [previewAttachment, setPreviewAttachment] = useState<IssueAttachment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((a) => a.is_image);
  const files = attachments.filter((a) => !a.is_image);

  const handleCopyMarkdown = (att: IssueAttachment) => {
    const text = att.is_image
      ? `![${att.filename}](${att.download_url})`
      : `[${att.filename}](${att.download_url})`;
    void navigator.clipboard.writeText(text);
    toast.success(`Copied Markdown link for ${att.filename}`);
  };

  const handleDelete = async (att: IssueAttachment) => {
    if (!onDelete) return;
    setDeletingId(att.id);
    try {
      await onDelete(att.id);
      toast.success(`Removed attachment ${att.filename}`);
    } catch {
      toast.error(`Failed to delete ${att.filename}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-2.5 space-y-2" data-testid="comment-attachments-list">
      {/* Attached Images Gallery */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => {
            const downloadHref = getAttachmentDownloadUrl(img.download_url, true);
            return (
              <div
                key={img.id}
                className="group relative flex flex-col items-center overflow-hidden rounded-md border bg-card p-1 shadow-2xs transition-all hover:border-primary/50"
              >
                <AttachmentThumbnail
                  attachment={img}
                  onClick={() => setPreviewAttachment(img)}
                  size="md"
                />

                <div className="flex w-full items-center justify-between gap-1 px-0.5 pt-1 text-[10px] text-muted-foreground">
                  <span className="max-w-[70px] truncate" title={img.filename}>
                    {img.filename}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAttachment(img);
                      }}
                      className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                      title="Preview image"
                      aria-label="Preview image"
                    >
                      <Eye className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMarkdown(img);
                      }}
                      className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                      title="Copy Markdown Link"
                      aria-label="Copy Markdown Link"
                    >
                      <Copy className="size-3" />
                    </button>
                    <a
                      href={downloadHref}
                      download={img.filename}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                      title="Download image"
                      aria-label="Download image"
                    >
                      <Download className="size-3" />
                    </a>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        disabled={deletingId === img.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(img);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-danger-subtle hover:text-danger disabled:opacity-50"
                        title="Delete attachment"
                        aria-label={`Delete ${img.filename}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Attached Non-Image Files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => {
            const isPdf = isPdfAttachment(file);
            const downloadHref = getAttachmentDownloadUrl(file.download_url, true);
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => setPreviewAttachment(file)}
                  title={`Preview ${file.filename}`}
                >
                  {isPdf ? (
                    <span className="flex items-center gap-1 text-danger font-bold text-[10px] bg-danger-subtle/40 px-1 py-0.5 rounded">
                      <FileText className="size-3.5" /> PDF
                    </span>
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>

                <div className="flex min-w-0 max-w-[180px] flex-col">
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    className="truncate font-medium text-foreground hover:text-primary transition-colors text-left focus-visible:outline-none focus-visible:underline"
                    title={`Preview ${file.filename}`}
                  >
                    {file.filename}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {formatBytes(file.file_size)}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="shrink-0 px-1 py-0 text-[9px] uppercase"
                  title={`Stored on ${file.storage_provider}`}
                >
                  {file.storage_provider === 'aws_s3'
                    ? 'S3'
                    : file.storage_provider === 'azure_blob'
                    ? 'Azure'
                    : 'Local'}
                </Badge>

                <div className="flex items-center gap-0.5 pl-1 border-l">
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={`Preview ${file.filename}`}
                    aria-label={`Preview ${file.filename}`}
                  >
                    <Eye className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyMarkdown(file)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Copy Markdown Link"
                    aria-label="Copy Markdown Link"
                  >
                    <Copy className="size-3" />
                  </button>
                  <a
                    href={downloadHref}
                    download={file.filename}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={`Download ${file.filename}`}
                    aria-label={`Download ${file.filename}`}
                  >
                    <Download className="size-3" />
                  </a>
                  {canDelete && onDelete && (
                    <button
                      type="button"
                      disabled={deletingId === file.id}
                      onClick={() => void handleDelete(file)}
                      className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger disabled:opacity-50"
                      title={`Delete ${file.filename}`}
                      aria-label={`Delete ${file.filename}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Preview Lightbox & Document Viewer Modal */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        open={previewAttachment !== null}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      />
    </div>
  );
};
