import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import ConfirmCardView from './components/ConfirmCardView';
import UndoCardView from './components/UndoCardView';
import ClarificationCardView from './components/ClarificationCardView';

describe('Chat Components', () => {
  describe('<ConfirmCardView>', () => {
    it('renders T2 confirmation card and handles confirm/cancel', async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ConfirmCardView
          card={{
            tier: 'T2',
            tool_name: 'sprint_start',
            summary: 'Start sprint Sprint 1',
            confirm_id: 'tok-123',
            resolved_args: { sprint_id: 's-1' },
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Action Confirmation Required')).toBeInTheDocument();
      expect(screen.getByText('Start sprint Sprint 1')).toBeInTheDocument();
      expect(screen.getByText('T2')).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /confirm & execute/i });
      await user.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledWith('tok-123', '');

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledWith('tok-123');
    });

    it('renders T3 typed confirmation card requiring exact match', async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ConfirmCardView
          card={{
            tier: 'T3',
            tool_name: 'project_delete',
            summary: 'Delete project Mobile App',
            confirm_id: 'tok-456',
            required_typed_text: 'DELETE MOBILE',
            resolved_args: {},
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Destructive Action Confirmation')).toBeInTheDocument();
      expect(screen.getByText('DELETE MOBILE')).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /confirm permanent action/i });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText('Type "DELETE MOBILE" to confirm');
      await user.type(input, 'DELETE MOBILE');
      expect(confirmBtn).not.toBeDisabled();

      await user.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledWith('tok-456', 'DELETE MOBILE');
    });
  });

  describe('<UndoCardView>', () => {
    it('renders undo card and triggers undo callback', async () => {
      const onUndo = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <UndoCardView
          action={{
            tool_name: 'issue_update',
            undo_id: 'undo-789',
            description: 'Revert issue status change',
          }}
          onUndo={onUndo}
        />
      );

      expect(screen.getByText('Revert issue status change')).toBeInTheDocument();
      const undoBtn = screen.getByRole('button', { name: /undo/i });
      await user.click(undoBtn);
      expect(onUndo).toHaveBeenCalledWith('undo-789');
    });
  });

  describe('<ClarificationCardView>', () => {
    it('renders options and selects an option', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ClarificationCardView
          clarification={{
            question: 'Which sprint did you mean?',
            options: ['Sprint 1 (Active)', 'Sprint 2 (Planning)'],
          }}
          onSelectOption={onSelect}
        />
      );

      expect(screen.getByText('Which sprint did you mean?')).toBeInTheDocument();
      const optBtn = screen.getByRole('button', { name: 'Sprint 1 (Active)' });
      await user.click(optBtn);
      expect(onSelect).toHaveBeenCalledWith('Sprint 1 (Active)');
    });
  });

  describe('<AIChatSettingsModal>', () => {
    it('loads settings and discovers models when test button is clicked', async () => {
      const chatApi = await import('@/api/chat');
      vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
        provider: 'google',
        model: 'gemini-1.5-pro',
        base_url: null,
        has_api_key: true,
        api_key_masked: 'AIzaSy...XYZ',
      });
      vi.spyOn(chatApi, 'fetchAvailableModels').mockResolvedValue({
        provider: 'google',
        models: [
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next gen fast model', is_recommended: true },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Standard pro model', is_recommended: false },
        ],
        default_model: 'gemini-2.0-flash',
      });
      vi.spyOn(chatApi, 'updateChatSettings').mockResolvedValue({
        provider: 'google',
        model: 'gemini-2.0-flash',
        base_url: null,
        has_api_key: true,
        api_key_masked: 'AIzaSy...XYZ',
      });

      const { AIChatSettingsModal } = await import('./components/AIChatSettingsModal');
      const onOpenChange = vi.fn();
      const onSettingsUpdated = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <AIChatSettingsModal
          open={true}
          onOpenChange={onOpenChange}
          onSettingsUpdated={onSettingsUpdated}
        />
      );

      expect(await screen.findByText('AI Chat Model & Credentials')).toBeInTheDocument();
      expect(await screen.findByText(/Configured \(AIzaSy\.\.\.XYZ\)/i)).toBeInTheDocument();
      expect(await screen.findByText(/Found 2 available models for GOOGLE/i)).toBeInTheDocument();

      const keyInput = screen.getByPlaceholderText('Enter new key to replace existing');
      await user.type(keyInput, 'new-secret-key-123');

      const testBtn = screen.getByRole('button', { name: /test & find models/i });
      await user.click(testBtn);

      expect(chatApi.fetchAvailableModels).toHaveBeenCalledWith({
        provider: 'google',
        api_key: 'new-secret-key-123',
        base_url: undefined,
      });

      const saveBtn = screen.getByRole('button', { name: /save ai settings/i });
      await user.click(saveBtn);

      expect(chatApi.updateChatSettings).toHaveBeenCalled();
      expect(onSettingsUpdated).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('allows deleting credentials with confirmation', async () => {
      const chatApi = await import('@/api/chat');
      vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
        provider: 'google',
        model: 'gemini-1.5-pro',
        base_url: null,
        has_api_key: true,
        api_key_masked: 'AIzaSy...XYZ',
      });
      vi.spyOn(chatApi, 'fetchAvailableModels').mockResolvedValue({
        provider: 'google',
        models: [],
        default_model: 'gemini-1.5-pro',
      });
      vi.spyOn(chatApi, 'deleteChatSettings').mockResolvedValue();

      const { AIChatSettingsModal } = await import('./components/AIChatSettingsModal');
      const onOpenChange = vi.fn();
      const onSettingsUpdated = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <AIChatSettingsModal
          open={true}
          onOpenChange={onOpenChange}
          onSettingsUpdated={onSettingsUpdated}
        />
      );

      expect(await screen.findByText('AI Chat Model & Credentials')).toBeInTheDocument();
      expect(await screen.findByText(/Configured \(AIzaSy\.\.\.XYZ\)/i)).toBeInTheDocument();

      const deleteBtn = screen.getByRole('button', { name: /delete credentials/i });
      await user.click(deleteBtn);

      expect(await screen.findByText('Delete AI Credentials?')).toBeInTheDocument();

      const confirmDeleteBtn = screen.getByRole('button', { name: /^delete credentials$/i });
      await user.click(confirmDeleteBtn);

      expect(chatApi.deleteChatSettings).toHaveBeenCalled();
      expect(onSettingsUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          has_api_key: false,
          api_key_masked: null,
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('<AIChatView> Multimodal Attachments', () => {
    it('renders paperclip button, hidden file input, and stages uploaded files', async () => {
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
      vi.spyOn(chatApi, 'uploadChatAttachmentApi').mockResolvedValue({
        id: 'att-555',
        original_filename: 'crash_screenshot.png',
        mime_type: 'image/png',
        file_size_bytes: 45000,
        created_at: new Date().toISOString(),
      });
      vi.spyOn(chatApi, 'sendChatTurn').mockResolvedValue({
        conversation_id: 'conv-1',
        reply: 'I have inspected your crash screenshot and created ticket MOB-12.',
        tool_calls_executed: [],
      });
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-1', title: 'Test Conv', created_at: '', updated_at: '' },
        messages: [],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();

      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      // Verify paperclip button is present
      const attachBtn = await screen.findByTitle(/attach image or document/i);
      expect(attachBtn).toBeInTheDocument();

      // Verify file input exists
      const fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', 'image/*,.pdf,.docx,.txt,.csv,.json');

      // Upload a fake screenshot file
      const fakeFile = new File(['fake-png-content'], 'crash_screenshot.png', {
        type: 'image/png',
      });
      await user.upload(fileInput, fakeFile);

      // Verify uploadChatAttachmentApi was invoked
      expect(chatApi.uploadChatAttachmentApi).toHaveBeenCalledWith(
        'ws-101',
        expect.any(File),
        undefined
      );

      // Verify staged item chip appears
      expect(await screen.findByText('crash_screenshot.png')).toBeInTheDocument();

      // Send the turn with the attachment
      const sendBtn = screen.getByTitle('Send message');
      expect(sendBtn).not.toBeDisabled();
      await user.click(sendBtn);

      // Verify sendChatTurn called with attachment_ids
      expect(chatApi.sendChatTurn).toHaveBeenCalledWith(
        'ws-101',
        expect.objectContaining({
          attachment_ids: ['att-555'],
        })
      );
    });

    it('renders message attachment preview chip and download link', async () => {
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
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-10', title: 'Doc Ingestion', created_at: '', updated_at: '' },
        messages: [
          {
            role: 'user',
            content: 'Please scaffold from this spec',
            attachments: [
              {
                id: 'att-doc-1',
                original_filename: 'spec_v1.pdf',
                mime_type: 'application/pdf',
                file_size_bytes: 125000,
                created_at: new Date().toISOString(),
              },
            ],
          },
        ],
      });

      const { AIChatView } = await import('./components/AIChatView');
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" initialConversationId="conv-10" />);

      expect(await screen.findByText('spec_v1.pdf')).toBeInTheDocument();
      const downloadLink = screen.getByTitle('Download spec_v1.pdf');
      expect(downloadLink).toBeInTheDocument();
      expect(downloadLink).toHaveAttribute('href', expect.stringContaining('/chat/attachments/att-doc-1'));
    });

    it('handles drag-and-drop overlay and stages dropped files', async () => {
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
      vi.spyOn(chatApi, 'uploadChatAttachmentApi').mockResolvedValue({
        id: 'att-dnd-1',
        original_filename: 'dropped_spec.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 84000,
        created_at: new Date().toISOString(),
      });

      const { AIChatView } = await import('./components/AIChatView');
      const { fireEvent } = await import('@testing-library/react');
      const { container } = renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const dropZone = container.firstChild as HTMLElement;

      // Drag enter
      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      });

      expect(
        await screen.findByText('Drop documents or images to convert into tickets or workspace resources')
      ).toBeInTheDocument();

      // Drag leave
      fireEvent.dragLeave(dropZone);
      expect(
        screen.queryByText('Drop documents or images to convert into tickets or workspace resources')
      ).not.toBeInTheDocument();

      // Drop file
      const fakeFile = new File(['pdf-content'], 'dropped_spec.pdf', { type: 'application/pdf' });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [fakeFile],
        },
      });

      expect(chatApi.uploadChatAttachmentApi).toHaveBeenCalledWith(
        'ws-101',
        expect.any(File),
        undefined
      );
      expect(await screen.findByText('dropped_spec.pdf')).toBeInTheDocument();
    });

    it('handles clipboard screenshot paste in composer textarea', async () => {
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
      vi.spyOn(chatApi, 'uploadChatAttachmentApi').mockResolvedValue({
        id: 'att-paste-1',
        original_filename: 'pasted_screenshot.png',
        mime_type: 'image/png',
        file_size_bytes: 52000,
        created_at: new Date().toISOString(),
      });

      const { AIChatView } = await import('./components/AIChatView');
      const { fireEvent } = await import('@testing-library/react');
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const textarea = await screen.findByPlaceholderText(
        'Ask PMT Assistant, paste screenshot, or drop PRD / CSV...'
      );

      const fakeImageFile = new File(['png-data'], 'pasted_screenshot.png', { type: 'image/png' });
      fireEvent.paste(textarea, {
        clipboardData: {
          items: [
            {
              kind: 'file',
              getAsFile: () => fakeImageFile,
            },
          ],
        },
      });

      expect(chatApi.uploadChatAttachmentApi).toHaveBeenCalledWith(
        'ws-101',
        expect.any(File),
        undefined
      );
      expect(await screen.findByText('pasted_screenshot.png')).toBeInTheDocument();
    });

    it('opens full-size image lightbox modal on thumbnail click and closes on close button', async () => {
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
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-img', title: 'Image Preview', created_at: '', updated_at: '' },
        messages: [
          {
            role: 'user',
            content: 'Look at this error image',
            attachments: [
              {
                id: 'att-img-99',
                original_filename: 'error_dialog.png',
                mime_type: 'image/png',
                file_size_bytes: 40000,
                created_at: new Date().toISOString(),
              },
            ],
          },
        ],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" initialConversationId="conv-img" />);

      const thumbnail = await screen.findByTitle('View error_dialog.png');
      expect(thumbnail).toBeInTheDocument();

      // Click to open lightbox modal
      await user.click(thumbnail);

      // Lightbox header should show filename
      expect(await screen.findByTitle('Close preview')).toBeInTheDocument();
      expect(screen.getByTitle('Download image')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByTitle('Close preview');
      await user.click(closeBtn);

      expect(screen.queryByTitle('Close preview')).not.toBeInTheDocument();
    });

    it('allows removing a staged attachment from the tray', async () => {
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
      vi.spyOn(chatApi, 'uploadChatAttachmentApi').mockResolvedValue({
        id: 'att-remove-1',
        original_filename: 'file_to_remove.txt',
        mime_type: 'text/plain',
        file_size_bytes: 1200,
        created_at: new Date().toISOString(),
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
      const fakeFile = new File(['text'], 'file_to_remove.txt', { type: 'text/plain' });
      await user.upload(fileInput, fakeFile);

      expect(await screen.findByText('file_to_remove.txt')).toBeInTheDocument();

      // Click remove button
      const removeBtn = screen.getByTitle('Remove attachment');
      await user.click(removeBtn);

      expect(screen.queryByText('file_to_remove.txt')).not.toBeInTheDocument();
    });
  });

  describe('<AIChatView> Interactions, Composer, and Error States', () => {
    it('disables send button when textarea is empty and enables on text input', async () => {
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
      vi.spyOn(chatApi, 'sendChatTurn').mockResolvedValue({
        conversation_id: 'conv-new',
        reply: 'Ticket created successfully.',
        tool_calls_executed: [],
      });
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-new', title: 'New Conv', created_at: '', updated_at: '' },
        messages: [],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const sendBtn = screen.getByTitle('Send message');
      expect(sendBtn).toBeDisabled();

      const textarea = await screen.findByPlaceholderText(
        'Ask PMT Assistant, paste screenshot, or drop PRD / CSV...'
      );
      await user.type(textarea, 'Create ticket for user registration');
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);
      expect(chatApi.sendChatTurn).toHaveBeenCalledWith(
        'ws-101',
        expect.objectContaining({
          message: 'Create ticket for user registration',
        })
      );
    });

    it('renders starter prompt suggestions and clicking one submits prompt', async () => {
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
      vi.spyOn(chatApi, 'sendChatTurn').mockResolvedValue({
        conversation_id: 'conv-starter',
        reply: 'Here are the open high priority bugs.',
        tool_calls_executed: [],
      });
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-starter', title: 'Starter Conv', created_at: '', updated_at: '' },
        messages: [],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const starterPrompt = await screen.findByText('What are the open high priority bugs in this workspace?');
      expect(starterPrompt).toBeInTheDocument();

      await user.click(starterPrompt);
      expect(chatApi.sendChatTurn).toHaveBeenCalledWith(
        'ws-101',
        expect.objectContaining({
          message: 'What are the open high priority bugs in this workspace?',
        })
      );
    });

    it('displays missing API key banner and opens settings modal on configure click', async () => {
      const chatApi = await import('@/api/chat');
      const workspacesApi = await import('@/api/workspaces');

      vi.spyOn(workspacesApi, 'fetchWorkspacesApi').mockResolvedValue([
        { id: 'ws-101', name: 'Mobile App', slug: 'mobile-app', is_admin: true } as any,
      ]);
      vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
        provider: 'google',
        model: 'gemini-1.5-pro',
        has_api_key: false,
      });
      vi.spyOn(chatApi, 'fetchAvailableModels').mockResolvedValue({
        provider: 'google',
        models: [],
        default_model: 'gemini-1.5-pro',
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      expect(
        await screen.findByText(/AI model credentials are not configured yet/i)
      ).toBeInTheDocument();

      const configBtn = screen.getByRole('button', { name: /^Configure$/i });
      await user.click(configBtn);

      expect(await screen.findByText('AI Chat Model & Credentials')).toBeInTheDocument();
    });

    it('displays error message bubble when sendChatTurn fails', async () => {
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
      vi.spyOn(chatApi, 'sendChatTurn').mockRejectedValue(
        new Error('Network timeout contacting LLM gateway')
      );

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" />);

      const textarea = await screen.findByPlaceholderText(
        'Ask PMT Assistant, paste screenshot, or drop PRD / CSV...'
      );
      await user.type(textarea, 'Test failure query');

      const sendBtn = screen.getByTitle('Send message');
      await user.click(sendBtn);

      expect(
        await screen.findByText(/⚠️ Error: Network timeout contacting LLM gateway/i)
      ).toBeInTheDocument();
    });

    it('supports copying message to clipboard and reusing prompt in composer', async () => {
      const chatApi = await import('@/api/chat');
      const workspacesApi = await import('@/api/workspaces');

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      vi.spyOn(workspacesApi, 'fetchWorkspacesApi').mockResolvedValue([
        { id: 'ws-101', name: 'Mobile App', slug: 'mobile-app', is_admin: true } as any,
      ]);
      vi.spyOn(chatApi, 'fetchChatSettings').mockResolvedValue({
        provider: 'google',
        model: 'gemini-1.5-pro',
        has_api_key: true,
      });
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-copy', title: 'Copy Test', created_at: '', updated_at: '' },
        messages: [
          {
            role: 'user',
            content: 'How many story points are closed in Sprint 4?',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const { fireEvent } = await import('@testing-library/react');
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" initialConversationId="conv-copy" />);

      expect(await screen.findByText('How many story points are closed in Sprint 4?')).toBeInTheDocument();

      const copyBtn = screen.getByTitle('Copy prompt');
      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalledWith(
        'How many story points are closed in Sprint 4?'
      );

      const reuseBtn = screen.getByTitle('Edit / reuse prompt in composer');
      fireEvent.click(reuseBtn);

      const textarea = screen.getByPlaceholderText(
        'Ask PMT Assistant, paste screenshot, or drop PRD / CSV...'
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('How many story points are closed in Sprint 4?');
    });

    it('retries the last user turn when retry button is clicked', async () => {
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
      vi.spyOn(chatApi, 'fetchConversationHistory').mockResolvedValue({
        conversation: { id: 'conv-retry', title: 'Retry Test', created_at: '', updated_at: '' },
        messages: [
          {
            role: 'user',
            content: 'Fetch sprint velocity',
            created_at: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: 'Sprint velocity is 42 points.',
            created_at: new Date().toISOString(),
          },
        ],
      });
      vi.spyOn(chatApi, 'sendChatTurn').mockResolvedValue({
        conversation_id: 'conv-retry',
        reply: 'Updated sprint velocity is 44 points.',
        tool_calls_executed: [],
      });

      const { AIChatView } = await import('./components/AIChatView');
      const user = userEvent.setup();
      renderWithProviders(<AIChatView initialWorkspaceId="ws-101" initialConversationId="conv-retry" />);

      const retryBtn = await screen.findByTitle('Retry / Regenerate response');
      await user.click(retryBtn);

      expect(chatApi.sendChatTurn).toHaveBeenCalledWith(
        'ws-101',
        expect.objectContaining({
          message: 'Fetch sprint velocity',
        })
      );
    });
  });

  describe('<AIChatDrawer>', () => {
    it('renders floating action button and opens dialog on click', async () => {
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

      const { AIChatDrawer } = await import('./components/AIChatDrawer');
      const user = userEvent.setup();
      renderWithProviders(<AIChatDrawer />);

      const fab = screen.getByTitle('Open AI Chat Assistant');
      expect(fab).toBeInTheDocument();

      await user.click(fab);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('PMT AI Assistant').length).toBeGreaterThan(0);
    });
  });
});


