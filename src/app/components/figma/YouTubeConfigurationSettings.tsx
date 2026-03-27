/**
 * YouTube Configuration Settings Component
 *
 * Provides secure YouTube API configuration with:
 * - YouTube Data API v3 key input (encrypted storage via Web Crypto AES-GCM)
 * - yt-dlp server URL (optional, SSRF-validated)
 * - Whisper endpoint URL (optional, SSRF-validated)
 * - Metadata cache TTL slider (1-30 days, default 7)
 * - Cross-tab synchronization
 *
 * Follows AIConfigurationSettings.tsx pattern for state management and accessibility.
 */

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { Youtube, Key, Server, Info, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import {
  getYouTubeConfiguration,
  saveYouTubeConfiguration,
  validateYouTubeApiKey,
  clearYouTubeApiKey,
  DEFAULT_CACHE_TTL_DAYS,
  MIN_CACHE_TTL_DAYS,
  MAX_CACHE_TTL_DAYS,
  type YouTubeConfig,
} from '@/lib/youtubeConfiguration'
import { isAllowedProxyUrl, getProxyUrlRejectionReason } from '@/lib/ssrfProtection'
import { cn } from '@/app/components/ui/utils'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

export function YouTubeConfigurationSettings() {
  const [config, setConfig] = useState<YouTubeConfig>(getYouTubeConfiguration)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [ytDlpUrl, setYtDlpUrl] = useState(() => getYouTubeConfiguration().ytDlpServerUrl ?? '')
  const [whisperUrl, setWhisperUrl] = useState(
    () => getYouTubeConfiguration().whisperEndpointUrl ?? ''
  )
  const [cacheTtl, setCacheTtl] = useState(() => getYouTubeConfiguration().cacheTtlDays)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Track whether API key is already configured (encrypted)
  const hasApiKey = !!config.apiKeyEncrypted

  // Cross-tab synchronization
  useEffect(() => {
    function handleStorageUpdate(e: StorageEvent) {
      if (e.key === 'youtube-configuration') {
        const updated = getYouTubeConfiguration()
        setConfig(updated)
        setYtDlpUrl(updated.ytDlpServerUrl ?? '')
        setWhisperUrl(updated.whisperEndpointUrl ?? '')
        setCacheTtl(updated.cacheTtlDays)
      }
    }

    function handleCustomUpdate() {
      const updated = getYouTubeConfiguration()
      setConfig(updated)
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('youtube-configuration-updated', handleCustomUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('youtube-configuration-updated', handleCustomUpdate)
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Validates all fields and returns whether the form is valid
   */
  function validate(): boolean {
    const errors: Record<string, string> = {}

    // Validate API key format if provided
    if (apiKeyInput.trim() && !validateYouTubeApiKey(apiKeyInput.trim())) {
      errors.apiKey =
        'Invalid API key format. YouTube API keys start with "AIza" followed by 35 characters.'
    }

    // Validate yt-dlp URL if provided
    if (ytDlpUrl.trim()) {
      if (!isAllowedProxyUrl(ytDlpUrl.trim())) {
        const reason = getProxyUrlRejectionReason(ytDlpUrl.trim())
        errors.ytDlpUrl = reason ?? 'Invalid URL'
      }
    }

    // Validate Whisper URL if provided
    if (whisperUrl.trim()) {
      if (!isAllowedProxyUrl(whisperUrl.trim())) {
        const reason = getProxyUrlRejectionReason(whisperUrl.trim())
        errors.whisperUrl = reason ?? 'Invalid URL'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Saves all YouTube configuration settings
   */
  async function handleSave() {
    if (!validate()) return

    setIsSaving(true)
    try {
      const updates: Partial<YouTubeConfig> = {
        cacheTtlDays: cacheTtl,
        ytDlpServerUrl: ytDlpUrl.trim() || undefined,
        whisperEndpointUrl: whisperUrl.trim() || undefined,
      }

      const plaintextKey = apiKeyInput.trim() || undefined
      await saveYouTubeConfiguration(updates, plaintextKey)

      // Clear the plaintext input after encryption
      if (plaintextKey) {
        setApiKeyInput('')
      }

      setConfig(getYouTubeConfiguration())
      setShowSuccess(true)
      successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 3000)
      toastSuccess.saved('YouTube configuration')
    } catch (error) {
      console.error('Failed to save YouTube configuration:', error)
      toastError.saveFailed('YouTube configuration')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Clears the stored API key
   */
  async function handleClearApiKey() {
    try {
      await clearYouTubeApiKey()
      setConfig(getYouTubeConfiguration())
      setApiKeyInput('')
      toastSuccess.saved('YouTube API key removed')
    } catch (error) {
      console.error('Failed to clear YouTube API key:', error)
      toastError.saveFailed('Failed to remove API key')
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Youtube className="size-5 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">YouTube</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure YouTube API access and server endpoints
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6" data-testid="youtube-configuration-section">
        {/* YouTube API Key */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="youtube-api-key"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Key className="size-4 text-muted-foreground" aria-hidden="true" />
              YouTube Data API v3 Key
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="API key information"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    Get your API key from the{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-brand"
                    >
                      Google Cloud Console
                    </a>
                    . Enable the YouTube Data API v3 service. Your key is encrypted before storage
                    and never stored in plaintext.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {hasApiKey && !apiKeyInput && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>API key configured (encrypted)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearApiKey}
                className="text-destructive hover:text-destructive ml-auto min-h-[44px]"
                aria-label="Remove YouTube API key"
              >
                Remove
              </Button>
            </div>
          )}

          <div className="relative">
            <Input
              id="youtube-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={e => {
                setApiKeyInput(e.target.value)
                if (validationErrors.apiKey) {
                  setValidationErrors(prev => {
                    const next = { ...prev }
                    delete next.apiKey
                    return next
                  })
                }
              }}
              placeholder={hasApiKey ? 'Enter new key to replace existing' : 'AIza...'}
              className={cn(
                'pr-10 font-mono text-sm',
                validationErrors.apiKey && 'border-destructive'
              )}
              aria-describedby={validationErrors.apiKey ? 'api-key-error' : undefined}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {validationErrors.apiKey && (
            <p id="api-key-error" className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {validationErrors.apiKey}
            </p>
          )}
        </div>

        {/* yt-dlp Server URL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="ytdlp-url" className="text-sm font-medium flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
              yt-dlp Server URL
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="yt-dlp server information"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    URL of your self-hosted yt-dlp server for transcript extraction. Typically runs
                    on your LAN (e.g., http://192.168.1.100:5000). Loopback addresses are blocked
                    for security.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="ytdlp-url"
            type="url"
            value={ytDlpUrl}
            onChange={e => {
              setYtDlpUrl(e.target.value)
              if (validationErrors.ytDlpUrl) {
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.ytDlpUrl
                  return next
                })
              }
            }}
            placeholder="http://192.168.1.100:5000"
            className={cn('text-sm', validationErrors.ytDlpUrl && 'border-destructive')}
            aria-describedby={validationErrors.ytDlpUrl ? 'ytdlp-url-error' : undefined}
          />
          {validationErrors.ytDlpUrl && (
            <p id="ytdlp-url-error" className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {validationErrors.ytDlpUrl}
            </p>
          )}
        </div>

        {/* Whisper Endpoint URL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="whisper-url" className="text-sm font-medium flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
              Whisper Endpoint URL
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Whisper endpoint information"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    URL of your Whisper-compatible transcription server for audio-to-text
                    conversion. Used as a fallback when YouTube captions are unavailable. Loopback
                    addresses are blocked for security.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="whisper-url"
            type="url"
            value={whisperUrl}
            onChange={e => {
              setWhisperUrl(e.target.value)
              if (validationErrors.whisperUrl) {
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.whisperUrl
                  return next
                })
              }
            }}
            placeholder="http://192.168.1.100:9000"
            className={cn('text-sm', validationErrors.whisperUrl && 'border-destructive')}
            aria-describedby={validationErrors.whisperUrl ? 'whisper-url-error' : undefined}
          />
          {validationErrors.whisperUrl && (
            <p
              id="whisper-url-error"
              className="text-sm text-destructive flex items-center gap-1.5"
            >
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {validationErrors.whisperUrl}
            </p>
          )}
        </div>

        {/* Cache TTL Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="cache-ttl" className="text-sm font-medium">
              Metadata Cache Duration
            </Label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {cacheTtl} {cacheTtl === 1 ? 'day' : 'days'}
            </span>
          </div>
          <Slider
            id="cache-ttl"
            min={MIN_CACHE_TTL_DAYS}
            max={MAX_CACHE_TTL_DAYS}
            step={1}
            value={[cacheTtl]}
            onValueChange={([value]) => setCacheTtl(value)}
            aria-label={`Cache duration: ${cacheTtl} days`}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            How long to cache video metadata before re-fetching from YouTube. Default:{' '}
            {DEFAULT_CACHE_TTL_DAYS} days.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving}
            className="min-h-[44px]"
            aria-label="Save YouTube configuration"
          >
            {isSaving ? 'Saving...' : 'Save YouTube Settings'}
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
