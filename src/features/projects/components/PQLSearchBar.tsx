import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CheckCircle2, AlertCircle, Bookmark, Loader2, Sparkles } from 'lucide-react';
import { pqlApi } from '../../../api/pql';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

interface PQLSearchBarProps {
  workspaceId: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  onSaveView?: (query: string) => void;
  initialQuery?: string;
  placeholder?: string;
}

const PQL_TOKENS = [
  // Fields
  'priority',
  'type',
  'status',
  'points',
  'assignee',
  'space',
  'list',
  'sprint',
  // Operators
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'IN',
  'NOT IN',
  'CONTAINS',
  // Keywords
  'AND',
  'OR',
  'NOT',
  'ORDER BY',
  'ASC',
  'DESC',
  // Values
  '"urgent"',
  '"high"',
  '"medium"',
  '"low"',
  '"bug"',
  '"story"',
  '"task"',
  '"epic"',
  '"todo"',
  '"in_progress"',
  '"done"',
  '"canceled"',
];

export const PQLSearchBar: React.FC<PQLSearchBarProps> = ({
  workspaceId,
  onSearch,
  onClear,
  onSaveView,
  initialQuery = '',
  placeholder = 'Filter issues using PQL, e.g. priority = "urgent" AND type = "bug"',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced validation
  useEffect(() => {
    if (!query.trim()) {
      setIsValid(null);
      setErrorMessage(null);
      return;
    }

    setIsValidating(true);
    const timer = setTimeout(async () => {
      try {
        const res = await pqlApi.validate(workspaceId, query);
        if (res.data.valid) {
          setIsValid(true);
          setErrorMessage(null);
        } else {
          setIsValid(false);
          setErrorMessage(res.data.error || 'Syntax error in PQL query');
        }
      } catch (err: any) {
        setIsValid(false);
        setErrorMessage(err.message || 'Validation error');
      } finally {
        setIsValidating(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  // Handle outside click for suggestions popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateSuggestions = (text: string) => {
    const parts = text.split(/\s+/);
    const lastWord = parts[parts.length - 1] || '';

    if (!lastWord) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const matches = PQL_TOKENS.filter((t) =>
      t.toLowerCase().startsWith(lastWord.toLowerCase()) && t.toLowerCase() !== lastWord.toLowerCase()
    ).slice(0, 8);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    updateSuggestions(val);
  };

  const applySuggestion = (suggestion: string) => {
    const parts = query.split(/\s+/);
    parts[parts.length - 1] = suggestion;
    const newQuery = parts.join(' ') + ' ';
    setQuery(newQuery);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && selectedIndex >= 0)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(query);
      setShowSuggestions(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsValid(null);
    setErrorMessage(null);
    setShowSuggestions(false);
    onClear?.();
    onSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center bg-card border rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <div className="pl-3 text-muted-foreground flex items-center pointer-events-none">
          <Search className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => updateSuggestions(query)}
          placeholder={placeholder}
          className="w-full py-2 pl-2 pr-28 text-sm font-mono bg-transparent border-0 outline-none placeholder:text-muted-foreground/60 text-foreground"
          aria-label="PQL query input"
        />

        {/* Validation & Actions cluster */}
        <div className="absolute right-2 flex items-center gap-1.5">
          {isValidating && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Validating query" />
          )}

          {!isValidating && isValid === true && (
            <Badge variant="outline" className="h-5 px-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 text-[10px] gap-1 font-sans">
              <CheckCircle2 className="h-3 w-3" />
              Valid
            </Badge>
          )}

          {!isValidating && isValid === false && (
            <Badge
              variant="destructive"
              className="h-5 px-1.5 text-[10px] gap-1 font-sans cursor-help"
              title={errorMessage || 'Invalid PQL syntax'}
            >
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          )}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label="Clear PQL query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {onSaveView && query.trim() && isValid === true && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSaveView(query)}
              className="h-7 px-2 text-xs gap-1 font-sans text-muted-foreground hover:text-foreground"
              title="Save query as View"
            >
              <Bookmark className="h-3 w-3" />
              <span className="hidden sm:inline">Save View</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => onSearch(query)}
            className="h-7 px-2.5 text-xs font-sans"
            disabled={isValid === false}
          >
            Run
          </Button>
        </div>
      </div>

      {/* Error detail banner if invalid */}
      {isValid === false && errorMessage && (
        <div className="absolute left-0 right-0 top-full mt-1 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive flex items-center gap-1.5 z-10">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono text-[11px] truncate">{errorMessage}</span>
        </div>
      )}

      {/* Autocomplete suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg py-1 z-20 max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span>PQL Suggestions</span>
          </div>
          {suggestions.map((token, idx) => (
            <button
              key={token}
              type="button"
              onClick={() => applySuggestion(token)}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between transition-colors ${
                idx === selectedIndex
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <span>{token}</span>
              <span className="text-[10px] font-sans text-muted-foreground">Tab to complete</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
