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
import { CheckCircle2, AlertTriangle, Settings } from 'lucide-react'
import {
  getAIConfiguration,
  saveAIConfiguration,
  testAIConnection,
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
  const [isValidating, setIsValidating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const successTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

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
    await saveAIConfiguration({ provider })
    setSettings(getAIConfiguration())
  }

  /**
   * Validates API key and tests connection
   */
  async function handleSave() {
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

        {/* API Key Input */}
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
          onClick={handleSave}
          disabled={isValidating || !apiKey.trim()}
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
