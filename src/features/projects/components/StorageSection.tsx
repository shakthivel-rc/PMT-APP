import { useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  Save,
  Server,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStorageSettings, testStorageConnection, updateStorageSettings } from '@/api/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { StorageProvider, StorageSettings } from '@/types';

export interface StorageSectionProps {
  workspaceId: string;
  manage: boolean;
}

export const StorageSection = ({ workspaceId, manage }: StorageSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StorageSettings | null>(null);

  // Form states
  const [provider, setProvider] = useState<StorageProvider>('local');
  const [awsBucket, setAwsBucket] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsEndpoint, setAwsEndpoint] = useState('');

  const [azureAccount, setAzureAccount] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [azureContainer, setAzureContainer] = useState('');

  const [fallbackToLocal, setFallbackToLocal] = useState(true);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStorageSettings(workspaceId)
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setProvider(data.provider);
        setAwsBucket(data.aws_bucket_name || '');
        setAwsRegion(data.aws_region || 'us-east-1');
        setAwsAccessKey(data.aws_access_key_id || '');
        setAwsSecretKey(data.aws_secret_access_key || '');
        setAwsEndpoint(data.aws_endpoint_url || '');
        setAzureAccount(data.azure_account_name || '');
        setAzureKey(data.azure_account_key || '');
        setAzureContainer(data.azure_container_name || '');
        setFallbackToLocal(data.fallback_to_local);
      })
      .catch((err) => {
        if (!active) return;
        toast.error('Failed to load storage configuration');
        console.error(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testStorageConnection(workspaceId, {
        provider,
        aws_bucket_name: awsBucket,
        aws_region: awsRegion,
        aws_access_key_id: awsAccessKey,
        aws_secret_access_key: awsSecretKey,
        aws_endpoint_url: awsEndpoint || null,
        azure_account_name: azureAccount,
        azure_account_key: azureKey,
        azure_container_name: azureContainer,
      });
      setTestResult({ success: res.success, message: res.message });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Storage test request failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manage) return;

    startSaving(async () => {
      try {
        const updated = await updateStorageSettings(workspaceId, {
          provider,
          aws_bucket_name: awsBucket,
          aws_region: awsRegion,
          aws_access_key_id: awsAccessKey,
          aws_secret_access_key: awsSecretKey,
          aws_endpoint_url: awsEndpoint || null,
          azure_account_name: azureAccount,
          azure_account_key: azureKey,
          azure_container_name: azureContainer,
          fallback_to_local: fallbackToLocal,
        });
        setSettings(updated);
        toast.success('Storage settings saved successfully');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save storage settings';
        toast.error(msg);
      }
    });
  };

  if (loading) {
    return (
      <Card className="rounded-xl border shadow-2xs">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border shadow-2xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cloud className="size-5 text-primary" />
                Storage & Cloud Integrations (MCP)
              </CardTitle>
              <CardDescription>
                Configure where files and attachments uploaded to issues and comments are stored.
                Supports AWS S3, Azure Blob Storage, or Local Filesystem storage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  provider === 'local'
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : settings?.is_configured
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {provider === 'local' ? (
                  <>
                    <HardDrive className="size-3.5" />
                    Local Storage
                  </>
                ) : (
                  <>
                    <Cloud className="size-3.5" />
                    {provider === 'aws_s3' ? 'AWS S3' : 'Azure Blob'}
                  </>
                )}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Storage Provider Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Active Storage Provider</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!manage}
                  onClick={() => setProvider('local')}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                    provider === 'local'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <HardDrive
                      className={`size-5 ${
                        provider === 'local' ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    {provider === 'local' && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <div className="mt-3 font-medium">Local Filesystem</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Store files on the local server disk. Zero credentials required.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!manage}
                  onClick={() => setProvider('aws_s3')}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                    provider === 'aws_s3'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Cloud
                      className={`size-5 ${
                        provider === 'aws_s3' ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    {provider === 'aws_s3' && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <div className="mt-3 font-medium">Amazon S3 (AWS)</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Store files in AWS S3 buckets using AWS Signature V4 protocol.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!manage}
                  onClick={() => setProvider('azure_blob')}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                    provider === 'azure_blob'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Database
                      className={`size-5 ${
                        provider === 'azure_blob' ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    {provider === 'azure_blob' && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <div className="mt-3 font-medium">Azure Blob Storage</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Store files in Azure Storage containers with SharedKey authentication.
                  </div>
                </button>
              </div>
            </div>

            {/* AWS S3 Configuration Form */}
            {provider === 'aws_s3' && (
              <div className="space-y-4 rounded-xl border border-dashed p-4 bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Cloud className="size-4 text-primary" />
                  AWS S3 Bucket & Credentials
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="aws-bucket">Bucket Name *</Label>
                    <Input
                      id="aws-bucket"
                      placeholder="e.g. my-pmt-attachments"
                      value={awsBucket}
                      onChange={(e) => setAwsBucket(e.target.value)}
                      disabled={!manage}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="aws-region">AWS Region *</Label>
                    <Input
                      id="aws-region"
                      placeholder="e.g. us-east-1"
                      value={awsRegion}
                      onChange={(e) => setAwsRegion(e.target.value)}
                      disabled={!manage}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="aws-access-key">Access Key ID *</Label>
                    <Input
                      id="aws-access-key"
                      placeholder="AKIA..."
                      value={awsAccessKey}
                      onChange={(e) => setAwsAccessKey(e.target.value)}
                      disabled={!manage}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="aws-secret-key">Secret Access Key *</Label>
                    <Input
                      id="aws-secret-key"
                      type="password"
                      placeholder={
                        settings?.aws_secret_access_key
                          ? 'Leave empty to keep existing key'
                          : 'Enter AWS secret key'
                      }
                      value={awsSecretKey}
                      onChange={(e) => setAwsSecretKey(e.target.value)}
                      disabled={!manage}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="aws-endpoint">
                    Custom Endpoint URL (Optional for MinIO / LocalStack)
                  </Label>
                  <Input
                    id="aws-endpoint"
                    placeholder="e.g. https://s3.custom-domain.com"
                    value={awsEndpoint}
                    onChange={(e) => setAwsEndpoint(e.target.value)}
                    disabled={!manage}
                  />
                </div>
              </div>
            )}

            {/* Azure Blob Configuration Form */}
            {provider === 'azure_blob' && (
              <div className="space-y-4 rounded-xl border border-dashed p-4 bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Database className="size-4 text-primary" />
                  Azure Blob Storage Configuration
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="azure-account">Storage Account Name *</Label>
                    <Input
                      id="azure-account"
                      placeholder="e.g. mycompanyblob"
                      value={azureAccount}
                      onChange={(e) => setAzureAccount(e.target.value)}
                      disabled={!manage}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="azure-container">Container Name *</Label>
                    <Input
                      id="azure-container"
                      placeholder="e.g. issue-attachments"
                      value={azureContainer}
                      onChange={(e) => setAzureContainer(e.target.value)}
                      disabled={!manage}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="azure-key">Account SharedKey *</Label>
                  <Input
                    id="azure-key"
                    type="password"
                    placeholder={
                      settings?.azure_account_key
                        ? 'Leave empty to keep existing key'
                        : 'Enter Azure primary/secondary account key'
                    }
                    value={azureKey}
                    onChange={(e) => setAzureKey(e.target.value)}
                    disabled={!manage}
                  />
                </div>
              </div>
            )}

            {/* Automatic Local Fallback Toggle */}
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
              <input
                id="fallback-toggle"
                type="checkbox"
                checked={fallbackToLocal}
                onChange={(e) => setFallbackToLocal(e.target.checked)}
                disabled={!manage}
                className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <Label htmlFor="fallback-toggle" className="text-sm font-medium cursor-pointer">
                  Automatic Local Storage Fallback
                </Label>
                <div className="text-xs text-muted-foreground">
                  If the configured cloud provider is temporarily unreachable or credentials expire,
                  files will automatically save to local storage to prevent user upload failures.
                </div>
              </div>
            </div>

            {/* Test Connection Result Alert */}
            {testResult && (
              <div
                className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {testResult.success ? 'Connection Successful' : 'Connection Check Failed'}
                  </div>
                  <div className="mt-0.5 text-xs">{testResult.message}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {manage && (
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Testing Connectivity...
                    </>
                  ) : (
                    <>
                      <Server className="mr-2 size-4" />
                      Test Connection
                    </>
                  )}
                </Button>

                <Button type="submit" disabled={saving || testing}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Save Storage Settings
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
