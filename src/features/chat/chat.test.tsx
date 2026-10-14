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
});

