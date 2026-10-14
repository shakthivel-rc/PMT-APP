import React, { useRef, useState, type ReactNode } from 'react';
import {
  Bold,
  Code,
  Eye,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  PenLine,
  Quote,
  SquareCode,
  Strikethrough,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAttachmentDownloadUrl } from '@/api/storage';

/** http(s), relative root paths, and blob URLs are allowed; javascript: is forbidden. */
const isSafeUrl = (url: string) =>
  /^(https?:\/\/|\/|blob:)/i.test(url) && !/^\s*javascript:/i.test(url);

/**
 * Safely parses and renders a string of markdown without using dangerouslySetInnerHTML.
 * All HTML tags are escaped and rendered as text nodes by React.
 */
export const SafeMarkdownView = ({
  content,
  className,
}: {
  content: string;
  className?: string;
}) => {
  if (!content || !content.trim()) {
    return <p className="text-sm italic text-muted-foreground">Nothing to preview</p>;
  }

  // Parse lines into block-level elements
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    const ListTag = currentList.type;
    const listClassName = currentList.type === 'ul' ? 'list-disc' : 'list-decimal';
    elements.push(
      <ListTag key={`list-${elements.length}`} className={cn('my-2 pl-5 space-y-1 text-sm', listClassName)}>
        {currentList.items.map((item, idx) => (
          <li key={idx} className="break-words">
            {renderInline(item)}
          </li>
        ))}
      </ListTag>,
    );
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="my-2 overflow-x-auto rounded-md border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>,
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[2]);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // If not a list item, flush current list
    flushList();

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="mt-3 mb-1 text-sm font-semibold tracking-tight text-foreground">
          {renderInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="mt-3.5 mb-1 text-base font-semibold tracking-tight text-foreground">
          {renderInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="mt-4 mb-1.5 text-lg font-bold tracking-tight text-foreground">
          {renderInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-2 border-primary/40 pl-3 italic text-sm text-muted-foreground"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }

    // Empty line creates spacing
    if (!line.trim()) {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm break-words whitespace-pre-wrap leading-relaxed text-foreground">
        {renderInline(line)}
      </p>,
    );
  }

  // Flush remaining blocks
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="my-2 overflow-x-auto rounded-md border bg-muted/60 p-3 font-mono text-xs text-foreground"
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>,
    );
  }
  flushList();

  return <div className={cn('space-y-1', className)}>{elements}</div>;
};

/**
 * Safe inline markdown tokenizer (bold, italic, strikethrough, inline code, link).
 */
function renderInline(text: string): ReactNode {
  if (!text) return null;

  // Simple sequential token matching
  const tokens: ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex matching inline elements:
  // 1: `code`
  // 2: **bold**
  // 3: *italic*
  // 4: ~~strike~~
  // 5: ![alt](url)
  // 6: [link text](url)
  const pattern = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)|(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))/;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      tokens.push(remaining);
      break;
    }

    if (match.index > 0) {
      tokens.push(remaining.slice(0, match.index));
    }

    const [fullMatch] = match;
    const matchKey = `inline-${keyIndex++}`;

    if (match[1]) {
      // Inline code
      tokens.push(
        <code key={matchKey} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
          {match[2]}
        </code>,
      );
    } else if (match[3]) {
      // Bold
      tokens.push(
        <strong key={matchKey} className="font-semibold text-foreground">
          {renderInline(match[4])}
        </strong>,
      );
    } else if (match[5]) {
      // Italic
      tokens.push(
        <em key={matchKey} className="italic">
          {renderInline(match[6])}
        </em>,
      );
    } else if (match[7]) {
      // Strikethrough
      tokens.push(
        <del key={matchKey} className="line-through text-muted-foreground">
          {match[8]}
        </del>,
      );
    } else if (match[9]) {
      // Image ![alt](url)
      const altText = match[10] || 'Image';
      const rawUrl = match[11];
      const imgUrl = rawUrl.startsWith('/') ? getAttachmentDownloadUrl(rawUrl, true) : rawUrl;
      if (isSafeUrl(rawUrl)) {
        tokens.push(
          <span key={matchKey} className="my-1 block max-w-full">
            <img
              src={imgUrl}
              alt={altText}
              className="max-h-72 max-w-full rounded-md border bg-muted/40 object-contain shadow-2xs"
              loading="lazy"
            />
          </span>,
        );
      } else {
        tokens.push(`![${altText}](${rawUrl})`);
      }
    } else if (match[12]) {
      // Link [text](url)
      const linkText = match[13];
      const rawUrl = match[14];
      const linkUrl = rawUrl.startsWith('/') ? getAttachmentDownloadUrl(rawUrl, true) : rawUrl;
      if (isSafeUrl(rawUrl)) {
        tokens.push(
          <a
            key={matchKey}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium break-all"
          >
            {linkText}
          </a>,
        );
      } else {
        tokens.push(`[${linkText}](${rawUrl})`);
      }
    } else {
      tokens.push(fullMatch);
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return <>{tokens}</>;
}

export interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  actions?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  id = 'markdown-editor',
  value,
  onChange,
  placeholder = 'Type markdown here…',
  rows = 4,
  maxLength = 20_000,
  disabled = false,
  actions,
  className,
  ariaLabel,
}) => {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormatting = (before: string, after = '', placeholderText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    const replacement = `${before}${selected}${after}`;

    const nextValue = value.slice(0, start) + replacement + value.slice(end);
    onChange(nextValue);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    }, 0);
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const beforeCursor = value.slice(0, start);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const nextValue = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    onChange(nextValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  return (
    <div className={cn('rounded-lg border border-input bg-card shadow-xs transition-colors focus-within:border-ring focus-within:ring-[2px] focus-within:ring-ring/30', className)}>
      {/* Editor Header: Tabs & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        {/* Write / Preview Tab Switcher */}
        <div className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'write'}
            onClick={() => setTab('write')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              tab === 'write'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PenLine className="size-3.5" aria-hidden="true" />
            <span>Write</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              tab === 'preview'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            <span>Preview</span>
          </button>
        </div>

        {/* Formatting Actions Toolbar (Visible in Write Mode) */}
        {tab === 'write' && (
          <div className="flex flex-wrap items-center gap-0.5" aria-label="Formatting tools">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('**', '**', 'bold text')}
              disabled={disabled}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
            >
              <Bold className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('*', '*', 'italic text')}
              disabled={disabled}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
            >
              <Italic className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('~~', '~~', 'strikethrough')}
              disabled={disabled}
              title="Strikethrough"
              aria-label="Strikethrough"
            >
              <Strikethrough className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="mx-0.5 h-3.5 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyLinePrefix('### ')}
              disabled={disabled}
              title="Heading 3"
              aria-label="Heading"
            >
              <Heading className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('`', '`', 'code')}
              disabled={disabled}
              title="Inline code"
              aria-label="Inline code"
            >
              <Code className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('```\n', '\n```', 'code block')}
              disabled={disabled}
              title="Code block"
              aria-label="Code block"
            >
              <SquareCode className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="mx-0.5 h-3.5 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyLinePrefix('- ')}
              disabled={disabled}
              title="Bulleted list"
              aria-label="Bulleted list"
            >
              <List className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyLinePrefix('1. ')}
              disabled={disabled}
              title="Numbered list"
              aria-label="Numbered list"
            >
              <ListOrdered className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyLinePrefix('> ')}
              disabled={disabled}
              title="Quote"
              aria-label="Quote"
            >
              <Quote className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFormatting('[', '](https://example.com)', 'link text')}
              disabled={disabled}
              title="Insert link"
              aria-label="Insert link"
            >
              <Link2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {/* Editor Body */}
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          className="w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:outline-none"
        />
      ) : (
        <div className="min-h-[100px] p-3 text-sm">
          <SafeMarkdownView content={value} />
        </div>
      )}

      {/* Editor Footer: Character count & Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {value.length} / {maxLength.toLocaleString()} characters · Markdown supported
        </span>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default MarkdownEditor;
