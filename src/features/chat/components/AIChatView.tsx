import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Settings2,
  Bot,
  User as UserIcon,
  Loader2,
  Building2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Check,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RichMessageRenderer, { ToolExecutionCard } from './RichMessageRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  sendChatTurn,
  fetchConversationHistory,
  fetchChatSettings,
  type ChatMessageItem,
  type ConfirmCard,
  type Clarification,
  type ChatSettings,
} from '@/api/chat';
import { fetchWorkspacesApi } from '@/api/workspaces';
import type { WorkspaceSummary } from '@/types';
import ConfirmCardView from './ConfirmCardView';
import UndoCardView from './UndoCardView';
import ClarificationCardView from './ClarificationCardView';
import AIChatSettingsModal from './AIChatSettingsModal';

interface AIChatViewProps {
  initialWorkspaceId?: string;
  initialConversationId?: string;
  onConversationCreated?: (conversationId: string) => void;
  compact?: boolean;
  onClose?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const EXAMPLE_PROMPTS = [
  'List all timesheets from 01-10-2026 to 10-10-2026',
  'What are the open high priority bugs in this workspace?',
  'Show active sprint progress and unassigned tickets',
  'Search knowledge docs for deployment instructions',
];


export const AIChatView: React.FC<AIChatViewProps> = ({
  initialWorkspaceId,
  initialConversationId,
  onConversationCreated,
  compact = false,
  onClose,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(initialWorkspaceId || '');
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ChatSettings | null>(null);

  const [activeConfirmCard, setActiveConfirmCard] = useState<ConfirmCard | null>(null);
  const [activeClarification, setActiveClarification] = useState<Clarification | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load workspaces and chat settings
  useEffect(() => {
    fetchWorkspacesApi()
      .then((data) => {
        setWorkspaces(data);
        if (initialWorkspaceId && data.some((w) => w.id === initialWorkspaceId)) {
          setSelectedWorkspaceId(initialWorkspaceId);
        } else if (!selectedWorkspaceId && data.length > 0) {
          setSelectedWorkspaceId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load workspaces:', err);
      });

    fetchChatSettings()
      .then((data) => setSettings(data))
      .catch(() => {});
  }, [initialWorkspaceId]);

  // Update selected workspace if prop changes
  useEffect(() => {
    if (initialWorkspaceId && initialWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(initialWorkspaceId);
      setConversationId(undefined);
      setMessages([]);
      setActiveConfirmCard(null);
      setActiveClarification(null);
    }
  }, [initialWorkspaceId]);

  // Update conversation id if prop changes
  useEffect(() => {
    setConversationId(initialConversationId);
    if (!initialConversationId) {
      setMessages([]);
      setActiveConfirmCard(null);
      setActiveClarification(null);
    }
  }, [initialConversationId]);

  // Load conversation history if id is provided
  useEffect(() => {
    if (!selectedWorkspaceId || !conversationId) return;
    fetchConversationHistory(selectedWorkspaceId, conversationId)
      .then((history) => {
        if (history.messages && history.messages.length > 0) {
          setMessages(history.messages);
        }
      })
      .catch((err) => {
        console.error('Failed to load conversation history:', err);
      });
  }, [selectedWorkspaceId, conversationId]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading, activeConfirmCard, activeClarification]);

  const handleStartNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setActiveConfirmCard(null);
    setActiveClarification(null);
    setInputMessage('');
    textareaRef.current?.focus();
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : inputMessage;
    if (!textToSend.trim() || loading || !selectedWorkspaceId) return;

    const userMsg: ChatMessageItem = {
      role: 'user',
      content: textToSend.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (customMessage === undefined) {
      setInputMessage('');
    }
    setLoading(true);

    try {
      const result = await sendChatTurn(selectedWorkspaceId, {
        message: textToSend.trim(),
        conversation_id: conversationId,
      });

      if (result.conversation_id && result.conversation_id !== conversationId) {
        setConversationId(result.conversation_id);
        onConversationCreated?.(result.conversation_id);
      }

      const assistantMsg: ChatMessageItem = {
        role: 'assistant',
        content: result.reply,
        tool_calls: result.tool_calls_executed,
        confirm_card: result.confirm_card,
        undo_action: result.undo_action,
        clarification: result.clarification,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (result.confirm_card) {
        setActiveConfirmCard(result.confirm_card);
      }
      if (result.clarification) {
        setActiveClarification(result.clarification);
      }
      if (result.error && !result.reply) {
        toast.error(result.error);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Chat turn execution failed';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${msg}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (confirmId: string, typedText?: string) => {
    if (!selectedWorkspaceId || loading) return;
    setLoading(true);
    try {
      const result = await sendChatTurn(selectedWorkspaceId, {
        conversation_id: conversationId,
        confirm_action_id: confirmId,
        confirm_typed_text: typedText || undefined,
      });

      setActiveConfirmCard(null);
      const assistantMsg: ChatMessageItem = {
        role: 'assistant',
        content: result.reply || 'Action confirmed and executed.',
        undo_action: result.undo_action,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.success('Action confirmed successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAction = async (confirmId: string) => {
    if (!selectedWorkspaceId || loading) return;
    setLoading(true);
    try {
      const result = await sendChatTurn(selectedWorkspaceId, {
        conversation_id: conversationId,
        cancel_action_id: confirmId,
      });

      setActiveConfirmCard(null);
      const assistantMsg: ChatMessageItem = {
        role: 'assistant',
        content: result.reply || 'Action cancelled.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.info('Action cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Cancellation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUndoAction = async (undoId: string) => {
    if (!selectedWorkspaceId || loading) return;
    setLoading(true);
    try {
      const result = await sendChatTurn(selectedWorkspaceId, {
        conversation_id: conversationId,
        undo_action_id: undoId,
      });

      const assistantMsg: ChatMessageItem = {
        role: 'assistant',
        content: result.reply || 'Action reverted successfully.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.success('Action reverted successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Undo failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClarificationOption = (option: string) => {
    setActiveClarification(null);
    handleSend(option);
  };

  const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);

  const handleCopyMessage = (text: string, idx: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMessageIdx(idx);
    toast.success('Message copied to clipboard');
    setTimeout(() => {
      setCopiedMessageIdx((prev) => (prev === idx ? null : prev));
    }, 2000);
  };

  const handleReusePrompt = (text: string) => {
    setInputMessage(text);
    textareaRef.current?.focus();
    toast.info('Prompt loaded into composer');
  };

  const handleRetryLastTurn = () => {
    if (loading) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content) {
        handleSend(messages[i].content);
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-background border-border overflow-hidden">
      {/* Header Bar */}
      <div className="flex h-12 sm:h-14 shrink-0 items-center justify-between gap-1.5 sm:gap-3 border-b border-border bg-card/75 px-2.5 sm:px-4 backdrop-blur-md">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          {/* Sidebar Toggle in page view */}
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="size-7 sm:size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              title={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
            >
              {sidebarOpen ? <PanelLeftClose className="size-3.5 sm:size-4" /> : <PanelLeftOpen className="size-3.5 sm:size-4" />}
            </Button>
          )}

          <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-3.5 sm:size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-semibold truncate leading-tight text-foreground">
                <span className="sm:hidden">AI Assistant</span>
                <span className="hidden sm:inline">PMT AI Assistant</span>
              </h2>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0 uppercase text-primary border-primary/30 shrink-0">
                Gateway
              </Badge>
            </div>
            <p className="hidden md:block text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              Workspace automation & pair programming
            </p>
          </div>
        </div>

        {/* Right Header Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Workspace Selector */}
          {workspaces.length > 0 && (
            <Select
              value={selectedWorkspaceId}
              onValueChange={(val) => {
                if (val !== selectedWorkspaceId) {
                  setSelectedWorkspaceId(val);
                  setConversationId(undefined);
                  setMessages([]);
                  setActiveConfirmCard(null);
                  setActiveClarification(null);
                }
              }}
            >
              <SelectTrigger className="h-7 sm:h-8 text-xs max-w-[120px] sm:max-w-none sm:w-[150px] px-1.5 sm:px-2 font-medium">
                <Building2 className="size-3 text-muted-foreground mr-1 shrink-0" />
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id} className="text-xs">
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleStartNewChat}
            title="Start new conversation"
            className="size-7 sm:size-auto sm:h-8 p-0 sm:px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-lg"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            title="Configure AI model & credentials"
            className="size-7 sm:size-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
          >
            <Settings2 className="size-3.5 sm:size-4" />
          </Button>

          {/* Close drawer button */}
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              title="Close assistant"
              className="size-7 sm:size-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="size-3.5 sm:size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* API Key Missing Notice */}
      {settings && !settings.has_api_key && (
        <div className="flex items-center justify-between gap-3 bg-primary/10 border-b border-primary/20 px-4 py-2 text-xs text-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <span className="truncate">
              AI model credentials are not configured yet. Configure your API key to enable full AI assistance.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="h-6 px-2 text-[11px] gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Settings2 className="size-3" />
            Configure
          </Button>
        </div>
      )}

      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${compact ? 'p-3 space-y-3' : 'p-3 sm:p-5 space-y-4'} min-h-0 min-w-0 w-full max-w-full bg-background/50`}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full text-center max-w-md mx-auto py-6 sm:py-8 px-4 text-muted-foreground">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-sm">
              <Sparkles className="size-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              How can I help with your project today?
            </h3>
            <p className="text-xs text-muted-foreground mb-6 max-w-xs leading-relaxed">
              Ask me to inspect issues, check sprints, log timesheets, search knowledge, or manage workspace workflows.
            </p>

            <div className="grid grid-cols-1 gap-2.5 w-full text-left">
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="rounded-xl border border-border/80 bg-card p-3 text-xs text-foreground/90 hover:bg-accent hover:border-primary/40 transition-all text-left shadow-2xs group flex items-center justify-between"
                >
                  <span className="truncate font-medium">{prompt}</span>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors pl-2">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages
          .filter((msg) => msg.role !== 'tool' && (msg.content || msg.confirm_card || msg.undo_action || msg.clarification || (msg.tool_calls && msg.tool_calls.length > 0)))
          .map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isLatestAssistant = !isUser && idx === messages.length - 1;
          const timeStr = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={idx}
              className={`group flex flex-col gap-1 text-sm w-full max-w-full min-w-0 ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex gap-2 sm:gap-2.5 items-start w-full max-w-full min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {/* Assistant avatar */}
                {!isUser && (
                  <div className="size-7 sm:size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="size-3.5 sm:size-4" />
                  </div>
                )}

                {/* Left hover actions for user messages (desktop only) */}
                {isUser && (
                  <div className="hidden sm:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 self-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy prompt"
                      onClick={() => handleCopyMessage(msg.content || '', idx)}
                    >
                      {copiedMessageIdx === idx ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Edit / reuse prompt in composer"
                      onClick={() => handleReusePrompt(msg.content || '')}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`min-w-0 max-w-[calc(100%-38px)] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs break-words [word-break:break-word] overflow-hidden ${
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-xs'
                      : 'bg-card border border-border/80 text-foreground rounded-tl-xs'
                  }`}
                >
                  {/* Tool execution cards */}
                  {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="mb-2 space-y-1.5 min-w-0 max-w-full">
                      {msg.tool_calls.map((tc, tIdx) => {
                        const toolName = typeof tc === 'string' ? tc : tc.name || tc.tool || 'tool';
                        const args = typeof tc === 'object' && tc ? (tc.arguments || tc.args) : undefined;
                        return (
                          <ToolExecutionCard
                            key={tIdx}
                            toolName={toolName}
                            args={args}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Message text */}
                  {msg.content && (
                    isUser ? (
                      <div className="whitespace-pre-wrap break-words [word-break:break-word] text-xs sm:text-sm leading-relaxed">{msg.content}</div>
                    ) : (
                      <RichMessageRenderer
                        text={msg.content}
                        onSendMessage={(t) => handleSend(t)}
                        onStagePrompt={(t) => handleReusePrompt(t)}
                        isLatestAssistant={isLatestAssistant}
                      />
                    )
                  )}

                  {/* Confirmation Card */}
                  {msg.confirm_card && (
                    <ConfirmCardView
                      card={msg.confirm_card}
                      onConfirm={handleConfirmAction}
                      onCancel={handleCancelAction}
                      disabled={loading}
                    />
                  )}

                  {/* Undo Card */}
                  {msg.undo_action && (
                    <UndoCardView
                      action={msg.undo_action}
                      onUndo={handleUndoAction}
                      disabled={loading}
                    />
                  )}

                  {/* Clarification Card */}
                  {msg.clarification && (
                    <ClarificationCardView
                      clarification={msg.clarification}
                      onSelectOption={handleClarificationOption}
                      disabled={loading}
                    />
                  )}

                  {/* Mobile action bar for assistant message */}
                  {!isUser && (
                    <div className="flex sm:hidden items-center gap-2 mt-2 pt-2 border-t border-border/40 text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content || '', idx)}
                        className="inline-flex items-center gap-1 text-2xs hover:text-foreground cursor-pointer"
                      >
                        {copiedMessageIdx === idx ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        <span>{copiedMessageIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      {isLatestAssistant && !loading && (
                        <button
                          type="button"
                          onClick={handleRetryLastTurn}
                          className="inline-flex items-center gap-1 text-2xs hover:text-foreground cursor-pointer ml-1"
                        >
                          <RotateCcw className="size-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Mobile action bar for user message */}
                  {isUser && (
                    <div className="flex sm:hidden items-center justify-end gap-2 mt-1.5 pt-1.5 border-t border-primary-foreground/20 text-primary-foreground/80">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content || '', idx)}
                        className="inline-flex items-center gap-1 text-2xs hover:text-primary-foreground cursor-pointer"
                      >
                        {copiedMessageIdx === idx ? <Check className="size-3" /> : <Copy className="size-3" />}
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReusePrompt(msg.content || '')}
                        className="inline-flex items-center gap-1 text-2xs hover:text-primary-foreground cursor-pointer ml-1"
                      >
                        <Pencil className="size-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right hover actions for assistant messages (desktop only) */}
                {!isUser && (
                  <div className="hidden sm:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 self-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy response"
                      onClick={() => handleCopyMessage(msg.content || '', idx)}
                    >
                      {copiedMessageIdx === idx ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    {isLatestAssistant && !loading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Retry / Regenerate response"
                        onClick={handleRetryLastTurn}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}

                {/* User avatar */}
                {isUser && (
                  <div className="size-7 sm:size-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <UserIcon className="size-3.5 sm:size-4" />
                  </div>
                )}
              </div>

              {/* Timestamp */}
              {timeStr && (
                <span
                  className={`text-[10px] text-muted-foreground/60 ${isUser ? 'pr-8 sm:pr-10' : 'pl-8 sm:pl-10'}`}
                >
                  {timeStr}
                </span>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-center text-xs text-muted-foreground pl-1">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="size-4" />
            </div>
            <div className="flex items-center gap-2.5 bg-card border border-border/70 rounded-xl px-3.5 py-2.5 shadow-2xs">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Thinking & exploring workspace tools...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <div className="border-t border-border bg-card p-2.5 sm:p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2 sm:gap-2.5"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedWorkspaceId
                  ? 'Ask PMT Assistant anything...'
                  : 'Select a workspace first...'
              }
              disabled={loading || !selectedWorkspaceId}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 sm:px-3.5 sm:py-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] sm:min-h-[44px] max-h-[140px] leading-snug"
            />
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!inputMessage.trim() || loading || !selectedWorkspaceId}
            className="size-10 sm:size-11 rounded-xl shrink-0 shadow-xs"
            title="Send message"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>

      <AIChatSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
      />
    </div>
  );
};

export default AIChatView;
