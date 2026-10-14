import { useEffect, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAttachmentObjectUrl,
  getAttachmentDownloadUrl,
  isImageAttachment,
  isPdfAttachment,
} from '@/api/storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { IssueAttachment } from '@/types';
import { formatBytes } from './IssueAttachments';

export interface AttachmentPreviewModalProps {
  attachment: IssueAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AttachmentPreviewModal = ({
  attachment,
  open,
  onOpenChange,
}: AttachmentPreviewModalProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const isImage = attachment ? isImageAttachment(attachment) : false;
  const isPdf = attachment ? isPdfAttachment(attachment) : false;

  useEffect(() => {
    if (!open || !attachment) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      setZoom(1);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setZoom(1);

    fetchAttachmentObjectUrl(attachment.download_url)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Authenticated blob load failed, falling back to direct URL:', err);
        // Fallback to normalized direct download URL with token
        const fallbackUrl = getAttachmentDownloadUrl(attachment.download_url, true);
        setBlobUrl(fallbackUrl);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl && createdUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [open, attachment]);

  if (!attachment) return null;

  const directUrlWithToken = getAttachmentDownloadUrl(attachment.download_url, true);
  const effectiveViewUrl = blobUrl || directUrlWithToken;

  const handleOpenNewTab = () => {
    window.open(effectiveViewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    const text = isImage
      ? `![${attachment.filename}](${attachment.download_url})`
      : `[${attachment.filename}](${attachment.download_url})`;
    void navigator.clipboard.writeText(text);
    toast.success(`Copied Markdown link for ${attachment.filename}`);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="attachment-preview-modal"
        className="max-w-5xl overflow-hidden p-0 sm:max-h-[90vh]"
      >
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2 min-w-0">
              <DialogTitle className="truncate text-sm font-semibold" title={attachment.filename}>
                {attachment.filename}
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                {isPdf ? 'PDF' : isImage ? 'Image' : 'File'}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatBytes(attachment.file_size)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isImage && (
                <div className="mr-1 flex items-center rounded-md border bg-muted/40 p-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleZoomReset}
                    className="px-1 text-[11px] font-mono"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="size-3.5" />
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-7 text-xs gap-1"
                title="Copy Markdown Link"
              >
                <Copy className="size-3" />
                <span className="hidden sm:inline">Copy Link</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenNewTab}
                className="h-7 text-xs gap-1"
                title="Open in New Tab"
              >
                <ExternalLink className="size-3" />
                <span className="hidden sm:inline">New Tab</span>
              </Button>

              <Button variant="default" size="sm" asChild className="h-7 text-xs gap-1">
                <a
                  href={effectiveViewUrl}
                  download={attachment.filename}
                  title={`Download ${attachment.filename}`}
                >
                  <Download className="size-3" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Content Area */}
        <div className="relative flex min-h-[400px] max-h-[78vh] w-full flex-col items-center justify-center bg-black/5 dark:bg-black/40 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading file preview...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-md">
              <FileText className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">Unable to display preview directly</p>
              <p className="text-xs text-muted-foreground">
                Your browser or system may require opening this file in a new window or downloading it.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" onClick={handleOpenNewTab}>
                  Open in New Tab
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={effectiveViewUrl} download={attachment.filename}>
                    Download
                  </a>
                </Button>
              </div>
            </div>
          ) : isPdf ? (
            <iframe
              src={effectiveViewUrl}
              title={`PDF Preview: ${attachment.filename}`}
              className="size-full min-h-[75vh] w-full border-0 bg-white dark:bg-card"
            />
          ) : isImage ? (
            <div className="flex size-full items-center justify-center p-4 overflow-auto">
              <img
                src={effectiveViewUrl}
                alt={attachment.filename}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
                className="max-h-[72vh] max-w-full rounded object-contain shadow-md transition-transform duration-100 ease-out"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-md">
              <FileText className="size-12 text-muted-foreground" />
              <p className="text-sm font-semibold">{attachment.filename}</p>
              <p className="text-xs text-muted-foreground">
                This document type cannot be rendered inline.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" onClick={handleOpenNewTab}>
                  Open in New Tab
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={effectiveViewUrl} download={attachment.filename}>
                    Download File
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
