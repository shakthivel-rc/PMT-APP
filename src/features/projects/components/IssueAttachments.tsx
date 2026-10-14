import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Eye,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteIssueAttachment,
  getAttachmentDownloadUrl,
  listIssueAttachments,
  uploadIssueAttachment,
} from '@/api/storage';
import { Badge } from '@/components/ui/badge';
import type { IssueAttachment } from '@/types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentThumbnail } from './AttachmentThumbnail';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface IssueAttachmentsProps {
  workspaceId: string;
  issueId: string;
  canWrite: boolean;
}

export const IssueAttachments = ({ workspaceId, issueId, canWrite }: IssueAttachmentsProps) => {
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<IssueAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listIssueAttachments(workspaceId, issueId)
      .then((data) => {
        if (!active) return;
        setAttachments(data);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load attachments:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId, issueId]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const created = await uploadIssueAttachment(workspaceId, issueId, file);
        setAttachments((prev) => [...prev, created]);
        toast.success(`Uploaded ${file.name}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canWrite) return;
    try {
      await deleteIssueAttachment(workspaceId, issueId, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Deleted ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete attachment';
      toast.error(msg);
    }
  };

  const handleCopyMarkdown = (att: IssueAttachment) => {
    const text = att.is_image
      ? `![${att.filename}](${att.download_url})`
      : `[${att.filename}](${att.download_url})`;
    void navigator.clipboard.writeText(text);
    toast.success(`Copied Markdown link for ${att.filename}`);
  };

  return (
    <div className="space-y-3" data-testid="issue-attachments">
      {/* Upload Zone */}
      {canWrite && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleUploadFiles(e.dataTransfer.files);
          }}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragOver
              ? 'border-primary bg-primary/15'
              : 'border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            disabled={uploading}
            onChange={(e) => void handleUploadFiles(e.target.files)}
            className="hidden"
            id="issue-file-upload"
          />

          <div className="flex flex-col items-center gap-1.5">
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Upload className="size-6 text-primary" />
            )}
            <div className="text-xs font-medium text-foreground">
              {uploading ? (
                'Uploading file(s)...'
              ) : (
                <>
                  <label
                    htmlFor="issue-file-upload"
                    className="cursor-pointer text-primary underline-offset-4 hover:underline"
                  >
                    Click to upload
                  </label>{' '}
                  or drag and drop files here
                </>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Images, PDFs, documents, logs, and archives (auto-uploaded to S3/Azure/Local via MCP)
            </div>
          </div>
        </div>
      )}

      {/* Attachments List / Gallery */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {attachments.map((att) => {
            const downloadHref = getAttachmentDownloadUrl(att.download_url, true);
            return (
              <div
                key={att.id}
                className="group relative flex items-start gap-3 rounded-lg border bg-card p-2.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
              >
                {/* Thumbnail or File Icon with click-to-preview */}
                <AttachmentThumbnail
                  attachment={att}
                  onClick={() => setPreviewAttachment(att)}
                  size="sm"
                />

                {/* File Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(att)}
                      className="truncate text-left text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                      title={att.filename}
                    >
                      {att.filename}
                    </button>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] px-1.5 py-0 capitalize"
                      title={`Stored on ${att.storage_provider}`}
                    >
                      {att.storage_provider === 'aws_s3'
                        ? 'S3'
                        : att.storage_provider === 'azure_blob'
                        ? 'Azure'
                        : 'Local'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatBytes(att.file_size)}</span>
                    <span>•</span>
                    <span>{att.uploader.display_name}</span>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(att)}
                      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Preview attachment"
                      aria-label="Preview attachment"
                    >
                      <Eye className="size-3.5" />
                    </button>

                    <a
                      href={downloadHref}
                      download={att.filename}
                      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={`Download ${att.filename}`}
                      aria-label={`Download ${att.filename}`}
                    >
                      <Download className="size-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyMarkdown(att)}
                      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy Markdown Link"
                      aria-label="Copy Markdown Link"
                    >
                      <Copy className="size-3.5" />
                    </button>

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(att.id, att.filename)}
                        className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-danger-subtle hover:text-danger"
                        title={`Delete ${att.filename}`}
                        aria-label={`Delete ${att.filename}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
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
