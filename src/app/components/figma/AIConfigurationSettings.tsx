/**
 * AI Configuration Settings Component
 *
 * Provides secure AI provider configuration with:
 * - Provider selection (OpenAI, Anthropic, Ollama, etc.)
 * - Encrypted API key storage (or URL-based config for Ollama)
 * - Connection testing and status feedback
 * - Per-feature consent toggles for data transmission control
 * - Ollama-specific settings: server URL, direct connection toggle
 * - Cross-tab synchronization
 *
 * Follows ReminderSettings.tsx pattern for state management and accessibility.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import { Button } from '@/app/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  CheckCircle2,
  AlertTriangle,
  Settings,
  ChevronDown,
  Info,
  Server,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { OllamaModelPicker } from './OllamaModelPicker'
import { ProviderModelPicker } from './ProviderModelPicker'
import { FeatureModelOverridePanel } from './FeatureModelOverridePanel'
import { ProviderKeyAccordion } from './ProviderKeyAccordion'
import {
  getAIConfiguration,
  saveAIConfiguration,
  testAIConnection,
  getDecryptedApiKeyForProvider,
  getConfiguredProviderIds,
  AI_PROVIDERS,
  type AIConfigurationSettings as AIConfigSettings,
  type AIProviderId,
  type AIFeatureId,
  type ConsentSettings,
} from '@/lib/aiConfiguration'
import { cn } from '@/app/components/ui/utils'
import { testOllamaConnection } from '@/lib/ollamaHealthCheck'

/**
 * Checks if a URL points to a private/LAN IP address.
 * Used to warn about Chrome Private Network Access restrictions in direct mode.
 */
function isPrivateNetworkUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return (
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    )
  } catch {
    // silent-catch-ok: error logged to console
    return false
  }
}

/** Feature labels for consent toggles */
const FEATURE_LABELS: Record<keyof ConsentSettings, string> = {
  videoSummary: 'AI Video Summaries',
  noteQA: 'Q&A from Notes',
  learningPath: 'Learning Path Generation',
  knowledgeGaps: 'Knowledge Gap Detection',
  noteOrganization: 'AI Note Organization',
  analytics: 'AI Analytics',
}

export function AIConfigurationSettings() {
  const [settings, setSettings] = useState<AIConfigSettings>(getAIConfiguration)
  const [apiKey, setApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState(
    () => getAIConfiguration().ollamaSettings?.serverUrl || ''
  )
  const [isValidating, setIsValidating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    errorType?: string
  } | null>(null)
  const successTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const testResultTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const [decryptedApiKey, setDecryptedApiKey] = useState<string | null>(null)
  // AC3: whether ANY provider has a credential in Vault (async check)
  const [hasAnyProviderKey, setHasAnyProviderKey] = useState<boolean>(false)

  const isOllama = settings.provider === 'ollama'

  // Cross-tab synchronization
  useEffect(() => {
    function handleStorageUpdate(e: StorageEvent) {
      // Only respond to ai-configuration changes from other tabs
      if (e.key === 'ai-configuration') {
        const updated = getAIConfiguration()
        setSettings(updated)
        if (updated.provider === 'ollama') {
          setOllamaUrl(updated.ollamaSettings?.serverUrl || '')
        }
      }
    }

    function handleCustomUpdate() {
      // Same-tab updates (storage event doesn't fire in same tab)
      const updated = getAIConfiguration()
      setSettings(updated)
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('ai-configuration-updated', handleCustomUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('ai-configuration-updated', handleCustomUpdate)
      // Clear any pending timeouts on unmount
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current)
      }
    }
  }, [])

  // Check if any provider has a credential in Vault (async — updates on configuration changes)
  useEffect(() => {
    let ignore = false
    getConfiguredProviderIds().then(ids => {
      if (!ignore) setHasAnyProviderKey(ids.length > 0)
    })
    return () => {
      ignore = true
    }
  }, [settings.provider, settings.providerKeys, settings.apiKeyEncrypted])

  // Decrypt API key for model discovery when connected (non-Ollama providers)
  useEffect(() => {
    if (!isOllama && settings.connectionStatus === 'connected') {
      // silent-catch-ok: decryption failure is non-critical, picker simply won't render
      getDecryptedApiKeyForProvider(settings.provider)
        .then(key => setDecryptedApiKey(key))
        .catch(() => setDecryptedApiKey(null))
    } else {
      setDecryptedApiKey(null)
    }
  }, [isOllama, settings.connectionStatus, settings.provider])

  /**
   * Handles global model override selection (AC8).
   * Persists to `globalModelOverride[provider]` in runtime config.
   */
  async function handleGlobalModelSelect(modelId: string) {
    const current = getAIConfiguration()
    await saveAIConfiguration({
      globalModelOverride: {
        ...current.globalModelOverride,
        [settings.provider]: modelId,
      },
    })
    setSettings(getAIConfiguration())
  }

  /**
   * Handles provider selection change
   */
  async function handleProviderChange(provider: AIProviderId) {
    await saveAIConfiguration({ provider })
    setSettings(getAIConfiguration())
    // Load Ollama URL if switching to Ollama
    if (provider === 'ollama') {
      setOllamaUrl(getAIConfiguration().ollamaSettings?.serverUrl || '')
    }
  }

  /**
   * Validates and saves Ollama server URL
   */
  async function handleOllamaSave() {
    if (!ollamaUrl.trim()) {
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: 'Server URL is required',
      })
      return
    }

    // Validate URL format
    const provider = AI_PROVIDERS.ollama
    if (!provider.validateApiKey(ollamaUrl)) {
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage:
          'Invalid URL format. Use http://hostname:port (e.g., http://192.168.1.100:11434)',
      })
      return
    }

    setIsValidating(true)

    try {
      const isConnected = await testAIConnection('ollama', ollamaUrl)

      if (isConnected) {
        await saveAIConfiguration({
          connectionStatus: 'connected',
          ollamaSettings: {
            serverUrl: ollamaUrl,
            directConnection: settings.ollamaSettings?.directConnection ?? false,
            selectedModel: settings.ollamaSettings?.selectedModel,
          },
        })
        setShowSuccess(true)
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 3000)
      } else {
        setSettings({
          ...settings,
          connectionStatus: 'error',
          errorMessage: 'Connection test failed. Is Ollama running at this URL?',
        })
      }

      setSettings(getAIConfiguration())
    } catch (error) {
      // silent-catch-ok — error state rendered inline via connectionStatus
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Connection test failed',
      })
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Validates API key and tests connection (for non-Ollama providers)
   */
  async function handleSave() {
    if (isOllama) {
      await handleOllamaSave()
      return
    }

    if (!apiKey.trim()) {
      // Transient error - do NOT persist to localStorage
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: 'API key is required',
      })
      return
    }

    // Validate API key format
    const provider = AI_PROVIDERS[settings.provider]
    if (!provider.validateApiKey(apiKey)) {
      // Transient error - do NOT persist to localStorage
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: 'Invalid API key format',
      })
      return
    }

    setIsValidating(true)

    try {
      // Test connection
      const isConnected = await testAIConnection(settings.provider, apiKey)

      if (isConnected) {
        await saveAIConfiguration({ connectionStatus: 'connected' }, apiKey)
        setShowSuccess(true)
        setApiKey('') // Clear input after successful save
        // Clear any existing timeout before setting a new one
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 3000)
      } else {
        // Transient error - do NOT persist to localStorage
        setSettings({
          ...settings,
          connectionStatus: 'error',
          errorMessage: 'Connection test failed',
        })
      }

      setSettings(getAIConfiguration())
    } catch (error) {
      // silent-catch-ok — error state rendered inline via connectionStatus
      // Transient error - do NOT persist to localStorage
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Connection test failed',
      })
      // Note: Do NOT call getAIConfiguration() here - it would overwrite the error state
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Tests Ollama connection independently of save flow (AC1)
   * Shows success/failure with actionable error messages (AC3)
   */
  async function handleTestConnection() {
    const url = ollamaUrl || settings.ollamaSettings?.serverUrl || ''
    if (!url) {
      setTestResult({ success: false, message: 'Enter a server URL first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await testOllamaConnection(
        url,
        settings.ollamaSettings?.directConnection ?? false,
        settings.ollamaSettings?.selectedModel
      )

      setTestResult(result)

      // Update persisted connection status based on test result
      if (result.success) {
        await saveAIConfiguration({
          connectionStatus: 'connected',
          errorMessage: undefined,
          ollamaSettings: {
            serverUrl: url,
            directConnection: settings.ollamaSettings?.directConnection ?? false,
            selectedModel: settings.ollamaSettings?.selectedModel,
          },
        })
        setSettings(getAIConfiguration())
      } else {
        await saveAIConfiguration({
          connectionStatus: 'error',
          errorMessage: result.message,
        })
        setSettings(getAIConfiguration())
      }

      // Auto-dismiss success results after 8 seconds; keep errors visible for reading
      if (result.success) {
        if (testResultTimeoutRef.current) {
          clearTimeout(testResultTimeoutRef.current)
        }
        testResultTimeoutRef.current = setTimeout(() => setTestResult(null), 8000)
      }
    } catch (error) {
      // silent-catch-ok — error displayed via testResult state
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      })
    } finally {
      setIsTesting(false)
    }
  }

  /**
   * Toggles Ollama direct connection mode
   */
  async function handleDirectConnectionToggle(enabled: boolean) {
    await saveAIConfiguration({
      ollamaSettings: {
        serverUrl: ollamaUrl || settings.ollamaSettings?.serverUrl || '',
        directConnection: enabled,
        selectedModel: settings.ollamaSettings?.selectedModel,
      },
    })
    setSettings(getAIConfiguration())
  }

  /**
   * Handles Ollama model selection (AC3: persist in AI configuration)
   * Wrapped in useCallback with correct dependencies to avoid stale closures.
   */
  const handleModelSelectCallback = useCallback(
    (model: string) => {
      const doSelect = async () => {
        await saveAIConfiguration({
          ollamaSettings: {
            serverUrl: ollamaUrl || settings.ollamaSettings?.serverUrl || '',
            directConnection: settings.ollamaSettings?.directConnection ?? false,
            selectedModel: model,
          },
        })
        setSettings(getAIConfiguration())
      }
      // silent-catch-ok — model selection errors are non-critical, picker shows error state
      doSelect().catch(err => {
        console.error('Failed to select model:', err)
      })
    },
    [ollamaUrl, settings.ollamaSettings?.serverUrl, settings.ollamaSettings?.directConnection]
  )

  /**
   * Updates consent setting for a specific feature
   */
  async function updateConsent(feature: keyof ConsentSettings, enabled: boolean) {
    const updated = {
      ...settings.consentSettings,
      [feature]: enabled,
    }
    await saveAIConfiguration({ consentSettings: updated })
    setSettings(getAIConfiguration())
  }

  const isConnected = settings.connectionStatus === 'connected'
  const hasError = settings.connectionStatus === 'error'
  // AC3: Show consent/override sections when ANY provider has a configured key
  // hasAnyProviderKey is loaded asynchronously via useEffect above
  const showFeatureSettings = isConnected || hasAnyProviderKey
  const ollamaSaveDisabled = isValidating || !ollamaUrl.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5" aria-hidden="true" />
          AI Configuration
          {/* AC2: Connection status indicator (green/red dot) */}
          {isOllama && settings.ollamaSettings?.serverUrl && (
            <span
              className="ml-auto flex items-center gap-1.5"
              data-testid="ollama-status-indicator"
              aria-label={
                isConnected
                  ? 'Ollama connected'
                  : hasError
                    ? 'Ollama connection error'
                    : 'Ollama not connected'
              }
            >
              <span
                className={cn(
                  'size-2.5 rounded-full',
                  isConnected ? 'bg-success' : hasError ? 'bg-destructive' : 'bg-muted-foreground'
                )}
                aria-hidden="true"
              />
              <span className="text-xs font-normal text-muted-foreground">
                {isConnected ? 'Connected' : hasError ? 'Error' : 'Not tested'}
              </span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Mode Toggle */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border p-3',
            settings.budgetMode ? 'border-success/30 bg-success/5' : 'border-border'
          )}
        >
          <div className="space-y-0.5">
            <Label htmlFor="budget-mode" className="text-sm font-medium cursor-pointer">
              Free Models Only
            </Label>
            <p className="text-xs text-muted-foreground">
              {settings.budgetMode
                ? 'Only free-tier models will be used — no per-token costs'
                : 'Restrict AI features to only use models with no costs'}
            </p>
          </div>
          <Switch
            id="budget-mode"
            checked={settings.budgetMode ?? false}
            onCheckedChange={checked => {
              saveAIConfiguration({ budgetMode: checked }).catch(err => {
                console.error('Failed to toggle budget mode:', err)
                toast.error('Failed to update budget mode')
              })
              setSettings(prev => ({ ...prev, budgetMode: checked }))
              toast.success(
                checked ? 'Budget mode enabled — using free models only' : 'Budget mode disabled'
              )
            }}
            data-testid="budget-mode-toggle"
            aria-label="Enable free models only mode"
          />
        </div>

        {/* Provider Selection */}
        <div>
          <Label htmlFor="ai-provider">AI Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={value =>
              handleProviderChange(value as AIProviderId).catch(err => {
                console.error('Failed to change AI provider:', err)
                toast.error('Failed to change AI provider')
              })
            }
          >
            <SelectTrigger
              id="ai-provider"
              className="mt-1 w-48"
              aria-label="AI Provider"
              data-testid="ai-provider-selector"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AI_PROVIDERS).map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ollama Server URL Input */}
        {isOllama ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ollama-url" className="flex items-center gap-2">
                <Server className="size-4" aria-hidden="true" />
                Server URL
              </Label>
              <Input
                id="ollama-url"
                type="url"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://192.168.1.x:11434"
                className="mt-1"
                data-testid="ollama-url-input"
                aria-invalid={hasError}
                aria-describedby={hasError ? 'connection-error' : 'ollama-url-hint'}
              />
              <p id="ollama-url-hint" className="mt-1 text-xs text-muted-foreground">
                Enter the URL of your Ollama server. Default port is 11434.
              </p>
            </div>

            {/* Advanced: Direct Connection Toggle */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                data-testid="ollama-advanced-toggle"
              >
                <ChevronDown
                  className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                Advanced Settings
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between min-h-[44px]">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="direct-connection" className="cursor-pointer">
                      Direct Connection
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-help"
                            aria-label="Direct connection information"
                          >
                            <Info className="size-4 text-muted-foreground" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md"
                        >
                          <p>
                            Direct connection sends requests straight from your browser to Ollama.
                            Requires CORS configured on your Ollama server (set{' '}
                            <code className="text-xs bg-muted/50 text-foreground px-1 py-0.5 rounded border border-border/50">
                              OLLAMA_ORIGINS=*
                            </code>
                            ). Proxy mode (default) avoids CORS issues.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="direct-connection"
                    checked={settings.ollamaSettings?.directConnection ?? false}
                    onCheckedChange={checked =>
                      handleDirectConnectionToggle(checked).catch(err => {
                        console.error('Failed to toggle direct connection:', err)
                        toast.error('Failed to update connection mode')
                      })
                    }
                    data-testid="ollama-direct-connection"
                    aria-label="Enable direct browser-to-Ollama connection"
                  />
                </div>
                {settings.ollamaSettings?.directConnection && (
                  <div className="text-xs space-y-1" role="alert">
                    <p className="text-warning">
                      Direct mode active. Ensure your Ollama server has{' '}
                      <code className="bg-muted px-1 rounded">OLLAMA_ORIGINS=*</code> set.
                    </p>
                    {isPrivateNetworkUrl(ollamaUrl || settings.ollamaSettings?.serverUrl || '') && (
                      <p className="text-muted-foreground">
                        Your browser may ask permission to access your local network — click Allow
                        when prompted. This is normal for LAN connections.
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          /* Multi-Provider API Key Accordion (E90-S10) */
          <ProviderKeyAccordion onConfigChanged={() => setSettings(getAIConfiguration())} />
        )}

        {/* Connection Status */}
        <div aria-live="polite" aria-atomic="true">
          {isConnected && (
            <div
              className="flex items-center gap-2 text-sm text-success"
              data-testid="connection-status"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Connected{isOllama ? ` to ${settings.ollamaSettings?.serverUrl}` : ''}
            </div>
          )}
          {hasError && settings.errorMessage && (
            <div
              id="connection-error"
              className="flex items-center gap-2 text-sm text-destructive"
              data-testid="connection-error"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              {settings.errorMessage}
            </div>
          )}
        </div>

        {/* Ollama Model Picker (AC1-AC5) — shown after successful connection */}
        {isOllama && (
          <OllamaModelPicker
            serverUrl={ollamaUrl || settings.ollamaSettings?.serverUrl || ''}
            directConnection={settings.ollamaSettings?.directConnection ?? false}
            selectedModel={settings.ollamaSettings?.selectedModel}
            onModelSelect={handleModelSelectCallback}
            isConnected={isConnected}
          />
        )}

        {/* AC1: Test Connection Button (Ollama only) */}
        {isOllama && settings.ollamaSettings?.serverUrl && (
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => {
                handleTestConnection().catch(err => {
                  console.error('Test connection failed:', err)
                  toast.error('Connection test failed unexpectedly')
                })
              }}
              disabled={isTesting}
              data-testid="test-connection-button"
              className="min-h-[44px] rounded-lg"
              aria-label="Test Ollama connection"
            >
              {isTesting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                  Testing connection...
                </>
              ) : (
                <>
                  <Wifi className="size-4 mr-2" aria-hidden="true" />
                  Test Connection
                </>
              )}
            </Button>

            {/* AC3: Test result with actionable error messages */}
            {testResult && (
              <div
                className={cn(
                  'flex items-start gap-2 text-sm rounded-lg p-3',
                  testResult.success
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                )}
                role="alert"
                data-testid="test-connection-result"
              >
                {testResult.success ? (
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <WifiOff className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <p>{testResult.message}</p>
                  {testResult.errorType === 'cors' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Run:{' '}
                      <code className="bg-muted px-1 rounded text-xs">
                        OLLAMA_ORIGINS=* ollama serve
                      </code>{' '}
                      or switch to proxy mode in Advanced Settings.
                    </p>
                  )}
                  {testResult.errorType === 'unreachable' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Verify the server is running:{' '}
                      <code className="bg-muted px-1 rounded text-xs">
                        curl {ollamaUrl || settings.ollamaSettings?.serverUrl}
                      </code>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button (Ollama only — non-Ollama providers use per-provider save in accordion) */}
        {isOllama && (
          <Button
            onClick={() => {
              handleSave().catch(err => {
                console.error('Failed to save AI configuration:', err)
                toast.error('Failed to save configuration')
              })
            }}
            disabled={ollamaSaveDisabled}
            data-testid="save-ai-config-button"
            className="min-h-[44px] rounded-lg"
          >
            {isValidating ? 'Testing...' : showSuccess ? 'Saved!' : 'Save & Test Connection'}
          </Button>
        )}

        {/* Global Model Picker for non-Ollama providers (AC8) */}
        {!isOllama && isConnected && decryptedApiKey && (
          <div
            className="space-y-1 pt-2 animate-in fade-in-0 slide-in-from-top-1 duration-200"
            data-testid="global-model-picker-section"
          >
            <ProviderModelPicker
              provider={settings.provider}
              apiKey={decryptedApiKey}
              selectedModel={settings.globalModelOverride?.[settings.provider]}
              onModelSelect={modelId => {
                handleGlobalModelSelect(modelId).catch(err => {
                  console.error('Failed to save global model override:', err)
                  toast.error('Failed to save model selection')
                })
              }}
              label="Default Model"
              testIdPrefix="global-model-picker"
              budgetMode={settings.budgetMode}
            />
          </div>
        )}

        {/* Per-Feature Consent Toggles */}
        {showFeatureSettings && (
          <div className="space-y-4 pt-4 border-t border-border animate-in fade-in-0 slide-in-from-top-1 duration-300">
            <h3 className="text-sm font-medium">Feature Permissions</h3>
            <p className="text-sm text-muted-foreground">
              Control which AI features can transmit data to {AI_PROVIDERS[settings.provider].name}
            </p>

            <div className="space-y-4" data-testid="consent-toggles">
              {(Object.entries(FEATURE_LABELS) as [keyof ConsentSettings, string][]).map(
                ([key, label]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between min-h-[44px]">
                      <Label htmlFor={`consent-${key}`} className="cursor-pointer">
                        {label}
                      </Label>
                      <Switch
                        id={`consent-${key}`}
                        checked={settings.consentSettings[key]}
                        onCheckedChange={checked =>
                          updateConsent(key, checked).catch(err => {
                            console.error(`Failed to update consent for ${key}:`, err)
                            toast.error('Failed to update consent setting')
                          })
                        }
                        data-testid={`consent-${key}`}
                        aria-label={`${label} consent`}
                      />
                    </div>
                    {/* AC1-AC7: Per-feature model override (E90-S06) */}
                    <FeatureModelOverridePanel
                      feature={key as AIFeatureId}
                      currentOverride={settings.featureModels?.[key as AIFeatureId]}
                      isConsentEnabled={settings.consentSettings[key]}
                      onConfigChanged={() => setSettings(getAIConfiguration())}
                      budgetMode={settings.budgetMode}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
