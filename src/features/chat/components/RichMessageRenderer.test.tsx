import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RichMessageRenderer, { ToolExecutionCard, InlineFormattedText } from './RichMessageRenderer';

describe('RichMessageRenderer & Sub-components', () => {
  describe('<InlineFormattedText>', () => {
    it('renders inline code, bold, italic, and external markdown links', () => {
      const { container } = render(
        <InlineFormattedText text="Here is `code`, **bold text**, *italic text*, and [Documentation](https://pmt.local/docs)" />
      );

      expect(screen.getByText('code')).toBeInTheDocument();
      expect(screen.getByText('bold text')).toBeInTheDocument();
      expect(screen.getByText('italic text')).toBeInTheDocument();
      const link = screen.getByText('Documentation');
      expect(link.closest('a')).toHaveAttribute('href', 'https://pmt.local/docs');
    });

    it('renders clickable ticket badge for issue keys and triggers onTicketClick', () => {
      const onTicketClick = vi.fn();
      render(
        <InlineFormattedText text="Fixed in ticket MOB-104 and QA-22" onTicketClick={onTicketClick} />
      );

      const ticketBtn = screen.getByRole('button', { name: /MOB-104/i });
      expect(ticketBtn).toBeInTheDocument();

      fireEvent.click(ticketBtn);
      expect(onTicketClick).toHaveBeenCalledWith('MOB-104');
    });
  });

  describe('<ToolExecutionCard>', () => {
    it('renders tool execution card with friendly label, tool name, and arguments', () => {
      render(
        <ToolExecutionCard
          toolName="time_entries_list"
          args={{ from_date: '2026-10-01', to_date: '2026-10-10' }}
        />
      );

      expect(screen.getByText('Query Time Entries')).toBeInTheDocument();
      expect(screen.getByText('time_entries_list')).toBeInTheDocument();

      // Expand arguments details by clicking the header
      const header = screen.getByText('Query Time Entries');
      fireEvent.click(header);

      expect(screen.getByText(/from_date/i)).toBeInTheDocument();
      expect(screen.getByText('2026-10-01')).toBeInTheDocument();
      expect(screen.getByText(/to_date/i)).toBeInTheDocument();
      expect(screen.getByText('2026-10-10')).toBeInTheDocument();
    });

    it('handles fallback label when toolName is not in preset dictionary', () => {
      render(
        <ToolExecutionCard
          toolName="custom_unknown_tool"
          args={{ foo: 'bar' }}
        />
      );

      expect(screen.getByText('custom_unknown_tool')).toBeInTheDocument();
    });
  });

  describe('<RichMessageRenderer>', () => {
    it('renders markdown tables cleanly with headers and cells', () => {
      const markdownTable = `
| Space Name | Key | Status |
|---|---|---|
| Payments | PAY | Active |
| Mobile | MOB | Planning |
      `;

      render(<RichMessageRenderer text={markdownTable} />);

      expect(screen.getByText('Space Name')).toBeInTheDocument();
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Payments')).toBeInTheDocument();
      expect(screen.getByText('PAY')).toBeInTheDocument();
      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.getByText('MOB')).toBeInTheDocument();
    });

    it('renders fenced code blocks with language badge and copy button', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      const codeBlock = '```json\n{"status": "ok", "count": 42}\n```';
      render(<RichMessageRenderer text={codeBlock} />);

      expect(screen.getByText('json')).toBeInTheDocument();
      expect(screen.getByText(/{"status": "ok", "count": 42}/)).toBeInTheDocument();

      const copyBtn = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith('{"status": "ok", "count": 42}');
    });

    it('renders bullet lists and blockquotes correctly', () => {
      const text = `
> This is an important system notice.

* Item 1: Complete database migration
* Item 2: Verify tenant isolation
      `;

      render(<RichMessageRenderer text={text} />);

      expect(screen.getByText(/This is an important system notice/i)).toBeInTheDocument();
      expect(screen.getByText(/Item 1: Complete database migration/i)).toBeInTheDocument();
      expect(screen.getByText(/Item 2: Verify tenant isolation/i)).toBeInTheDocument();
    });

    it('handles clicking ticket keys inside assistant reply to ask follow-up questions', () => {
      const onSendMessage = vi.fn();
      render(
        <RichMessageRenderer
          text="I identified a bug in ticket BUG-404 during review."
          onSendMessage={onSendMessage}
        />
      );

      const ticketBtn = screen.getByRole('button', { name: /BUG-404/i });
      fireEvent.click(ticketBtn);

      expect(onSendMessage).toHaveBeenCalledWith('Show details and status for BUG-404');
    });
  });
});
