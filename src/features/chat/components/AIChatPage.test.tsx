import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import { fireEvent, waitFor } from '@testing-library/react';
import AIChatPage from './AIChatPage';

describe('<AIChatPage>', () => {
  it('loads workspaces, displays conversations, and handles new chat creation', async () => {
    const chatApi = await import('@/api/chat');
    const workspacesApi = await import('@/api/workspaces');

    vi.spyOn(workspacesApi, 'fetchWorkspacesApi').mockResolvedValue([
      { id: 'ws-101', name: 'Mobile App', slug: 'mobile-app', is_admin: true } as any,
    ]);
    vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
      provider: 'google',
      model: 'gemini-1.5-pro',
      has_api_key: true,
    });
    vi.spyOn(chatApi, 'fetchConversations').mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Sprint Planning Q4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'conv-2',
        title: 'Bug Triage Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
      conversation: { id: 'conv-1', title: 'Sprint Planning Q4', created_at: '', updated_at: '' },
      messages: [
        {
          role: 'user',
          content: 'Hello PMT',
          created_at: new Date().toISOString(),
        },
      ],
    });

    const user = userEvent.setup();
    renderWithProviders(<AIChatPage />);

    // Check workspace & conversation list
    expect(await screen.findByText('Sprint Planning Q4')).toBeInTheDocument();
    expect(screen.getByText('Bug Triage Session')).toBeInTheDocument();

    // Select second conversation
    const conv2Item = screen.getByText('Bug Triage Session');
    await user.click(conv2Item);

    // Click "New Chat"
    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    await user.click(newChatBtn);

    // Verify "How can I help with your project today?" starter screen is visible
    expect(await screen.findByText('How can I help with your project today?')).toBeInTheDocument();
  });

  it('allows deleting a conversation with optimistic removal and delete API call', async () => {
    const chatApi = await import('@/api/chat');
    const workspacesApi = await import('@/api/workspaces');

    vi.spyOn(workspacesApi, 'fetchWorkspacesApi').mockResolvedValue([
      { id: 'ws-101', name: 'Mobile App', slug: 'mobile-app', is_admin: true } as any,
    ]);
    vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
      provider: 'google',
      model: 'gemini-1.5-pro',
      has_api_key: true,
    });
    vi.spyOn(chatApi, 'fetchConversations').mockResolvedValue([
      {
        id: 'conv-to-delete',
        title: 'Temporary Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    vi.spyOn(chatApi, 'deleteConversation').mockResolvedValue();

    renderWithProviders(<AIChatPage />);

    expect(await screen.findByText('Temporary Session')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('Delete chat');
    fireEvent.click(deleteBtn);

    expect(chatApi.deleteConversation).toHaveBeenCalledWith('ws-101', 'conv-to-delete');
    await waitFor(() => {
      expect(screen.queryByText('Temporary Session')).not.toBeInTheDocument();
    });
  });

  it('supports collapsing and expanding the conversation history sidebar', async () => {
    const chatApi = await import('@/api/chat');
    const workspacesApi = await import('@/api/workspaces');

    vi.spyOn(workspacesApi, 'fetchWorkspacesApi').mockResolvedValue([
      { id: 'ws-101', name: 'Mobile App', slug: 'mobile-app', is_admin: true } as any,
    ]);
    vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
      provider: 'google',
      model: 'gemini-1.5-pro',
      has_api_key: true,
    });
    vi.spyOn(chatApi, 'fetchConversations').mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithProviders(<AIChatPage />);

    expect(await screen.findByText('Conversations')).toBeInTheDocument();

    // Collapse sidebar
    const collapseBtn = screen.getByTitle('Collapse history');
    await user.click(collapseBtn);

    // Sidebar button in AIChatView header should now show "Show conversations"
    const expandBtn = screen.getByTitle('Show conversations');
    expect(expandBtn).toBeInTheDocument();

    // Click to expand again
    await user.click(expandBtn);
    expect(screen.getByTitle('Collapse history')).toBeInTheDocument();
  });
});
