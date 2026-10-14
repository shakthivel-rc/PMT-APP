import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import type { MemberSummary, RepositorySummary, SpaceDetail, SpaceNode } from '@/types';
import type { WorkflowDefinition, WorkflowEditor as WorkflowEditorType } from '@/types/workflow';
import SpaceSettings from './SpaceSettings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const mockSpace: SpaceNode = {
  id: 'sp1',
  name: 'Core Platform',
  key: 'COR',
  description: 'Main platform backend services',
  owner: { id: 'u1', display_name: 'Ada Lovelace' },
  delivery_method: 'scrum',
  has_charter: true,
  archived: false,
  archived_at: null,
  frozen: false,
  freeze_reason: null,
  statuses: [],
  workflow: {
    version: 1,
    transition_mode: 'any',
    initial_status_id: 'st-todo',
    wip_policy: 'warn',
    merge_action: { mode: 'status', target_status_id: 'st-done' },
    transitions: [],
  },
  can_edit_workflow: true,
  folders: [],
  lists: [],
};

const mockSpaceDetail: SpaceDetail = {
  ...mockSpace,
  key_aliases: ['CORE', 'CP'],
  charter: {
    objective: 'Standardize API platform',
    success_measure: 'Zero regression incidents',
    delivery_team: null,
    scope: 'Core backend services',
    exclusions: null,
    access_requirements: null,
    reuse_justification: 'Distinct architecture team',
    canonical_lists: null,
    epic_completion_criteria: null,
    initial_backlog: null,
    reporting_cadence: null,
    retention_policy: null,
    notes: null,
  },
  created_at: '2026-01-01T00:00:00Z',
  frozen_at: null,
  frozen_by_plan_id: null,
};

const mockWorkflow: WorkflowDefinition = {
  space_id: 'sp1',
  version: 1,
  transition_mode: 'any',
  initial_status_id: 'st-todo',
  wip_policy: 'warn',
  merge_action: { mode: 'status', target_status_id: 'st-done' },
  stages: [
    {
      id: 'st-todo',
      name: 'To Do',
      category: 'todo',
      color: 'neutral',
      position: 0,
      counts_toward_wip: false,
      wip_limit: null,
      issue_count: 0,
      wip_count: 0,
    },
    {
      id: 'st-done',
      name: 'Done',
      category: 'done',
      color: 'success',
      position: 1,
      counts_toward_wip: false,
      wip_limit: null,
      issue_count: 0,
      wip_count: 0,
    },
  ],
  transitions: [],
  can_edit: true,
  editors: [],
};

const mockMembers: MemberSummary[] = [
  { user_id: 'u1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', role: 'admin' },
  { user_id: 'u2', email: 'grace@example.com', first_name: 'Grace', last_name: 'Hopper', role: 'member' },
  { user_id: 'u3', email: 'alan@example.com', first_name: 'Alan', last_name: 'Turing', role: 'member' },
];

const mockWorkflowEditors: WorkflowEditorType[] = [
  {
    user: { id: 'u2', display_name: 'Grace Hopper' },
    role: 'member',
  },
];

const mockRepositories: RepositorySummary[] = [
  {
    id: 'repo-1',
    provider: 'github',
    full_name: 'acme/core-platform',
    created_at: '2026-01-10T10:00:00Z',
  },
];

describe('<SpaceSettings>', () => {
  beforeEach(() => {
    server.use(
      http.get('*/workspaces/w1/workflow-templates', () => ok([])),
      http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok(mockWorkflow)),
      http.get('*/workspaces/w1/spaces/sp1', () => ok(mockSpaceDetail)),
      http.get('*/workspaces/w1/members', () => ok(mockMembers)),
      http.get('*/workspaces/w1/spaces/sp1/workflow/editors', () => ok(mockWorkflowEditors)),
      http.get('*/workspaces/w1/repositories', () => ok(mockRepositories)),
    );
  });

  it('renders navigation sidebar and workflow section by default', async () => {
    renderWithProviders(
      <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
    );

    expect(screen.getByRole('navigation', { name: /settings navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workflows & statuses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /general & charter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /members & permissions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /integrations \(github\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /danger zone/i })).toBeInTheDocument();

    expect(await screen.findByText('Space Workflow Configuration')).toBeInTheDocument();
  });

  describe('General & Charter Section', () => {
    it('displays loaded space details, key aliases, and saves changes', async () => {
      let patchBody: unknown;
      const onChanged = vi.fn().mockResolvedValue(undefined);

      server.use(
        http.patch('*/workspaces/w1/spaces/sp1', async ({ request }) => {
          patchBody = await request.json();
          return ok({ ...mockSpaceDetail, name: 'Core Platform v2' });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={onChanged} />,
      );

      const generalBtn = screen.getByRole('button', { name: /general & charter/i });
      await user.click(generalBtn);

      const nameInput = await screen.findByLabelText(/space name/i);
      expect(nameInput).toHaveValue('Core Platform');

      const keyInput = screen.getByLabelText(/issue key prefix/i);
      expect(keyInput).toHaveValue('COR');

      // Key aliases displayed
      expect(screen.getByText('Previous aliases:')).toBeInTheDocument();
      expect(screen.getByText('CORE')).toBeInTheDocument();
      expect(screen.getByText('CP')).toBeInTheDocument();

      // Charter inputs
      const objectiveInput = screen.getByLabelText(/business objective/i);
      expect(objectiveInput).toHaveValue('Standardize API platform');

      const metricInput = screen.getByLabelText(/success measure/i);
      expect(metricInput).toHaveValue('Zero regression incidents');

      // Update name and objective
      await user.clear(nameInput);
      await user.type(nameInput, 'Core Platform v2');

      await user.clear(objectiveInput);
      await user.type(objectiveInput, 'Scale API to 10k RPS');

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(onChanged).toHaveBeenCalled();
      });

      expect(patchBody).toMatchObject({
        name: 'Core Platform v2',
        key: 'COR',
        charter: {
          objective: 'Scale API to 10k RPS',
        },
      });
    });

    it('validates key prefix format and shows validation error on invalid input', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /general & charter/i }));

      const keyInput = await screen.findByLabelText(/issue key prefix/i);
      await user.clear(keyInput);
      await user.type(keyInput, 'A');

      expect(
        screen.getByText('Use at least 2 characters.'),
      ).toBeInTheDocument();

      await user.clear(keyInput);
      await user.type(keyInput, '123');

      expect(
        screen.getByText('Start with a letter.'),
      ).toBeInTheDocument();
    });

    it('renders form inputs as disabled for non-manager members', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="member" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /general & charter/i }));

      const nameInput = await screen.findByLabelText(/space name/i);
      expect(nameInput).toBeDisabled();
      expect(screen.getByLabelText(/issue key prefix/i)).toBeDisabled();
      expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    });
  });

  describe('Members & Permissions Section', () => {
    it('allows inviting a new team member', async () => {
      let postBody: unknown;
      server.use(
        http.post('*/workspaces/w1/members', async ({ request }) => {
          postBody = await request.json();
          return ok(
            {
              user_id: 'u4',
              email: 'newuser@example.com',
              first_name: 'New',
              last_name: 'User',
              role: 'member',
            },
            201,
          );
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /members & permissions/i }));

      const emailInput = await screen.findByLabelText(/invite by email/i);
      await user.type(emailInput, 'newuser@example.com');

      const addBtn = screen.getByRole('button', { name: /add member/i });
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText('New User')).toBeInTheDocument();
      });

      expect(postBody).toEqual({ email: 'newuser@example.com', role: 'member' });
    });

    it('allows removing a member with ConfirmDialog', async () => {
      let deletedUserId: string | undefined;
      server.use(
        http.delete('*/workspaces/w1/members/:userId', ({ params }) => {
          deletedUserId = String(params.userId);
          return ok({ success: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /members & permissions/i }));

      expect(await screen.findByText('Alan Turing')).toBeInTheDocument();
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[removeButtons.length - 1]);

      expect(screen.getByText(/remove alan turing from project\?/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: 'Remove Member' });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText('Alan Turing')).not.toBeInTheDocument();
      });

      expect(deletedUserId).toBe('u3');
    });

    it('displays editors list and allows granting workflow edit access', async () => {
      let putBody: unknown;
      server.use(
        http.put('*/workspaces/w1/spaces/sp1/workflow/editors', async ({ request }) => {
          putBody = await request.json();
          return ok([
            ...mockWorkflowEditors,
            { user: { id: 'u3', display_name: 'Alan Turing' }, role: 'member' },
          ]);
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /members & permissions/i }));

      // Existing editor displayed
      expect((await screen.findAllByText('Grace Hopper')).length).toBeGreaterThan(0);

      // Select member to grant
      const select = screen.getByRole('combobox', {
        name: /select member to grant edit permissions/i,
      });
      await user.selectOptions(select, 'u3');

      const grantBtn = screen.getByRole('button', { name: /grant workflow access/i });
      expect(grantBtn).toBeEnabled();
      await user.click(grantBtn);

      await waitFor(() => {
        expect(screen.getAllByText('Alan Turing').length).toBe(2);
      });

      expect(putBody).toEqual({ user_ids: ['u2', 'u3'] });
    });

    it('allows revoking workflow editor permissions with ConfirmDialog', async () => {
      let putBody: unknown;
      server.use(
        http.put('*/workspaces/w1/spaces/sp1/workflow/editors', async ({ request }) => {
          putBody = await request.json();
          return ok([]);
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /members & permissions/i }));

      expect((await screen.findAllByText('Grace Hopper')).length).toBeGreaterThan(0);

      const revokeBtn = screen.getByRole('button', { name: /revoke/i });
      await user.click(revokeBtn);

      // ConfirmDialog shown
      expect(
        screen.getByText(/revoke workflow editing from grace hopper\?/i),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: 'Revoke Access' });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/no individual workflow editors granted/i),
        ).toBeInTheDocument();
      });

      expect(putBody).toEqual({ user_ids: [] });
    });
  });

  describe('Integrations (GitHub) Section', () => {
    it('displays linked repositories and allows linking a new GitHub repository', async () => {
      let postBody: unknown;
      server.use(
        http.post('*/workspaces/w1/repositories', async ({ request }) => {
          postBody = await request.json();
          return ok(
            {
              id: 'repo-2',
              provider: 'github',
              full_name: 'acme/frontend-app',
              created_at: '2026-02-01T12:00:00Z',
            },
            201,
          );
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /integrations \(github\)/i }));

      // Existing repo displayed
      expect(await screen.findByText('acme/core-platform')).toBeInTheDocument();

      const repoInput = screen.getByLabelText(/repository full name/i);
      await user.type(repoInput, 'acme/frontend-app');

      const linkBtn = screen.getByRole('button', { name: /link repository/i });
      await user.click(linkBtn);

      await waitFor(() => {
        expect(screen.getByText('acme/frontend-app')).toBeInTheDocument();
      });

      expect(postBody).toEqual({
        full_name: 'acme/frontend-app',
      });
    });
  });

  describe('Danger Zone Section', () => {
    it('allows freezing active space with reason and ConfirmDialog', async () => {
      let freezeBody: unknown;
      const onChanged = vi.fn().mockResolvedValue(undefined);

      server.use(
        http.post('*/workspaces/w1/spaces/sp1/freeze', async ({ request }) => {
          freezeBody = await request.json();
          return ok({ ...mockSpace, frozen: true, freeze_reason: 'Major migration' });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={onChanged} />,
      );

      await user.click(screen.getByRole('button', { name: /danger zone/i }));

      const reasonInput = screen.getByLabelText(/freeze reason/i);
      await user.type(reasonInput, 'Major migration');

      const freezeBtn = screen.getByRole('button', { name: 'Freeze Space' });
      await user.click(freezeBtn);

      // ConfirmDialog opens
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/freeze space "core platform"\?/i)).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: 'Freeze Space' });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(onChanged).toHaveBeenCalled();
      });

      expect(freezeBody).toEqual({ reason: 'Major migration' });
    });

    it('allows unfreezing an already frozen space', async () => {
      const onChanged = vi.fn().mockResolvedValue(undefined);
      let unfreezeCalled = false;

      server.use(
        http.post('*/workspaces/w1/spaces/sp1/unfreeze', () => {
          unfreezeCalled = true;
          return ok({ frozen: false, replayed_deliveries: 4 });
        }),
      );

      const frozenSpace: SpaceNode = {
        ...mockSpace,
        frozen: true,
        freeze_reason: 'Database re-indexing',
      };

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={frozenSpace} role="admin" onChanged={onChanged} />,
      );

      await user.click(screen.getByRole('button', { name: /danger zone/i }));

      expect(screen.getByText(/currently frozen:/i)).toBeInTheDocument();
      expect(screen.getByText('Database re-indexing')).toBeInTheDocument();

      const unfreezeBtn = screen.getByRole('button', { name: /unfreeze space/i });
      await user.click(unfreezeBtn);

      await waitFor(() => {
        expect(unfreezeCalled).toBe(true);
        expect(onChanged).toHaveBeenCalled();
      });
    });

    it('allows archiving active space with ConfirmDialog', async () => {
      const onChanged = vi.fn().mockResolvedValue(undefined);
      let archiveCalled = false;

      server.use(
        http.post('*/workspaces/w1/spaces/sp1/archive', () => {
          archiveCalled = true;
          return ok({ ...mockSpace, archived: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={mockSpace} role="admin" onChanged={onChanged} />,
      );

      await user.click(screen.getByRole('button', { name: /danger zone/i }));

      const archiveBtn = screen.getByRole('button', { name: 'Archive Space' });
      await user.click(archiveBtn);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/archive space "core platform"\?/i)).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: 'Archive Space' });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(archiveCalled).toBe(true);
        expect(onChanged).toHaveBeenCalled();
      });
    });

    it('allows unarchiving an already archived space', async () => {
      const onChanged = vi.fn().mockResolvedValue(undefined);
      let unarchiveCalled = false;

      server.use(
        http.post('*/workspaces/w1/spaces/sp1/unarchive', () => {
          unarchiveCalled = true;
          return ok({ ...mockSpace, archived: false });
        }),
      );

      const archivedSpace: SpaceNode = {
        ...mockSpace,
        archived: true,
      };

      const user = userEvent.setup();
      renderWithProviders(
        <SpaceSettings workspaceId="w1" space={archivedSpace} role="admin" onChanged={onChanged} />,
      );

      await user.click(screen.getByRole('button', { name: /danger zone/i }));

      expect(screen.getByText(/this space is currently archived and read-only/i)).toBeInTheDocument();

      const unarchiveBtn = screen.getByRole('button', { name: /unarchive space/i });
      await user.click(unarchiveBtn);

      await waitFor(() => {
        expect(unarchiveCalled).toBe(true);
        expect(onChanged).toHaveBeenCalled();
      });
    });
  });
});
