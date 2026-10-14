import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  fetchAttachmentObjectUrl,
  getAttachmentDownloadUrl,
  isImageAttachment,
  isPdfAttachment,
} from '@/api/storage';
import { cn } from '@/lib/utils';
import type { IssueAttachment } from '@/types';

export interface AttachmentThumbnailProps {
  attachment: IssueAttachment;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AttachmentThumbnail = ({
  attachment,
  onClick,
  className,
  size = 'md',
}: AttachmentThumbnailProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const isImage = isImageAttachment(attachment);
  const isPdf = isPdfAttachment(attachment);

  const sizeClasses = {
    sm: 'size-12',
    md: 'size-14',
    lg: 'size-20',
  }[size];

  useEffect(() => {
    if (!isImage) return;

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setFailed(false);

    fetchAttachmentObjectUrl(attachment.download_url)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!active) return;
        // Fallback to direct URL with query token
        const fallback = getAttachmentDownloadUrl(attachment.download_url, true);
        setBlobUrl(fallback);
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
  }, [attachment.id, attachment.download_url, isImage]);

  const content = (() => {
    if (isImage) {
      if (loading) {
        return (
          <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        );
      }
      if (failed || !blobUrl) {
        return (
          <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
        );
      }
      return (
        <img
          src={blobUrl}
          alt={attachment.filename}
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      );
    }

    if (isPdf) {
      return (
        <div className="flex size-full flex-col items-center justify-center bg-danger-subtle/40 text-danger transition-colors group-hover:bg-danger-subtle/70">
          <FileText className="size-5" />
          <span className="mt-0.5 text-[9px] font-bold tracking-tight uppercase">PDF</span>
        </div>
      );
    }

    const ext = attachment.filename.split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <div className="flex size-full flex-col items-center justify-center bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted">
        <FileText className="size-5" />
        <span className="mt-0.5 max-w-[40px] truncate text-[9px] font-semibold uppercase">
          {ext.slice(0, 4)}
        </span>
      </div>
    );
  })();

  const wrapperClass = cn(
    'relative shrink-0 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all',
    sizeClasses,
    onClick && 'cursor-pointer hover:border-primary/50 hover:shadow-2xs',
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={wrapperClass}
        title={`Preview ${attachment.filename}`}
        aria-label={`Preview ${attachment.filename}`}
      >
        {content}
      </button>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
};
