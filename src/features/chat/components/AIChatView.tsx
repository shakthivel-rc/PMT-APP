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
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Eye,
  UploadCloud,
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
  uploadChatAttachmentApi,
  getChatAttachmentDownloadUrl,
  type ChatMessageItem,
  type ChatAttachmentSummary,
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

interface StagedAttachment {
  file: File;
  id?: string;
  uploading: boolean;
  error?: string;
  previewUrl?: string;
  summary?: ChatAttachmentSummary;
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (mimeType: string, filename: string) => {
  const lowerName = filename.toLowerCase();
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) {
    return <Eye className="size-4 text-sky-500 shrink-0" />;
  }
  if (mimeType.includes('csv') || /\.(csv|xlsx?)$/i.test(lowerName)) {
    return <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />;
  }
  if (mimeType.includes('json') || /\.(json|ya?ml|xml)$/i.test(lowerName)) {
    return <FileCode className="size-4 text-amber-500 shrink-0" />;
  }
  return <FileText className="size-4 text-indigo-500 shrink-0" />;
};

const EXAMPLE_PROMPTS = [
  'List all timesheets from 01-10-2026 to 10-10-2026',
  'What are the open high priority bugs in this workspace?',
  'Show active sprint progress and unassigned tickets',
  'Search knowledge docs for deployment instructions',
  'Drop an error screenshot or PRD to convert into issues',
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

  // Multimodal Staging, Drag & Drop, and Preview Modal
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; filename: string } | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    stagedAttachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setStagedAttachments([]);
    setPreviewImage(null);
    textareaRef.current?.focus();
  };

  const handleFilesSelected = (files: File[]) => {
    if (!selectedWorkspaceId) {
      toast.error('Please select a workspace before uploading files.');
      return;
    }

    const newStaged: StagedAttachment[] = files.map((file) => {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
      const previewUrl = isImg ? URL.createObjectURL(file) : undefined;
      return {
        file,
        uploading: true,
        previewUrl,
      };
    });

    setStagedAttachments((prev) => [...prev, ...newStaged]);

    newStaged.forEach(async (staged) => {
      try {
        const summary = await uploadChatAttachmentApi(selectedWorkspaceId, staged.file, conversationId);
        setStagedAttachments((prev) =>
          prev.map((item) =>
            item.file === staged.file
              ? { ...item, id: summary.id, uploading: false, summary }
              : item
          )
        );
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || err?.message || 'Upload failed';
        toast.error(`Failed to upload ${staged.file.name}: ${errMsg}`);
        setStagedAttachments((prev) =>
          prev.map((item) =>
            item.file === staged.file
              ? { ...item, uploading: false, error: errMsg }
              : item
          )
        );
      }
    });
  };

  const handleRemoveStaged = (index: number) => {
    setStagedAttachments((prev) => {
      const item = prev[index];
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          filesToUpload.push(file);
        }
      }
    }

    if (filesToUpload.length > 0) {
      e.preventDefault();
      handleFilesSelected(filesToUpload);
    }
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : inputMessage;
    const isAnyAttachmentUploading = stagedAttachments.some((a) => a.uploading);
    if (isAnyAttachmentUploading) {
      toast.info('Please wait for file attachments to finish uploading.');
      return;
    }

    const validAttachmentIds = stagedAttachments
      .map((a) => a.id)
      .filter((id): id is string => Boolean(id));
    const validAttachmentSummaries = stagedAttachments
      .map((a) => a.summary)
      .filter((s): s is ChatAttachmentSummary => Boolean(s));

    const effectiveText = textToSend.trim() || (validAttachmentIds.length > 0 ? 'Please inspect the attached file(s).' : '');
    if (!effectiveText || loading || !selectedWorkspaceId) return;

    const userMsg: ChatMessageItem = {
      role: 'user',
      content: effectiveText,
      attachments: validAttachmentSummaries.length > 0 ? validAttachmentSummaries : undefined,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (customMessage === undefined) {
      setInputMessage('');
    }
    setStagedAttachments([]);
    setLoading(true);

    try {
      const result = await sendChatTurn(selectedWorkspaceId, {
        message: effectiveText,
        conversation_id: conversationId,
        attachment_ids: validAttachmentIds.length > 0 ? validAttachmentIds : undefined,
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
    <div
      className="relative flex flex-col flex-1 h-full w-full bg-background border-border overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-6 text-center pointer-events-none">
          <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <UploadCloud className="size-8" />
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              Drop documents or images to convert into tickets or workspace resources
            </p>
            <p className="text-xs text-muted-foreground">
              Supports screenshots (PNG, JPG), specifications & PRDs (PDF, DOCX), and task sheets (CSV, JSON)
            </p>
          </div>
        </div>
      )}

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

                  {/* Message Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => {
                        const isImg =
                          att.mime_type.startsWith('image/') ||
                          /\.(png|jpe?g|gif|webp|svg)$/i.test(att.original_filename);
                        const downloadUrl = getChatAttachmentDownloadUrl(
                          selectedWorkspaceId,
                          att.id,
                        );
                        if (isImg) {
                          return (
                            <div
                              key={att.id}
                              className="group/img relative rounded-lg overflow-hidden border border-border/50 max-w-[200px] cursor-pointer bg-muted/40 hover:border-primary/50 transition-colors"
                              onClick={() =>
                                setPreviewImage({
                                  url: downloadUrl,
                                  filename: att.original_filename,
                                })
                              }
                              title={`View ${att.original_filename}`}
                            >
                              <img
                                src={downloadUrl}
                                alt={att.original_filename}
                                className="max-h-36 w-auto object-cover rounded-md"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white text-xs gap-1 font-medium">
                                <Eye className="size-3.5" />
                                <span>Preview</span>
                              </div>
                              <div className="p-1 text-[11px] truncate text-center bg-background/80 backdrop-blur-xs">
                                {att.original_filename}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <a
                            key={att.id}
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.original_filename}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                              isUser
                                ? 'bg-primary-foreground/15 border-primary-foreground/25 hover:bg-primary-foreground/25 text-primary-foreground'
                                : 'bg-muted/50 border-border/80 hover:bg-muted text-foreground'
                            }`}
                            title={`Download ${att.original_filename}`}
                          >
                            {getFileIcon(att.mime_type, att.original_filename)}
                            <span className="font-medium max-w-[140px] truncate">
                              {att.original_filename}
                            </span>
                            <span className="text-[10px] opacity-70">
                              ({formatFileSize(att.file_size_bytes)})
                            </span>
                            <Download className="size-3 opacity-60 ml-0.5" />
                          </a>
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
        {/* Staging preview tray */}
        {stagedAttachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2 p-2 bg-muted/40 border border-border/80 rounded-xl max-h-32 overflow-y-auto">
            {stagedAttachments.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-background rounded-lg border border-border/80 text-xs shadow-2xs relative group"
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="size-7 rounded object-cover border border-border/60"
                  />
                ) : (
                  getFileIcon(item.file.type, item.file.name)
                )}
                <div className="flex flex-col min-w-0 max-w-[120px]">
                  <span className="truncate font-medium text-[11px] text-foreground">
                    {item.file.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </span>
                </div>
                {item.uploading && (
                  <Loader2 className="size-3.5 animate-spin text-primary shrink-0 ml-1" />
                )}
                {item.error && (
                  <span className="text-destructive text-[10px] shrink-0 font-medium ml-1">
                    Failed
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveStaged(idx)}
                  className="size-4 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center shrink-0 ml-1 transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2 sm:gap-2.5"
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx,.txt,.csv,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
            id="chat-file-input"
          />

          {/* Paperclip Attachment Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading || !selectedWorkspaceId}
            onClick={() => fileInputRef.current?.click()}
            className="size-10 sm:size-11 rounded-xl shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Attach image or document (PRD, CSV backlog, screenshot)"
          >
            <Paperclip className="size-4" />
          </Button>

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                selectedWorkspaceId
                  ? 'Ask PMT Assistant, paste screenshot, or drop PRD / CSV...'
                  : 'Select a workspace first...'
              }
              disabled={loading || !selectedWorkspaceId}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 sm:px-3.5 sm:py-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] sm:min-h-[44px] max-h-[140px] leading-snug"
            />
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={
              (!inputMessage.trim() && stagedAttachments.length === 0) ||
              loading ||
              !selectedWorkspaceId ||
              stagedAttachments.some((a) => a.uploading)
            }
            className="size-10 sm:size-11 rounded-xl shrink-0 shadow-xs"
            title="Send message"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>

      {/* Image Full-Size Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center bg-card rounded-2xl border border-border/80 shadow-2xl p-3 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full px-2 pb-2 border-b border-border/60">
              <span className="text-xs font-medium truncate max-w-md">{previewImage.filename}</span>
              <div className="flex items-center gap-1.5">
                <a
                  href={previewImage.url}
                  download={previewImage.filename}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Download image"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Close preview"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={previewImage.url}
                alt={previewImage.filename}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      <AIChatSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
      />
    </div>
  );
};

export default AIChatView;
