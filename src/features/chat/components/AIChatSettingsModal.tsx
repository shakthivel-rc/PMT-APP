import { useState, useEffect } from 'react';
import {
  Key,
  Check,
  Globe,
  Cpu,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  fetchChatSettings,
  updateChatSettings,
  deleteChatSettings,
  fetchAvailableModels,
  type ChatSettings,
  type DiscoveredModelInfo,
} from '@/api/chat';

interface AIChatSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdated?: (settings: ChatSettings) => void;
}

const FALLBACK_MODELS: Record<string, DiscoveredModelInfo[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship intelligent multimodal model', is_recommended: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, highly affordable and lightweight', is_recommended: false },
    { id: 'o1', name: 'OpenAI o1', description: 'Deep reasoning and complex logic', is_recommended: false },
    { id: 'o1-mini', name: 'OpenAI o1 Mini', description: 'Fast reasoning for math and code', is_recommended: false },
    { id: 'o3-mini', name: 'OpenAI o3 Mini', description: 'Next-gen reasoning model', is_recommended: false },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability 128k context', is_recommended: false },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (v2)', description: 'Best for coding, architecture and complex tasks', is_recommended: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, responsive, economical', is_recommended: false },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Deep nuanced reasoning and analysis', is_recommended: false },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '2M context, complex reasoning and coding', is_recommended: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and high throughput', is_recommended: false },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen multimodal speed and intelligence', is_recommended: false },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning and precision', is_recommended: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest ultra-fast model', is_recommended: false },
  ],
};

export const AIChatSettingsModal = ({
  open,
  onOpenChange,
  onSettingsUpdated,
}: AIChatSettingsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState<string | null>(null);

  const [provider, setProvider] = useState<string>('openai');
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);

  const [modelsList, setModelsList] = useState<DiscoveredModelInfo[]>(FALLBACK_MODELS.openai);
  const [isCustomModel, setIsCustomModel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError(null);
    setFetchSuccess(null);
    fetchChatSettings()
      .then((data) => {
        const prov = data.provider || 'openai';
        setProvider(prov);
        setModel(data.model || 'gpt-4o');
        setBaseUrl(data.base_url || '');
        setHasApiKey(data.has_api_key);
        setApiKeyMasked(data.api_key_masked || null);
        setApiKey('');

        const defaults = FALLBACK_MODELS[prov] || FALLBACK_MODELS.openai;
        setModelsList(defaults);
        const match = defaults.some((m) => m.id === data.model);
        setIsCustomModel(!match && Boolean(data.model));

        // If credentials already exist, auto-fetch available models
        if (data.has_api_key) {
          loadModelsForCredentials(prov, undefined, data.base_url || undefined);
        }
      })
      .catch(() => {
        toast.error('Failed to load AI settings');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const loadModelsForCredentials = async (
    targetProvider: string,
    keyToTest?: string,
    urlToTest?: string
  ) => {
    setFetchingModels(true);
    setFetchError(null);
    setFetchSuccess(null);
    try {
      const res = await fetchAvailableModels({
        provider: targetProvider,
        api_key: keyToTest || undefined,
        base_url: urlToTest || undefined,
      });

      if (res.models && res.models.length > 0) {
        setModelsList(res.models);
        setFetchSuccess(`Found ${res.models.length} available models for ${targetProvider.toUpperCase()}`);
        // If current model isn't in discovered list and isn't marked custom, select default
        if (!isCustomModel && !res.models.some((m) => m.id === model)) {
          setModel(res.default_model || res.models[0].id);
        }
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Could not verify credentials with provider';
      setFetchError(errMsg);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setFetchError(null);
    setFetchSuccess(null);
    const defaults = FALLBACK_MODELS[newProvider] || FALLBACK_MODELS.openai;
    setModelsList(defaults);
    const rec = defaults.find((m) => m.is_recommended) || defaults[0];
    setModel(rec.id);
    setIsCustomModel(false);

    // If key is present, discover models
    if (apiKey.trim() || hasApiKey) {
      loadModelsForCredentials(newProvider, apiKey.trim() || undefined, baseUrl.trim() || undefined);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error('Please specify a model name');
      return;
    }

    setSaving(true);
    try {
      const payload: { provider: string; model: string; api_key?: string; base_url?: string } = {
        provider,
        model: model.trim(),
        base_url: baseUrl.trim() || undefined,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const updated = await updateChatSettings(payload);
      setHasApiKey(updated.has_api_key);
      setApiKeyMasked(updated.api_key_masked || null);
      setApiKey('');
      toast.success('AI Model settings saved successfully');
      onSettingsUpdated?.(updated);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChatSettings();
      setHasApiKey(false);
      setApiKeyMasked(null);
      setApiKey('');
      setBaseUrl('');
      setFetchError(null);
      setFetchSuccess(null);
      setProvider('openai');
      const defaults = FALLBACK_MODELS.openai;
      setModelsList(defaults);
      setModel('gpt-4o');
      setIsCustomModel(false);
      toast.success('AI credentials and settings deleted successfully');
      onSettingsUpdated?.({
        provider: 'openai',
        model: 'gpt-4o',
        has_api_key: false,
        api_key_masked: null,
      });
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete AI settings');
    } finally {
      setDeleting(false);
    }
  };

  const selectedModelObj = modelsList.find((m) => m.id === model);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            AI Chat Model & Credentials
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure your AI provider and discover available models for your account credentials.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-52 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-3">
            {/* 1. Provider */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Cpu className="size-3.5 text-muted-foreground" />
                LLM Provider
              </Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai" className="text-xs">
                    OpenAI (GPT-4o, o1, o3)
                  </SelectItem>
                  <SelectItem value="anthropic" className="text-xs">
                    Anthropic Claude (Claude 3.5 Sonnet, Haiku)
                  </SelectItem>
                  <SelectItem value="google" className="text-xs">
                    Google Gemini (Gemini 1.5 Pro, Flash, 2.0, 3.5)
                  </SelectItem>
                  <SelectItem value="openai_compatible" className="text-xs">
                    Custom / OpenAI-Compatible (Ollama, Groq, vLLM)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. API Key + Verify & Discover Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="api-key-input" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Key className="size-3.5 text-muted-foreground" />
                  API Key
                </Label>
                {hasApiKey && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="size-3" /> Configured ({apiKeyMasked})
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={deleting}
                      className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline font-medium cursor-pointer"
                      title="Delete saved credentials"
                    >
                      <Trash2 className="size-3" /> Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key-input"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setFetchError(null);
                      setFetchSuccess(null);
                    }}
                    placeholder={hasApiKey ? 'Enter new key to replace existing' : 'Paste API key here...'}
                    className="h-9 pr-9 font-mono text-xs"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fetchingModels || (!apiKey.trim() && !hasApiKey)}
                  onClick={() =>
                    loadModelsForCredentials(provider, apiKey.trim() || undefined, baseUrl.trim() || undefined)
                  }
                  className="h-9 px-3.5 text-xs gap-1.5 shrink-0 font-medium cursor-pointer"
                  title="Test credentials and discover models available on your account"
                >
                  {fetchingModels ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : (
                    <RefreshCw className="size-3.5 text-primary" />
                  )}
                  <span>Test & Find Models</span>
                </Button>
              </div>

              {/* Feedback messages */}
              {fetchSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>{fetchSuccess}</span>
                </div>
              )}
              {fetchError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/25 px-3 py-2 text-xs text-destructive font-medium">
                  <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
                  <span className="leading-tight">{fetchError}</span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Keys are symmetrically encrypted at rest with Fernet and never logged.
              </p>
            </div>

            {/* 3. Available Model Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Available Model
                </Label>
                <button
                  type="button"
                  onClick={() => setIsCustomModel(!isCustomModel)}
                  className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                >
                  {isCustomModel ? '← Pick from list' : 'Type custom model name'}
                </button>
              </div>

              {isCustomModel ? (
                <div className="space-y-1">
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-1.5-pro"
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter the exact model identifier supported by your account.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select an available model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {modelsList.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="font-medium truncate">{m.name || m.id}</span>
                            {m.is_recommended && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary text-primary font-normal shrink-0">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Active model description */}
                  {selectedModelObj?.description && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-0.5">
                      <Info className="size-3 text-muted-foreground shrink-0" />
                      <span>{selectedModelObj.description}</span>
                    </p>
                  )}

                  {/* Quick Select Badges for Top Models */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-muted-foreground font-medium mr-0.5">Quick select:</span>
                    {modelsList.slice(0, 5).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModel(m.id);
                          setIsCustomModel(false);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono border transition-all cursor-pointer',
                          model === m.id
                            ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-2xs'
                            : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70'
                        )}
                      >
                        <span>{m.name || m.id}</span>
                        {m.is_recommended && <span className="text-[9px] text-amber-500 font-bold">★</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Optional Custom Base URL */}
            {(provider === 'openai_compatible' || baseUrl) && (
              <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label htmlFor="base-url-input" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Globe className="size-3.5 text-muted-foreground" />
                  Custom Endpoint / Base URL
                </Label>
                <Input
                  id="base-url-input"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                  className="h-8 font-mono text-xs bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Use for self-hosted Ollama, vLLM, Groq, or OpenAI-compatible proxies.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-border">
          <div>
            {(hasApiKey || apiKeyMasked) && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting || saving || loading}
                className="h-8 px-3 text-xs gap-1.5 font-medium cursor-pointer"
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span>Delete Credentials</span>
              </Button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 px-3 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || loading || deleting} className="h-8 px-3 text-xs gap-1.5 font-semibold">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save AI Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Delete AI Credentials?"
      description="This will permanently delete your stored API key and custom provider settings for the AI Assistant. You will need to enter credentials again to use the AI chat."
      confirmLabel="Delete Credentials"
      destructive
      loading={deleting}
      onConfirm={handleDelete}
    />
  </>
  );
};

export default AIChatSettingsModal;
