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
import {
  getAIConfiguration,
  saveAIConfiguration,
  testAIConnection,
  AI_PROVIDERS,
  type AIConfigurationSettings as AIConfigSettings,
  type AIProviderId,
  type ConsentSettings,
} from '@/lib/aiConfiguration'
import { cn } from '@/app/components/ui/utils'
import { testOllamaConnection } from '@/lib/ollamaHealthCheck'

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

      // Clear test result after 8 seconds
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current)
      }
      testResultTimeoutRef.current = setTimeout(() => setTestResult(null), 8000)
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
   */
  async function handleModelSelect(modelName: string) {
    await saveAIConfiguration({
      ollamaSettings: {
        serverUrl: ollamaUrl || settings.ollamaSettings?.serverUrl || '',
        directConnection: settings.ollamaSettings?.directConnection ?? false,
        selectedModel: modelName,
      },
    })
    setSettings(getAIConfiguration())
  }

  const handleModelSelectCallback = useCallback(
    (model: string) => {
      // silent-catch-ok — model selection errors are non-critical, picker shows error state
      handleModelSelect(model).catch(err => {
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
  const saveDisabled = isOllama ? isValidating || !ollamaUrl.trim() : isValidating || !apiKey.trim()

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
                  isConnected
                    ? 'bg-success'
                    : hasError
                      ? 'bg-destructive'
                      : 'bg-muted-foreground'
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
                          <Info
                            className="size-4 text-muted-foreground cursor-help"
                            aria-label="Direct connection information"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>
                            Direct connection sends requests straight from your browser to Ollama.
                            Requires CORS configured on your Ollama server (set{' '}
                            <code className="text-xs bg-muted px-1 rounded">OLLAMA_ORIGINS=*</code>
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
                  <p className="text-xs text-warning" role="alert">
                    Direct mode active. Ensure your Ollama server has CORS enabled.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          /* API Key Input (non-Ollama providers) */
          <div>
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="mt-1"
              data-testid="api-key-input"
              aria-invalid={hasError}
              aria-describedby={hasError ? 'connection-error' : undefined}
            />
          </div>
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

        {/* Save Button */}
        <Button
          onClick={() => {
            handleSave().catch(err => {
              console.error('Failed to save AI configuration:', err)
              toast.error('Failed to save configuration')
            })
          }}
          disabled={saveDisabled}
          data-testid="save-ai-config-button"
          className="min-h-[44px] rounded-lg"
        >
          {isValidating ? 'Testing...' : showSuccess ? 'Saved!' : 'Save & Test Connection'}
        </Button>

        {/* Per-Feature Consent Toggles */}
        {isConnected && (
          <div className="space-y-4 pt-4 border-t border-border animate-in fade-in-0 slide-in-from-top-1 duration-300">
            <h3 className="text-sm font-medium">Feature Permissions</h3>
            <p className="text-sm text-muted-foreground">
              Control which AI features can transmit data to {AI_PROVIDERS[settings.provider].name}
            </p>

            <div className="space-y-4" data-testid="consent-toggles">
              {(Object.entries(FEATURE_LABELS) as [keyof ConsentSettings, string][]).map(
                ([key, label]) => (
                  <div key={key} className="flex items-center justify-between min-h-[44px]">
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
                )
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
