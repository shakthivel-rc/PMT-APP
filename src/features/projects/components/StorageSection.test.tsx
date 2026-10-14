import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { StorageSection } from './StorageSection';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

describe('<StorageSection>', () => {
  it('renders default local storage settings and provider options', async () => {
    renderWithProviders(<StorageSection workspaceId="ws-1" manage={true} />);

    await waitFor(() => {
      expect(screen.getByText('Storage & Cloud Integrations (MCP)')).toBeInTheDocument();
    });

    expect(screen.getByText('Local Filesystem')).toBeInTheDocument();
    expect(screen.getByText('Amazon S3 (AWS)')).toBeInTheDocument();
    expect(screen.getByText('Azure Blob Storage')).toBeInTheDocument();
  });

  it('switches to AWS S3, enters credentials, tests connection, and saves', async () => {
    const user = userEvent.setup();
    let savedPayload: Record<string, unknown> | null = null;

    server.use(
      http.patch('*/workspaces/:workspaceId/settings/storage', async ({ request }) => {
        savedPayload = (await request.json()) as Record<string, unknown>;
        return ok({
          provider: 'aws_s3',
          aws_access_key_id: 'AKIAEXAMPLE',
          aws_secret_access_key: '******',
          aws_bucket_name: 'my-test-bucket',
          aws_region: 'us-west-2',
          aws_endpoint_url: null,
          azure_account_name: '',
          azure_account_key: '',
          azure_container_name: '',
          fallback_to_local: true,
          is_configured: true,
        });
      }),
      http.post('*/workspaces/:workspaceId/settings/storage/test', async () => {
        return ok({
          success: true,
          message: 'Connection to AWS S3 succeeded.',
          provider: 'aws_s3',
        });
      }),
    );

    renderWithProviders(<StorageSection workspaceId="ws-1" manage={true} />);

    await waitFor(() => {
      expect(screen.getByText('Amazon S3 (AWS)')).toBeInTheDocument();
    });

    // Select AWS S3
    await user.click(screen.getByText('Amazon S3 (AWS)'));

    // Check S3 fields appear
    expect(screen.getByLabelText(/Bucket Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Access Key ID/i)).toBeInTheDocument();

    // Type bucket name and access key
    const bucketInput = screen.getByLabelText(/Bucket Name/i);
    await user.clear(bucketInput);
    await user.type(bucketInput, 'my-test-bucket');

    const keyInput = screen.getByLabelText(/Access Key ID/i);
    await user.clear(keyInput);
    await user.type(keyInput, 'AKIAEXAMPLE');

    // Test connection
    const testButton = screen.getByRole('button', { name: /Test Connection/i });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Connection to AWS S3 succeeded/i)).toBeInTheDocument();
    });

    // Save changes
    const saveButton = screen.getByRole('button', { name: /Save Storage Settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(savedPayload).not.toBeNull();
      expect(savedPayload?.provider).toBe('aws_s3');
      expect(savedPayload?.aws_bucket_name).toBe('my-test-bucket');
    });
  });

  it('switches to Azure Blob Storage and displays Azure container fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StorageSection workspaceId="ws-1" manage={true} />);

    await waitFor(() => {
      expect(screen.getByText('Azure Blob Storage')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Azure Blob Storage'));

    expect(screen.getByLabelText(/Storage Account Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Container Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Account SharedKey/i)).toBeInTheDocument();
  });

  it('disables save and test actions when manage is false', async () => {
    renderWithProviders(<StorageSection workspaceId="ws-1" manage={false} />);

    await waitFor(() => {
      expect(screen.getByText('Storage & Cloud Integrations (MCP)')).toBeInTheDocument();
    });

    // Save and test buttons should not be present for non-managers
    expect(screen.queryByRole('button', { name: /Save Storage Settings/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Test Connection/i })).toBeNull();
  });
});
