import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { fetchActivityLogsApi } from '@/api/activityLogs';

const ok = (data: unknown) =>
  HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

describe('fetchActivityLogsApi', () => {
  it('maps records to the ActivityLog shape and forwards user_id when given', async () => {
    let requestedUrl = '';
    server.use(
      http.get('*/activity-logs', ({ request }) => {
        requestedUrl = request.url;
        return ok({
          records: [
            {
              id: 'a1',
              userId: 'u1',
              userName: 'Ada Lovelace',
              action: 'Signed in',
              details: 'ok',
              type: 'login',
              timestamp: '2026-07-24T10:00:00.000Z',
              ipAddress: '127.0.0.1',
            },
          ],
        });
      })
    );

    const logs = await fetchActivityLogsApi('u1');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: 'a1', userId: 'u1', type: 'login', ipAddress: '127.0.0.1' });
    expect(requestedUrl).toContain('user_id=u1');
    expect(requestedUrl).toContain('limit=0');
  });

  it('omits user_id and still returns an array when called without one', async () => {
    server.use(http.get('*/activity-logs', () => ok({ records: [] })));
    const logs = await fetchActivityLogsApi();
    expect(logs).toEqual([]);
  });
});
