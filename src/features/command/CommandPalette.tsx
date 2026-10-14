import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelLeft,
  BarChart3,
  Shield,
  User,
  Palette,
  FolderGit2,
  Square,
  Trash2,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setCommandPaletteOpen,
  toggleFocusMode,
  toggleSidebar,
  toggleChatDrawer,
  setTheme,
} from '@/features/ui/uiSlice';
import { stopTimer, discardTimer } from '@/features/time/timerSlice';
import { fetchWorkspacesApi } from '@/api/workspaces';
import { fetchIssuesApi } from '@/api/issues';
import type { WorkspaceSummary, IssueCard } from '@/types';
import { THEMES } from '@/features/ui/themes';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommandOption {
  id: string;
  category: 'Actions' | 'Navigation' | 'Timer' | 'Themes' | 'Projects' | 'Issues';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
}

export const CommandPalette = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const open = useAppSelector((state) => state.ui.commandPaletteOpen);
  const focusMode = useAppSelector((state) => state.ui.focusMode);
  const activeTimer = useAppSelector((state) => state.timer.timer);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [searchedIssues, setSearchedIssues] = useState<IssueCard[]>([]);
  const [isSearchingIssues, setIsSearchingIssues] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract current workspace ID from URL if inside /projects/:workspaceId
  const currentWorkspaceId = useMemo(() => {
    const match = location.pathname.match(/\/projects\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : workspaces[0]?.id ?? null;
  }, [location.pathname, workspaces]);

  // Load workspaces when opened
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }
    fetchWorkspacesApi()
      .then((data) => setWorkspaces(data))
      .catch(() => {});
  }, [open]);

  // Debounced search for issues
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed || !currentWorkspaceId || trimmed.length < 2) {
      setSearchedIssues([]);
      setIsSearchingIssues(false);
      return;
    }

    setIsSearchingIssues(true);
    const timer = setTimeout(() => {
      fetchIssuesApi(currentWorkspaceId, { q: trimmed, limit: 6 })
        .then((res) => {
          setSearchedIssues(res.records);
        })
        .catch(() => {
          setSearchedIssues([]);
        })
        .finally(() => {
          setIsSearchingIssues(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [open, query, currentWorkspaceId]);

  const closePalette = () => {
    dispatch(setCommandPaletteOpen(false));
  };

  // Compile all command items
  const options = useMemo(() => {
    const items: CommandOption[] = [];
    const q = query.toLowerCase().trim();

    // 1. Timer Controls (if active)
    if (activeTimer) {
      items.push({
        id: 'timer-stop',
        category: 'Timer',
        title: `Stop Active Timer (${activeTimer.issue.key})`,
        subtitle: `${activeTimer.issue.title} · ${formatDuration(activeTimer.elapsed_seconds)} running`,
        icon: Square,
        onSelect: () => {
          dispatch(stopTimer());
          closePalette();
          toast.success(`Stopped timer on ${activeTimer.issue.key}`);
        },
      });
      items.push({
        id: 'timer-discard',
        category: 'Timer',
        title: `Discard Active Timer (${activeTimer.issue.key})`,
        subtitle: 'Drop elapsed time without creating an entry',
        icon: Trash2,
        onSelect: () => {
          dispatch(discardTimer());
          closePalette();
          toast.info(`Discarded timer on ${activeTimer.issue.key}`);
        },
      });
    }

    // 2. Quick Actions
    items.push({
      id: 'action-focus',
      category: 'Actions',
      title: focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode',
      subtitle: 'Hide or show headers and sidebars for zero distraction',
      icon: focusMode ? Minimize2 : Maximize2,
      shortcut: 'Shift+F',
      onSelect: () => {
        dispatch(toggleFocusMode());
        closePalette();
      },
    });

    items.push({
      id: 'action-sidebar',
      category: 'Actions',
      title: 'Toggle Primary Sidebar',
      subtitle: 'Collapse or expand navigation rail',
      icon: PanelLeft,
      shortcut: '[',
      onSelect: () => {
        dispatch(toggleSidebar());
        closePalette();
      },
    });

    items.push({
      id: 'action-ai',
      category: 'Actions',
      title: 'Open AI Assistant',
      subtitle: 'Chat with project intelligence and codebase models',
      icon: Sparkles,
      onSelect: () => {
        dispatch(toggleChatDrawer());
        closePalette();
      },
    });

    // 3. Navigation
    items.push({
      id: 'nav-timesheet',
      category: 'Navigation',
      title: 'Timesheet & Financial Time Tracking',
      subtitle: 'View logged hours, billable value, and personal entries',
      icon: Clock,
      onSelect: () => {
        navigate('/timesheet');
        closePalette();
      },
    });

    items.push({
      id: 'nav-reports',
      category: 'Navigation',
      title: 'Analytics & Reports Hub',
      subtitle: 'Velocity, burndown, workload, and time group breakdowns',
      icon: BarChart3,
      onSelect: () => {
        navigate('/reports');
        closePalette();
      },
    });

    items.push({
      id: 'nav-profile',
      category: 'Navigation',
      title: 'My Profile & Account Settings',
      subtitle: 'Avatar, password, security credentials',
      icon: User,
      onSelect: () => {
        navigate('/profile');
        closePalette();
      },
    });

    items.push({
      id: 'nav-roles',
      category: 'Navigation',
      title: 'Roles & Permissions',
      subtitle: 'RBAC policies and system privileges',
      icon: Shield,
      onSelect: () => {
        navigate('/roles-and-permissions');
        closePalette();
      },
    });

    // 4. Workspaces & Projects
    workspaces.forEach((ws) => {
      items.push({
        id: `workspace-${ws.id}`,
        category: 'Projects',
        title: `Workspace: ${ws.name}`,
        subtitle: `${ws.role} role · Jump to project view`,
        icon: FolderGit2,
        onSelect: () => {
          navigate(`/projects/${encodeURIComponent(ws.id)}`);
          closePalette();
        },
      });
    });

    // 5. Searched Issues
    searchedIssues.forEach((issue) => {
      items.push({
        id: `issue-${issue.id}`,
        category: 'Issues',
        title: `${issue.key}: ${issue.title}`,
        subtitle: `Type: ${issue.type} · Priority: ${issue.priority}`,
        icon: FileText,
        onSelect: () => {
          if (currentWorkspaceId && issue.list_id) {
            navigate(
              `/projects/${encodeURIComponent(currentWorkspaceId)}/lists/${encodeURIComponent(issue.list_id)}?issue=${encodeURIComponent(issue.id)}`
            );
          }
          closePalette();
        },
      });
    });

    // 6. Themes
    THEMES.forEach((t) => {
      items.push({
        id: `theme-${t.id}`,
        category: 'Themes',
        title: `Switch Theme: ${t.name}`,
        subtitle: `${t.mode} mode · ${t.description}`,
        icon: Palette,
        onSelect: () => {
          dispatch(setTheme(t.id));
          closePalette();
          toast.success(`Theme set to ${t.name}`);
        },
      });
    });

    // Filter items based on query
    if (!q) return items;

    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [
    query,
    activeTimer,
    focusMode,
    workspaces,
    searchedIssues,
    currentWorkspaceId,
    dispatch,
    navigate,
  ]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex((prev) => (options.length === 0 ? 0 : Math.min(prev, options.length - 1)));
  }, [options.length]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (options.length === 0 ? 0 : (prev + 1) % options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (options.length === 0 ? 0 : (prev - 1 + options.length) % options.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[selectedIndex]) {
        options[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Group filtered options by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandOption[]>();
    for (const opt of options) {
      const list = map.get(opt.category) ?? [];
      list.push(opt);
      map.set(opt.category, list);
    }
    return map;
  }, [options]);

  return (
    <Dialog open={open} onOpenChange={(val) => dispatch(setCommandPaletteOpen(val))}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden shadow-2xl border-border bg-popover/95 backdrop-blur-md"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-background/50">
          <Search className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results-list"
            aria-autocomplete="list"
            aria-label="Type a command or search"
            placeholder="Type a command, project, theme, or search issues..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto placeholder:text-muted-foreground/70"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0.5 text-muted-foreground">
            Esc
          </Badge>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-results-list"
          role="listbox"
          aria-label="Command suggestions"
          className="max-h-[360px] overflow-y-auto p-2 space-y-3"
        >
          {options.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {isSearchingIssues ? 'Searching issues...' : 'No commands or entities found.'}
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {category}
                </div>
                {items.map((item) => {
                  const globalIdx = options.findIndex((o) => o.id === item.id);
                  const isSelected = globalIdx === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      role="option"
                      id={`command-option-${item.id}`}
                      data-index={globalIdx}
                      aria-selected={isSelected}
                      onClick={item.onSelect}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-foreground hover:bg-accent/60'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                          )}
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className="truncate">{item.title}</span>
                          {item.subtitle && (
                            <span
                              className={cn(
                                'text-2xs truncate',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.shortcut && (
                          <kbd
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-mono',
                              isSelected
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-muted text-muted-foreground border'
                            )}
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                        {isSelected && (
                          <ArrowRight className="size-3.5 text-primary-foreground shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-2xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-2">
            <span>
              <kbd className="font-mono bg-background px-1 py-0.5 rounded border text-[10px]">↑</kbd>
              <kbd className="font-mono bg-background px-1 py-0.5 rounded border text-[10px] ml-0.5">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono bg-background px-1 py-0.5 rounded border text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span>PMT Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
