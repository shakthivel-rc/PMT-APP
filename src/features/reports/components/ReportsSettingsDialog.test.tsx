import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeReportCatalog } from '@/test/fixtures';
import { fetchReportsSettingsApi } from '@/api/reports';
import { ReportsSettingsDialog } from './ReportsSettingsDialog';

/** An admin's report settings: time zone, working days, guests and the three roles. */

const ok = (data: unknown) => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });
const settings = makeReportCatalog().settings;

describe('<ReportsSettingsDialog>', () => {
  it('sends what the form says', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/workspaces/w1/settings/reports', async ({ request }) => {
        sent = await request.json();
        return ok({ ...settings, ...(sent as object) });
      }),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ReportsSettingsDialog open onOpenChange={onOpenChange} workspaceId="w1" workspaceName="Acme" settings={settings} onSaved={onSaved} />,
    );
    const zone = screen.getByLabelText('Time zone');
    await userEvent.clear(zone);
    await userEvent.type(zone, 'Asia/Kolkata');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sat' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Guests can open reports' }));
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual({ ...settings, timezone: 'Asia/Kolkata', working_days: [0, 1, 2, 3, 4, 5], guest_access: true });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('needs at least one working day', async () => {
    renderWithProviders(
      <ReportsSettingsDialog open onOpenChange={vi.fn()} workspaceId="w1" workspaceName="Acme" settings={{ ...settings, working_days: [0] }} onSaved={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(screen.getByText('Choose at least one working day.')).toBeInTheDocument();
  });

  it('reads the settings on their own', async () => {
    server.use(http.get('*/workspaces/w1/settings/reports', () => ok(settings)));
    expect(await fetchReportsSettingsApi('w1')).toEqual(settings);
  });
});
