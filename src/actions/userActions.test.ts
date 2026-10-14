import { describe, it, expect, vi, beforeEach } from 'vitest';

// Isolate the action's branch logic from the network by mocking the api layer.
vi.mock('@/api/users', () => ({
  createUserApi: vi.fn(),
  updateUserApi: vi.fn(),
  deleteUserApi: vi.fn(),
  fetchUsersApi: vi.fn(),
}));

import { createUserApi, deleteUserApi, updateUserApi } from '@/api/users';
import { deleteUserAction, saveUserAction } from '@/actions/userActions';
import { makeUser } from '@/test/fixtures';

beforeEach(() => vi.clearAllMocks());

describe('saveUserAction', () => {
  it('creates a new user when no id is present (username defaults to email)', async () => {
    vi.mocked(createUserApi).mockResolvedValue(makeUser({ id: '9' }));

    const res = await saveUserAction({
      first_name: 'New',
      last_name: 'User',
      email: 'new@x.com',
      organization: '',
      department: '',
      role_id: 'r1',
    });

    expect(res).toEqual({ success: true, data: expect.objectContaining({ id: '9' }) });
    expect(createUserApi).toHaveBeenCalledWith(expect.objectContaining({ username: 'new@x.com' }));
    expect(updateUserApi).not.toHaveBeenCalled();
  });

  it('updates when an id is present', async () => {
    vi.mocked(updateUserApi).mockResolvedValue(makeUser({ id: '7' }));

    const res = await saveUserAction({
      id: '7',
      first_name: 'Up',
      last_name: 'Dated',
      email: 'u@x.com',
      organization: '',
      department: '',
      role_id: 'r2',
    });

    expect(res.success).toBe(true);
    expect(updateUserApi).toHaveBeenCalledWith('7', expect.objectContaining({ role_id: 'r2' }));
    expect(createUserApi).not.toHaveBeenCalled();
  });

  it('returns a failure envelope on error', async () => {
    vi.mocked(createUserApi).mockRejectedValue(new Error('duplicate email'));
    const res = await saveUserAction({
      first_name: '',
      last_name: '',
      email: 'x',
      organization: '',
      department: '',
      role_id: '',
    });
    expect(res).toEqual({ success: false, error: 'duplicate email' });
  });
});

describe('deleteUserAction', () => {
  it('deleteUserAction returns the id on success', async () => {
    vi.mocked(deleteUserApi).mockResolvedValue('5');
    expect(await deleteUserAction('5')).toEqual({ success: true, data: '5' });
  });

  it('deleteUserAction returns a failure envelope on error', async () => {
    vi.mocked(deleteUserApi).mockRejectedValue(new Error('boom'));
    expect(await deleteUserAction('5')).toEqual({ success: false, error: 'boom' });
  });
});
