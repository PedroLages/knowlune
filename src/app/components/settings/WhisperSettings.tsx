/**
 * Whisper Speech-to-Text Settings Component
 *
 * Configures the audio transcription provider with three tiers:
 * - Browser: WebAssembly-based local transcription (zero config)
 * - Cloud: Groq/OpenAI API (reuses keys from AI Configuration)
 * - Self-hosted: Speaches/faster-whisper Docker server
 *
 * Cross-tab synchronized via storage event listener.
 * Follows YouTubeConfigurationSettings.tsx card layout pattern.
 */

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { Mic, Info, CheckCircle2, AlertTriangle, Loader2, Server, Cpu, Cloud } from 'lucide-react'
import {
  getWhisperConfig,
  saveWhisperConfig,
  WHISPER_STORAGE_KEY,
  type WhisperConfig,
  type WhisperProviderId,
} from '@/lib/whisper'
import { getConfiguredProviderIds, type AIProviderId } from '@/lib/aiConfiguration'
import { getYouTubeConfiguration, saveYouTubeConfiguration } from '@/lib/youtubeConfiguration'
import { isAllowedProxyUrl, getProxyUrlRejectionReason } from '@/lib/ssrfProtection'
import { cn } from '@/app/components/ui/utils'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

/** Provider option metadata for the radio group */
const PROVIDER_OPTIONS: {
  id: WhisperProviderId
  label: string
  tag: string
  description: string
  icon: typeof Cpu
}[] = [
  {
    id: 'browser',
    label: 'Browser',
    tag: 'Free',
    description:
      'Runs locally in your browser using WebAssembly. No server or API key needed. Best for short audio.',
    icon: Cpu,
  },
  {
    id: 'groq',
    label: 'Cloud',
    tag: 'Groq/OpenAI',
    description:
      'Uses your existing AI API key for fast cloud transcription. Best for longer audio and YouTube fallback.',
    icon: Cloud,
  },
  {
    id: 'self-hosted',
    label: 'Self-Hosted',
    tag: '',
    description:
      'Connect to your own Whisper server (Speaches, faster-whisper). Best for privacy and unlimited use.',
    icon: Server,
  },
]

/** Cloud providers that support Whisper */
const WHISPER_CLOUD_PROVIDERS: AIProviderId[] = ['groq', 'openai']

export function WhisperSettings() {
  const [config, setConfig] = useState<WhisperConfig>(getWhisperConfig)
  const [serverUrl, setServerUrl] = useState(
    () => getYouTubeConfiguration().whisperEndpointUrl ?? ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const testResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Detect which cloud providers have API keys configured (async — Vault check)
  const [configuredProviders, setConfiguredProviders] = useState<AIProviderId[]>([])
  useEffect(() => {
    getConfiguredProviderIds().then(setConfiguredProviders)
  }, [])
  const cloudProvidersWithKeys = WHISPER_CLOUD_PROVIDERS.filter(p =>
    configuredProviders.includes(p)
  )

  // Cross-tab synchronization
  useEffect(() => {
    function handleStorageUpdate(e: StorageEvent) {
      if (e.key === WHISPER_STORAGE_KEY) {
        setConfig(getWhisperConfig())
      }
      if (e.key === 'youtube-configuration') {
        setServerUrl(getYouTubeConfiguration().whisperEndpointUrl ?? '')
      }
    }

    function handleCustomUpdate() {
      setConfig(getWhisperConfig())
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('whisper-configuration-updated', handleCustomUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('whisper-configuration-updated', handleCustomUpdate)
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Resolves the effective provider for radio group display.
   * Cloud providers (groq/openai) map to 'groq' radio option.
   */
  function getEffectiveRadioValue(): WhisperProviderId {
    if (config.provider === 'openai') return 'groq'
    return config.provider
  }

  /**
   * Handles provider radio change. For cloud, selects the first
   * configured provider (preferring groq).
   */
  function handleProviderChange(value: string) {
    const id = value as WhisperProviderId
    if (id === 'groq') {
      // Pick the best cloud provider: prefer groq if configured, else openai
      const preferred: WhisperProviderId = cloudProvidersWithKeys.includes('groq')
        ? 'groq'
        : cloudProvidersWithKeys.includes('openai')
          ? 'openai'
          : 'groq'
      setConfig(prev => ({ ...prev, provider: preferred }))
    } else {
      setConfig(prev => ({ ...prev, provider: id }))
    }
  }

  /**
   * Validates form before save
   */
  function validate(): boolean {
    const errors: Record<string, string> = {}

    if (config.provider === 'self-hosted' && serverUrl.trim()) {
      if (!isAllowedProxyUrl(serverUrl.trim())) {
        const reason = getProxyUrlRejectionReason(serverUrl.trim())
        errors.serverUrl = reason ?? 'Invalid URL'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Tests self-hosted server connectivity
   */
  async function handleTestConnection() {
    const url = serverUrl.trim()
    if (!url) {
      setTestResult({ success: false, message: 'Enter a server URL first.' })
      return
    }

    if (!isAllowedProxyUrl(url)) {
      const reason = getProxyUrlRejectionReason(url)
      setTestResult({ success: false, message: reason ?? 'Invalid URL' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/whisper/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: url.replace(/\/+$/, '') }),
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        setTestResult({ success: true, message: 'Server is reachable and healthy.' })
        if (testResultTimeoutRef.current) {
          clearTimeout(testResultTimeoutRef.current)
        }
        testResultTimeoutRef.current = setTimeout(() => setTestResult(null), 8000)
      } else {
        setTestResult({
          success: false,
          message: `Server responded with status ${response.status}. Check your Whisper server configuration.`,
        })
      }
    } catch {
      // silent-catch-ok: network error displayed via testResult state
      setTestResult({
        success: false,
        message: 'Could not reach server. Verify the URL and that the server is running.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  /**
   * Saves whisper config and (if self-hosted) the server URL to YouTube config
   */
  async function handleSave() {
    if (!validate()) return

    setIsSaving(true)
    try {
      saveWhisperConfig({
        provider: config.provider,
        browserModel: config.browserModel,
      })

      // Sync self-hosted URL to YouTube configuration
      if (config.provider === 'self-hosted') {
        await saveYouTubeConfiguration({
          whisperEndpointUrl: serverUrl.trim() || undefined,
        })
      }

      setShowSuccess(true)
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 3000)
      toastSuccess.saved('Speech-to-Text configuration')
    } catch (error) {
      console.error('Failed to save Whisper configuration:', error)
      toastError.saveFailed('Speech-to-Text configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const isCloud = config.provider === 'groq' || config.provider === 'openai'
  const isSelfHosted = config.provider === 'self-hosted'
  const isBrowser = config.provider === 'browser'

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Mic className="size-5 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">Speech-to-Text</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure audio transcription provider
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6" data-testid="whisper-settings-section">
        {/* Provider Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Transcription Provider</Label>
          <RadioGroup
            value={getEffectiveRadioValue()}
            onValueChange={handleProviderChange}
            className="space-y-3"
            aria-label="Select transcription provider"
          >
            {PROVIDER_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <label
                  key={option.id}
                  htmlFor={`whisper-provider-${option.id}`}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors min-h-[44px]',
                    getEffectiveRadioValue() === option.id
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`whisper-provider-${option.id}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm font-medium">{option.label}</span>
                      {option.tag && (
                        <span className="text-xs text-brand-soft-foreground bg-brand-soft px-1.5 py-0.5 rounded">
                          {option.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Browser Provider Settings */}
        {isBrowser && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Model Size</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Model size information"
                      >
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>
                        <strong>Tiny</strong> (~75 MB) is faster to download and runs well on most
                        devices. <strong>Base</strong> (~150 MB) is more accurate but slower.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <RadioGroup
                value={config.browserModel ?? 'tiny'}
                onValueChange={value =>
                  setConfig(prev => ({
                    ...prev,
                    browserModel: value as 'tiny' | 'base',
                  }))
                }
                className="flex gap-4"
                aria-label="Select browser model size"
              >
                <label
                  htmlFor="whisper-model-tiny"
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-colors min-h-[44px]',
                    (config.browserModel ?? 'tiny') === 'tiny'
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem value="tiny" id="whisper-model-tiny" />
                  <div>
                    <span className="text-sm font-medium">Tiny</span>
                    <p className="text-xs text-muted-foreground">~75 MB, faster</p>
                  </div>
                </label>
                <label
                  htmlFor="whisper-model-base"
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-colors min-h-[44px]',
                    config.browserModel === 'base'
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem value="base" id="whisper-model-base" />
                  <div>
                    <span className="text-sm font-medium">Base</span>
                    <p className="text-xs text-muted-foreground">~150 MB, more accurate</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>Ready — no setup needed</span>
            </div>
          </div>
        )}

        {/* Cloud Provider Settings */}
        {isCloud && (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <Label className="text-sm font-medium">API Key Status</Label>
            <div className="space-y-2">
              {WHISPER_CLOUD_PROVIDERS.map(providerId => {
                const hasKey = cloudProvidersWithKeys.includes(providerId)
                const providerName = providerId === 'groq' ? 'Groq' : 'OpenAI'
                return (
                  <div key={providerId} className="flex items-center gap-2 text-sm">
                    {hasKey ? (
                      <>
                        <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden="true" />
                        <span className="text-success">
                          {providerName} key detected — ready for Whisper
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle
                          className="size-4 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-muted-foreground">
                          {providerName} key not configured
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {cloudProvidersWithKeys.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Configure a Groq or OpenAI key in AI Settings above to enable cloud transcription.
              </p>
            )}
          </div>
        )}

        {/* Self-Hosted Provider Settings */}
        {isSelfHosted && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="whisper-server-url"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <Server className="size-4 text-muted-foreground" aria-hidden="true" />
                  Server URL
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Server URL information"
                      >
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>
                        URL of your Whisper-compatible server (Speaches, faster-whisper-server).
                        Typically runs on your LAN (e.g., http://192.168.1.100:9000). Loopback
                        addresses are blocked for security.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="whisper-server-url"
                type="url"
                value={serverUrl}
                onChange={e => {
                  setServerUrl(e.target.value)
                  if (validationErrors.serverUrl) {
                    setValidationErrors(prev => {
                      const next = { ...prev }
                      delete next.serverUrl
                      return next
                    })
                  }
                }}
                placeholder="http://192.168.1.100:9000"
                className={cn('text-sm', validationErrors.serverUrl && 'border-destructive')}
                aria-describedby={validationErrors.serverUrl ? 'whisper-url-error' : undefined}
              />
              {validationErrors.serverUrl && (
                <p
                  id="whisper-url-error"
                  className="text-sm text-destructive flex items-center gap-1.5"
                >
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                  {validationErrors.serverUrl}
                </p>
              )}
            </div>

            {/* Test Connection */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleTestConnection().catch(err => {
                    console.error('Whisper test connection failed:', err)
                    toastError.saveFailed('connection test')
                  })
                }}
                disabled={isTesting || !serverUrl.trim()}
                className="min-h-[44px]"
                aria-label="Test Whisper server connection"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>

              {testResult && (
                <div
                  className={cn(
                    'flex items-start gap-2 text-sm rounded-lg p-3',
                    testResult.success
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  )}
                  role="alert"
                >
                  {testResult.success ? (
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="brand"
            onClick={() => {
              handleSave().catch(err => {
                console.error('Failed to save Whisper settings:', err)
                toastError.saveFailed('Speech-to-Text configuration')
              })
            }}
            disabled={isSaving}
            className="min-h-[44px]"
            aria-label="Save speech-to-text configuration"
          >
            {isSaving ? 'Saving...' : 'Save Speech-to-Text Settings'}
          </Button>

          {showSuccess && (
            <span className="text-sm text-success flex items-center gap-1.5" role="status">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Settings saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
