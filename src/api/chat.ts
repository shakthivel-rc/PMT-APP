import { api } from './client';

export interface ChatTurnRequest {
  message?: string;
  conversation_id?: string;
  confirm_action_id?: string;
  confirm_typed_text?: string;
  cancel_action_id?: string;
  undo_action_id?: string;
  context_vars?: Record<string, any>;
}

export interface ConfirmCard {
  confirm_id: string;
  tool_name: string;
  tier: 'T2' | 'T3';
  summary: string;
  resolved_args: Record<string, any>;
  preview_data?: Record<string, any>;
  danger_warning?: string;
  required_typed_text?: string;
  diff?: Record<string, any>;
  expires_at?: string;
}

export interface UndoAction {
  undo_id: string;
  tool_name: string;
  description: string;
  expires_at?: string;
}

export interface Clarification {
  question?: string;
  options?: any[];
  candidates?: any[];
  tool_name?: string;
  raw_args?: Record<string, any>;
  ambiguous_entity?: string;
}

export interface ToolCallExecuted {
  tool: string;
  args?: Record<string, any>;
  outcome?: string;
}

export interface ChatTurnResult {
  conversation_id?: string;
  reply?: string;
  tool_calls_executed: ToolCallExecuted[];
  confirm_card?: ConfirmCard | null;
  undo_action?: UndoAction | null;
  clarification?: Clarification | null;
  error?: string | null;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageItem {
  id?: string;
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  confirm_card?: ConfirmCard | null;
  undo_action?: UndoAction | null;
  clarification?: Clarification | null;
  created_at?: string;
}

export interface ChatSettings {
  provider: string; // 'openai' | 'anthropic' | 'google'
  model: string;
  base_url?: string | null;
  has_api_key: boolean;
  api_key_masked?: string | null;
}

export interface ChatSettingsUpdate {
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
}

export interface ChatToolInfo {
  name: string;
  category: string;
  description: string;
  exposure: string;
  tier: string;
  confirm: string;
  is_core: boolean;
  is_virtual: boolean;
}

export async function sendChatTurn(workspaceId: string, req: ChatTurnRequest): Promise<ChatTurnResult> {
  const res = await api.post<ChatTurnResult>(`/workspaces/${workspaceId}/chat`, req, { timeoutMs: 120_000 });
  return res.data;
}

export async function fetchConversations(workspaceId: string): Promise<ChatConversationSummary[]> {
  const res = await api.get<ChatConversationSummary[]>(`/workspaces/${workspaceId}/chat/conversations`);
  return res.data;
}

export async function fetchConversationHistory(
  workspaceId: string,
  conversationId: string,
): Promise<{ conversation: ChatConversationSummary; messages: ChatMessageItem[] }> {
  const res = await api.get<{ conversation: ChatConversationSummary; messages: ChatMessageItem[] }>(
    `/workspaces/${workspaceId}/chat/conversations/${conversationId}`,
  );
  return res.data;
}

export async function deleteConversation(workspaceId: string, conversationId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/chat/conversations/${conversationId}`);
}

export async function fetchChatSettings(): Promise<ChatSettings> {
  const res = await api.get<ChatSettings>('/user/chat-settings');
  return res.data;
}

export async function updateChatSettings(settings: ChatSettingsUpdate): Promise<ChatSettings> {
  const res = await api.put<ChatSettings>('/user/chat-settings', settings);
  return res.data;
}

export async function deleteChatSettings(): Promise<void> {
  await api.delete('/user/chat-settings');
}

export async function fetchChatTools(workspaceId: string): Promise<ChatToolInfo[]> {
  const res = await api.get<ChatToolInfo[]>(`/workspaces/${workspaceId}/chat/tools`);
  return res.data;
}

export interface DiscoveredModelInfo {
  id: string;
  name: string;
  description?: string;
  is_recommended?: boolean;
}

export interface FetchModelsResult {
  provider: string;
  models: DiscoveredModelInfo[];
  default_model: string;
}

export async function fetchAvailableModels(payload: {
  provider: string;
  api_key?: string;
  base_url?: string;
}): Promise<FetchModelsResult> {
  const res = await api.post<FetchModelsResult>('/user/chat-settings/fetch-models', payload);
  return res.data;
}
