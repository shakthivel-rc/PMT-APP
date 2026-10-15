import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClarificationCardView from './ClarificationCardView';

describe('ClarificationCardView', () => {
  it('renders correctly with options array of strings', () => {
    const onSelect = vi.fn();
    render(
      <ClarificationCardView
        clarification={{
          question: 'Which list?',
          options: ['Backlog', 'Bugs'],
        }}
        onSelectOption={onSelect}
      />
    );

    expect(screen.getByText('Which list?')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Bugs')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Backlog'));
    expect(onSelect).toHaveBeenCalledWith('Backlog');
  });

  it('renders gracefully when options is undefined but candidates is provided', () => {
    const onSelect = vi.fn();
    render(
      <ClarificationCardView
        clarification={{
          question: 'Which list in Features space?',
          candidates: [
            { id: 'opt-1', name: 'UPI' },
            { id: 'opt-2', name: 'Dashboard' },
          ],
        } as any}
        onSelectOption={onSelect}
      />
    );

    expect(screen.getByText('Which list in Features space?')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByText('UPI'));
    expect(onSelect).toHaveBeenCalledWith('UPI');
  });

  it('does not throw when options and candidates are undefined', () => {
    const onSelect = vi.fn();
    render(
      <ClarificationCardView
        clarification={{} as any}
        onSelectOption={onSelect}
      />
    );

    expect(screen.getByText('Clarification Needed')).toBeInTheDocument();
  });
});
