/**
 * AI Configuration Settings Component
 *
 * Provides secure AI provider configuration with:
 * - Provider selection (OpenAI, Anthropic)
 * - Encrypted API key storage
 * - Connection testing and status feedback
 * - Per-feature consent toggles for data transmission control
 * - Cross-tab synchronization
 *
 * Follows ReminderSettings.tsx pattern for state management and accessibility.
 */

import { useState, useEffect, useRef } from 'react'
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
import { CheckCircle2, AlertTriangle, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import {
  getAIConfiguration,
  saveAIConfiguration,
  testAIConnection,
  applyOllamaCSP,
  AI_PROVIDERS,
  type AIConfigurationSettings,
  type AIProviderId,
  type ConsentSettings,
} from '@/lib/aiConfiguration'

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
  const [settings, setSettings] = useState<AIConfigurationSettings>(getAIConfiguration)
  const [apiKey, setApiKey] = useState('')
  const [ollamaModelInput, setOllamaModelInput] = useState(
    () => getAIConfiguration().ollamaModel || 'llama3.2'
  )
  const [isValidating, setIsValidating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const successTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const isOllama = settings.provider === 'ollama'

  // Cross-tab synchronization
  useEffect(() => {
    function handleStorageUpdate(e: StorageEvent) {
      // Only respond to ai-configuration changes from other tabs
      if (e.key === 'ai-configuration') {
        setSettings(getAIConfiguration())
      }
    }

    function handleCustomUpdate() {
      // Same-tab updates (storage event doesn't fire in same tab)
      setSettings(getAIConfiguration())
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('ai-configuration-updated', handleCustomUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('ai-configuration-updated', handleCustomUpdate)
      // Clear any pending success timeout on unmount
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Handles provider selection change
   */
  async function handleProviderChange(provider: AIProviderId) {
    await saveAIConfiguration({ provider, connectionStatus: 'unconfigured' })
    setApiKey('')
    setShowAdvanced(false)
    const updated = getAIConfiguration()
    setSettings(updated)
    if (provider === 'ollama') {
      setOllamaModelInput(updated.ollamaModel || 'llama3.2')
    }
  }

  /**
   * Validates API key (or Ollama URL) and saves configuration
   */
  async function handleSave() {
    if (!apiKey.trim()) {
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: isOllama ? 'Ollama server URL is required' : 'API key is required',
      })
      return
    }

    const provider = AI_PROVIDERS[settings.provider]
    if (!provider.validateApiKey(apiKey)) {
      setSettings({
        ...settings,
        connectionStatus: 'error',
        errorMessage: isOllama
          ? 'Invalid URL format. Must start with http:// or https://'
          : 'Invalid API key format',
      })
      return
    }

    setIsValidating(true)

    try {
      if (isOllama) {
        // Ollama: store URL and model as plaintext (no encryption), apply CSP update
        const model = ollamaModelInput.trim() || 'llama3.2'
        await saveAIConfiguration({
          ollamaBaseUrl: apiKey.trim(),
          ollamaModel: model,
          connectionStatus: 'connected',
        })
        applyOllamaCSP(apiKey.trim())
      } else {
        // Test connection for API-key providers
        const isConnected = await testAIConnection(settings.provider, apiKey)
        if (!isConnected) {
          setSettings({
            ...settings,
            connectionStatus: 'error',
            errorMessage: 'Connection test failed',
          })
          return
        }
        await saveAIConfiguration({ connectionStatus: 'connected' }, apiKey)
      }

      setShowSuccess(true)
      setApiKey('')
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 3000)
      setSettings(getAIConfiguration())
    } catch (error) {
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
   * Toggles Ollama direct connection mode
   */
  async function handleDirectConnectionToggle(enabled: boolean) {
    await saveAIConfiguration({ ollamaDirectConnection: enabled })
    setSettings(getAIConfiguration())
  }

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5" aria-hidden="true" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div>
          <Label htmlFor="ai-provider">AI Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={value =>
              handleProviderChange(value as AIProviderId).catch(err =>
                console.error('Failed to change AI provider:', err)
              )
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

        {/* API Key or Ollama URL Input */}
        <div>
          <Label htmlFor="api-key">{isOllama ? 'Ollama Server URL' : 'API Key'}</Label>
          <Input
            id="api-key"
            type={isOllama ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={isOllama ? 'http://192.168.1.x:11434' : 'Enter your API key'}
            className="mt-1"
            data-testid={isOllama ? 'ollama-url-input' : 'api-key-input'}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'connection-error' : undefined}
          />
        </div>

        {/* Ollama Model Selection */}
        {isOllama && (
          <div>
            <Label htmlFor="ollama-model">Model</Label>
            <Input
              id="ollama-model"
              type="text"
              value={ollamaModelInput}
              onChange={e => setOllamaModelInput(e.target.value)}
              placeholder="llama3.2"
              className="mt-1"
              data-testid="ollama-model-input"
            />
          </div>
        )}

        {/* Ollama Advanced Settings */}
        {isOllama && (
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors rounded-lg"
              aria-expanded={showAdvanced}
              aria-controls="ollama-advanced"
              data-testid="ollama-advanced-toggle"
            >
              Advanced
              {showAdvanced ? (
                <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
            {showAdvanced && (
              <div
                id="ollama-advanced"
                className="border-t border-border px-4 py-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                <div className="flex items-center justify-between min-h-[44px]">
                  <div>
                    <Label htmlFor="ollama-direct" className="cursor-pointer">
                      Direct Connection
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requires CORS on Ollama server (
                      <code className="font-mono">OLLAMA_ORIGINS=*</code>)
                    </p>
                  </div>
                  <Switch
                    id="ollama-direct"
                    checked={settings.ollamaDirectConnection ?? false}
                    onCheckedChange={checked =>
                      handleDirectConnectionToggle(checked).catch(err =>
                        console.error('Failed to update Ollama direct connection:', err)
                      )
                    }
                    data-testid="ollama-direct-toggle"
                    aria-label="Direct connection to Ollama server"
                  />
                </div>
              </div>
            )}
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
              Connected
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

        {/* Save Button */}
        <Button
          variant="brand"
          onClick={handleSave}
          disabled={isValidating || !apiKey.trim()}
          data-testid="save-ai-config-button"
          className="min-h-[44px] rounded-lg"
        >
          {isValidating
            ? isOllama
              ? 'Saving...'
              : 'Testing...'
            : showSuccess
              ? 'Saved!'
              : isOllama
                ? 'Save URL'
                : 'Save & Test Connection'}
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
                        updateConsent(key, checked).catch(err =>
                          console.error(`Failed to update consent for ${key}:`, err)
                        )
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
