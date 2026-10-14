import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Bot,
  PanelLeftClose,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchWorkspacesApi } from '@/api/workspaces';
import {
  fetchConversations,
  deleteConversation,
  type ChatConversationSummary,
} from '@/api/chat';
import type { WorkspaceSummary } from '@/types';
import AIChatView from './AIChatView';
import { cn } from '@/lib/utils';

export const AIChatPage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch workspaces
  useEffect(() => {
    fetchWorkspacesApi()
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedWorkspaceId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load workspaces for chat:', err);
      });
  }, []);

  // Fetch conversations when selectedWorkspaceId changes
  const loadConversations = useCallback(async (wId: string) => {
    if (!wId) return;
    setLoadingConversations(true);
    try {
      const list = await fetchConversations(wId);
      setConversations(list);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadConversations(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, loadConversations]);

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
  };

  const handleNewChat = () => {
    setActiveConversationId(undefined);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!selectedWorkspaceId) return;
    try {
      await deleteConversation(selectedWorkspaceId, convId);
      toast.success('Conversation deleted');
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(undefined);
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const handleConversationCreated = (newId: string) => {
    setActiveConversationId(newId);
    if (selectedWorkspaceId) {
      loadConversations(selectedWorkspaceId);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar: Conversation History */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card/60 transition-all duration-200 ease-in-out shrink-0 overflow-hidden',
          sidebarOpen ? 'w-72 md:w-80' : 'w-0 border-r-0'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Conversations</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
            title="Collapse history"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        {/* Workspace select + New chat button */}
        <div className="flex flex-col gap-2 p-3 border-b border-border/60 bg-muted/20">
          {workspaces.length > 0 && (
            <Select
              value={selectedWorkspaceId}
              onValueChange={(val) => {
                setSelectedWorkspaceId(val);
                setActiveConversationId(undefined);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={handleNewChat}
            className="w-full gap-2 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            New Chat
          </Button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/40" />
              <p className="font-medium text-foreground/80">No conversations yet</p>
              <p className="mt-1 text-muted-foreground/70">
                Start a new chat to ask questions or perform tasks in PMT.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const title = conv.title || 'Chat Session';
              const dateStr = conv.created_at
                ? new Date(conv.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{title}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {dateStr && (
                      <span className="text-[10px] text-muted-foreground group-hover:hidden">
                        {dateStr}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-block"
                      title="Delete chat"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AIChatView
          key={`${selectedWorkspaceId}-${activeConversationId || 'new'}`}
          initialWorkspaceId={selectedWorkspaceId}
          initialConversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
      </div>
    </div>
  );
};

export default AIChatPage;
