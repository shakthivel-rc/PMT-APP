import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Clock,
  Ticket,
  Table as TableIcon,
  Info,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Wrench,
  Layers,
  Search,
  CheckCircle2,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface RichMessageRendererProps {
  text: string;
  onSendMessage?: (text: string) => void;
  onStagePrompt?: (text: string) => void;
  isLatestAssistant?: boolean;
}

/** Regex to detect PMT issue keys like DEV-1, PROJ-104, QA-99 */
const ISSUE_KEY_REGEX = /\b([A-Z]{2,10}-\d+)\b/g;

/** Human-readable display mapping for common tool names */
export const TOOL_DISPLAY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  time_entries_list: { label: 'Query Time Entries', icon: Clock },
  time_report_get: { label: 'Generate Timesheet Report', icon: Clock },
  time_entry_create: { label: 'Log Time Entry', icon: Clock },
  time_entry_update: { label: 'Update Time Entry', icon: Clock },
  time_entry_delete: { label: 'Delete Time Entry', icon: Clock },
  timer_get: { label: 'Check Active Timer', icon: Clock },
  timer_start: { label: 'Start Timer', icon: Clock },
  timer_stop: { label: 'Stop Timer', icon: Clock },
  issue_get: { label: 'Fetch Issue Details', icon: Ticket },
  issue_list: { label: 'Search Issues', icon: Ticket },
  issue_create: { label: 'Create Issue', icon: Ticket },
  issue_update: { label: 'Update Issue', icon: Ticket },
  issue_move: { label: 'Move Issue', icon: Ticket },
  issue_board_get: { label: 'Fetch Kanban Board', icon: Layers },
  issue_backlog_get: { label: 'Fetch Backlog', icon: Layers },
  sprint_list: { label: 'List Sprints', icon: Layers },
  sprint_get: { label: 'Fetch Sprint', icon: Layers },
  sprint_start: { label: 'Start Sprint', icon: Layers },
  sprint_close: { label: 'Close Sprint', icon: Layers },
  knowledge_search: { label: 'Search Knowledge Base', icon: Search },
  find_issue: { label: 'Resolve Issue Key', icon: Ticket },
  find_space: { label: 'Find Space', icon: Layers },
  find_sprint: { label: 'Find Sprint', icon: Layers },
  find_member: { label: 'Find Member', icon: Tag },
};

/** Render inline text elements: bold, italic, inline code, issue keys, dates, durations */
export const InlineFormattedText: React.FC<{
  text: string;
  onTicketClick?: (key: string) => void;
}> = ({ text, onTicketClick }) => {
  // Parse inline Markdown tokens: `code`, **bold**, *italic*, [link](url), and issue keys
  const tokens = useMemo(() => {
    // Regex matching markdown elements or issue keys
    const pattern =
      /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\b[A-Z]{2,10}-\d+\b)/g;
    const parts = text.split(pattern);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="rounded bg-muted/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary border border-border/40"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold text
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="font-semibold text-foreground">
            <InlineFormattedText text={inner} onTicketClick={onTicketClick} />
          </strong>
        );
      }

      // Italic text
      if (part.startsWith('*') && part.endsWith('*')) {
        const inner = part.slice(1, -1);
        return (
          <em key={idx} className="italic text-foreground/90">
            <InlineFormattedText text={inner} onTicketClick={onTicketClick} />
          </em>
        );
      }

      // Markdown Link: [text](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <span>{label}</span>
            <ExternalLink className="size-3" />
          </a>
        );
      }

      // Issue key like DEV-1, PROJ-104
      if (/^[A-Z]{2,10}-\d+$/.test(part)) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onTicketClick?.(part)}
            title={`Click to ask about ${part}`}
            className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            <Ticket className="size-3 shrink-0" />
            <span>{part}</span>
          </button>
        );
      }

      // Duration detection: e.g. "2h 30m", "45m", "~0m (22s)"
      if (
        /^(?:\d+h(?:\s*\d+m)?|\d+m(?:\s*\d+s)?|~\d+m(?:\s*\(\d+s\))?|< ?1m)$/.test(
          part.trim()
        )
      ) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-mono text-[11px] border border-border/40"
          >
            <Clock className="size-3 text-muted-foreground" />
            {part}
          </span>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  }, [text, onTicketClick]);

  return <>{tokens}</>;
};

/** Formats and renders a Markdown Table with row striping, cell alignments, copy buttons */
const RichTableBlock: React.FC<{
  tableLines: string[];
  onTicketClick?: (key: string) => void;
}> = ({ tableLines, onTicketClick }) => {
  const [copied, setCopied] = useState(false);

  const { headers, alignments, rows } = useMemo(() => {
    if (tableLines.length < 2) return { headers: [], alignments: [], rows: [] };

    const splitCells = (line: string) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());

    const h = splitCells(tableLines[0]);
    const alignLine = splitCells(tableLines[1]);

    const a = alignLine.map((c) => {
      if (c.startsWith(':') && c.endsWith(':')) return 'center';
      if (c.endsWith(':')) return 'right';
      return 'left';
    });

    const r = tableLines.slice(2).map(splitCells);
    return { headers: h, alignments: a, rows: r };
  }, [tableLines]);

  const handleCopyTableCSV = () => {
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    navigator.clipboard.writeText(csv);
    setCopied(true);
    toast.success('Table copied as CSV');
    setTimeout(() => setCopied(false), 2000);
  };

  if (headers.length === 0) return null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      {/* Table Action Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <TableIcon className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Data Table</span>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground bg-muted"
          >
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopyTableCSV}
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          <span>{copied ? 'Copied' : 'Copy CSV'}</span>
        </Button>
      </div>

      {/* Responsive Table Body */}
      <div className="overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/60">
            <TableRow className="border-b border-border/70 hover:bg-transparent">
              {headers.map((head, hIdx) => {
                const align = alignments[hIdx] || 'left';
                return (
                  <TableHead
                    key={hIdx}
                    className={`h-9 px-3.5 text-[11px] font-semibold text-foreground uppercase tracking-wider ${
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    }`}
                  >
                    <InlineFormattedText text={head} onTicketClick={onTicketClick} />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rIdx) => (
              <TableRow
                key={rIdx}
                className="border-b border-border/40 transition-colors hover:bg-primary/5 even:bg-muted/15"
              >
                {headers.map((_, cIdx) => {
                  const cell = row[cIdx] || '—';
                  const align = alignments[cIdx] || 'left';
                  return (
                    <TableCell
                      key={cIdx}
                      className={`py-2.5 px-3.5 align-middle leading-normal text-foreground/90 ${
                        align === 'center'
                          ? 'text-center'
                          : align === 'right'
                            ? 'text-right'
                            : 'text-left'
                      }`}
                    >
                      <InlineFormattedText text={cell} onTicketClick={onTicketClick} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

/** Render tool execution card with expandable details */
export const ToolExecutionCard: React.FC<{
  toolName: string;
  args?: Record<string, any>;
}> = ({ toolName, args }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = TOOL_DISPLAY_CONFIG[toolName] || {
    label: toolName.replace(/_/g, ' '),
    icon: Wrench,
  };
  const IconComp = cfg.icon;

  const hasArgs = args && Object.keys(args).length > 0;

  return (
    <div className="mb-2.5 overflow-hidden rounded-lg border border-border/70 bg-muted/30 text-xs">
      <div
        onClick={() => hasArgs && setExpanded(!expanded)}
        className={`flex items-center justify-between px-3 py-1.5 select-none ${
          hasArgs ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
            <IconComp className="size-3" />
          </div>
          <span className="font-medium text-foreground text-xs truncate">{cfg.label}</span>
          <Badge
            variant="outline"
            className="font-mono text-[10px] text-muted-foreground border-border/50 py-0 px-1.5"
          >
            {toolName}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-normal py-0 px-1.5 border-none"
          >
            <CheckCircle2 className="size-2.5" />
            <span>Success</span>
          </Badge>
          {hasArgs && (
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {expanded && hasArgs && (
        <div className="border-t border-border/50 bg-background/80 p-2.5 font-mono text-[11px] space-y-1">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
            Execution Parameters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Object.entries(args!).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2 bg-muted/40 rounded px-2 py-1 border border-border/30"
              >
                <span className="text-muted-foreground truncate">{k}:</span>
                <span className="font-semibold text-foreground truncate">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Main Rich Message Renderer: handles markdown, code blocks, tables, callouts, and suggestion chips */
export const RichMessageRenderer: React.FC<RichMessageRendererProps> = ({
  text,
  onSendMessage,
  onStagePrompt,
  isLatestAssistant,
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const handleTicketClick = (ticketKey: string) => {
    if (onSendMessage) {
      onSendMessage(`Show details and status for ${ticketKey}`);
    } else if (onStagePrompt) {
      onStagePrompt(`What is the status of ${ticketKey}?`);
    }
  };

  // Extract ticket keys and topics to generate interactive follow-up chips
  const suggestionChips = useMemo(() => {
    if (!isLatestAssistant || !onSendMessage) return [];

    const chips: string[] = [];
    const foundTickets = Array.from(new Set(text.match(ISSUE_KEY_REGEX) || []));

    // Ticket suggestions
    if (foundTickets.length > 0) {
      chips.push(`Inspect details of ${foundTickets[0]}`);
      if (text.toLowerCase().includes('time') || text.toLowerCase().includes('duration')) {
        chips.push(`Log 1h on ${foundTickets[0]}`);
      }
    }

    // Time tracking suggestions
    if (
      text.toLowerCase().includes('timesheet') ||
      text.toLowerCase().includes('time entries') ||
      text.toLowerCase().includes('hours')
    ) {
      chips.push('Summarize time by user');
      chips.push('Show time logged this week');
    }

    // Sprint suggestions
    if (text.toLowerCase().includes('sprint')) {
      chips.push('Show active sprint progress');
      chips.push('List unassigned sprint issues');
    }

    // General fallback suggestions if few found
    if (chips.length < 2) {
      if (text.toLowerCase().includes('issue') || text.toLowerCase().includes('ticket')) {
        chips.push('Filter by High priority');
      }
    }

    return chips.slice(0, 3);
  }, [text, isLatestAssistant, onSendMessage]);

  // Parse text into block-level elements (code, tables, callouts, paragraphs)
  const blocks = useMemo(() => {
    const rawBlocks: Array<{
      type: 'code' | 'table' | 'callout' | 'summary' | 'paragraph';
      content: string | string[];
      lang?: string;
    }> = [];

    // Separate code blocks
    const codeParts = text.split(/(```[\s\S]*?```)/g);

    for (const part of codeParts) {
      if (!part) continue;

      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0].trim();
        const hasLang = firstLine && !firstLine.includes(' ') && lines.length > 1;
        const lang = hasLang ? firstLine : '';
        const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
        rawBlocks.push({ type: 'code', content: code, lang });
        continue;
      }

      // Inside normal text, look for tables and callouts
      const lines = part.split('\n');
      let currentTable: string[] = [];
      let currentParagraph: string[] = [];

      const flushParagraph = () => {
        if (currentParagraph.length > 0) {
          const joined = currentParagraph.join('\n').trim();
          if (joined) {
            // Check if entire paragraph is a Note callout
            if (
              /^\*(?:\(Note:|Note:).*?\*\)?$/is.test(joined) ||
              /^>\s*\[!?(?:NOTE|INFO|WARNING)\]/i.test(joined)
            ) {
              rawBlocks.push({ type: 'callout', content: joined });
            } else if (/^\*\*Total\s+(?:Time|Duration|Issues|Points):/i.test(joined)) {
              rawBlocks.push({ type: 'summary', content: joined });
            } else {
              rawBlocks.push({ type: 'paragraph', content: joined });
            }
          }
          currentParagraph = [];
        }
      };

      const flushTable = () => {
        if (currentTable.length > 0) {
          rawBlocks.push({ type: 'table', content: currentTable });
          currentTable = [];
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if line looks like a table row
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
          flushParagraph();
          currentTable.push(trimmed);
        } else {
          flushTable();
          currentParagraph.push(line);
        }
      }

      flushTable();
      flushParagraph();
    }

    return rawBlocks;
  }, [text]);

  return (
    <div className="space-y-3 text-xs sm:text-sm leading-relaxed break-words text-foreground">
      {blocks.map((block, bIdx) => {
        // Code Block
        if (block.type === 'code') {
          const code = block.content as string;
          return (
            <div
              key={bIdx}
              className="my-3 overflow-hidden rounded-xl border border-border/80 bg-muted/50 font-mono text-xs shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/70 px-3.5 py-1.5 text-muted-foreground text-[11px]">
                <span className="font-semibold">{block.lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(code, bIdx)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  {copiedCodeIdx === bIdx ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedCodeIdx === bIdx ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-foreground">
                {code}
              </pre>
            </div>
          );
        }

        // Table Block
        if (block.type === 'table') {
          return (
            <RichTableBlock
              key={bIdx}
              tableLines={block.content as string[]}
              onTicketClick={handleTicketClick}
            />
          );
        }

        // Callout / Note Banner
        if (block.type === 'callout') {
          const noteText = (block.content as string)
            .replace(/^>\s*\[!?(?:NOTE|INFO)\]/i, '')
            .replace(/^\*\((?:Note:)?\s*/i, '')
            .replace(/\)\*$/, '')
            .replace(/^\*Note:\s*/i, '')
            .replace(/\*$/, '')
            .trim();

          return (
            <div
              key={bIdx}
              className="my-2.5 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-foreground/90 shadow-2xs"
            >
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 leading-normal">
                <span className="font-semibold text-primary mr-1">Note:</span>
                <InlineFormattedText text={noteText} onTicketClick={handleTicketClick} />
              </div>
            </div>
          );
        }

        // Summary metric highlight banner
        if (block.type === 'summary') {
          const summaryText = block.content as string;
          return (
            <div
              key={bIdx}
              className="my-2.5 flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs text-foreground shadow-2xs"
            >
              <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <div className="flex-1 font-medium leading-normal">
                <InlineFormattedText text={summaryText} onTicketClick={handleTicketClick} />
              </div>
            </div>
          );
        }

        // Paragraph Block with Lists & Headings
        const pLines = (block.content as string).split('\n');
        return (
          <div key={bIdx} className="space-y-1.5">
            {pLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1.5" />;

              // Headings
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="pt-2 pb-0.5 text-sm font-semibold text-foreground">
                    <InlineFormattedText
                      text={trimmed.substring(4)}
                      onTicketClick={handleTicketClick}
                    />
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="pt-2.5 pb-1 text-sm sm:text-base font-bold text-foreground">
                    <InlineFormattedText
                      text={trimmed.substring(3)}
                      onTicketClick={handleTicketClick}
                    />
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="pt-3 pb-1 text-base sm:text-lg font-bold text-foreground border-b border-border/40">
                    <InlineFormattedText
                      text={trimmed.substring(2)}
                      onTicketClick={handleTicketClick}
                    />
                  </h2>
                );
              }

              // Unordered list item
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const itemContent = trimmed.substring(2);
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="text-primary mt-1 text-[11px] leading-none shrink-0">•</span>
                    <span className="leading-relaxed">
                      <InlineFormattedText
                        text={itemContent}
                        onTicketClick={handleTicketClick}
                      />
                    </span>
                  </div>
                );
              }

              // Ordered list item
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                const [, num, numContent] = numMatch;
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold shrink-0 mt-0.5">
                      {num}
                    </span>
                    <span className="leading-relaxed">
                      <InlineFormattedText
                        text={numContent}
                        onTicketClick={handleTicketClick}
                      />
                    </span>
                  </div>
                );
              }

              // Standard line
              return (
                <p key={lIdx} className="leading-relaxed text-foreground/90">
                  <InlineFormattedText text={line} onTicketClick={handleTicketClick} />
                </p>
              );
            })}
          </div>
        );
      })}

      {/* Interactive Follow-up Action Suggestion Chips */}
      {suggestionChips.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5 font-medium">
            <Sparkles className="size-3 text-primary" />
            <span>Suggested follow-ups:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestionChips.map((chip, cIdx) => (
              <button
                key={cIdx}
                type="button"
                onClick={() => onSendMessage?.(chip)}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-accent hover:border-primary/40 px-2.5 py-1 text-xs text-foreground transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              >
                <span>{chip}</span>
                <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RichMessageRenderer;
