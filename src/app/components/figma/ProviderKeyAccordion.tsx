/**
 * ProviderKeyAccordion — Per-provider API key management (E90-S10)
 *
 * Replaces the single-key input with an accordion of per-provider sections,
 * each with: provider name, API key input, test connection button, and status badge.
 *
 * Uses saveProviderApiKey() from E90-S03 for encrypted key storage.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { CheckCircle2, AlertTriangle, Loader2, KeyRound } from 'lucide-react'
import {
  AI_PROVIDERS,
  getAIConfiguration,
  getDecryptedApiKeyForProvider,
  saveProviderApiKey,
  testAIConnection,
  type AIProviderId,
} from '@/lib/aiConfiguration'
import { cn } from '@/app/components/ui/utils'

/** Providers that use API keys (not server URLs like Ollama) — derived from AI_PROVIDERS to prevent drift */
const API_KEY_PROVIDERS: AIProviderId[] = (Object.keys(AI_PROVIDERS) as AIProviderId[]).filter(
  id => id !== 'ollama'
)

interface ProviderKeyStatus {
  hasKey: boolean
  isConnected: boolean
  isLegacy: boolean
}

interface ProviderKeyAccordionProps {
  /** Called after any key is saved, so parent can refresh config */
  onConfigChanged: () => void
}

export function ProviderKeyAccordion({ onConfigChanged }: ProviderKeyAccordionProps) {
  const [keyInputs, setKeyInputs] = useState<Partial<Record<AIProviderId, string>>>({})
  const [testing, setTesting] = useState<Partial<Record<AIProviderId, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<AIProviderId, string>>>({})
  const [successes, setSuccesses] = useState<Partial<Record<AIProviderId, boolean>>>({})
  const [providerStatuses, setProviderStatuses] = useState<
    Partial<Record<AIProviderId, ProviderKeyStatus>>
  >({})

  // Load provider key statuses on mount and when config changes
  const refreshStatuses = useCallback(async () => {
    const config = getAIConfiguration()

    const entries = await Promise.all(
      API_KEY_PROVIDERS.map(async (providerId) => {
        const hasProviderKey = !!config.providerKeys?.[providerId]
        // AC4: Legacy key shows under its provider section
        const isLegacyProvider = providerId === config.provider && !!config.apiKeyEncrypted
        const hasKey = hasProviderKey || isLegacyProvider

        // Check if we can decrypt the key (proves it's valid)
        let isConnected = false
        if (hasKey) {
          const decrypted = await getDecryptedApiKeyForProvider(providerId)
          isConnected = decrypted !== null
        }

        return [providerId, { hasKey, isConnected, isLegacy: isLegacyProvider && !hasProviderKey }] as const
      })
    )

    const statuses: Partial<Record<AIProviderId, ProviderKeyStatus>> = Object.fromEntries(entries)
    setProviderStatuses(statuses)
  }, [])

  useEffect(() => {
    // silent-catch-ok: status refresh failure is non-critical
    refreshStatuses().catch(() => {})
  }, [refreshStatuses])

  // Listen for config updates (cross-tab or same-tab)
  useEffect(() => {
    function handleUpdate() {
      // silent-catch-ok: status refresh failure is non-critical
      refreshStatuses().catch(() => {})
    }
    window.addEventListener('ai-configuration-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('ai-configuration-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [refreshStatuses])

  /**
   * AC2: Test and save API key for a specific provider
   */
  async function handleTestAndSave(providerId: AIProviderId) {
    const key = keyInputs[providerId]?.trim()
    if (!key) {
      setErrors(prev => ({ ...prev, [providerId]: 'API key is required' }))
      return
    }

    // Validate format
    const provider = AI_PROVIDERS[providerId]
    if (!provider.validateApiKey(key)) {
      setErrors(prev => ({ ...prev, [providerId]: 'Invalid API key format' }))
      return
    }

    setTesting(prev => ({ ...prev, [providerId]: true }))
    setErrors(prev => ({ ...prev, [providerId]: undefined }))
    setSuccesses(prev => ({ ...prev, [providerId]: false }))

    try {
      const connected = await testAIConnection(providerId, key)
      if (connected) {
        // AC2: Encrypt and save via saveProviderApiKey
        await saveProviderApiKey(providerId, key)
        setKeyInputs(prev => ({ ...prev, [providerId]: '' }))
        setSuccesses(prev => ({ ...prev, [providerId]: true }))
        setTimeout(() => setSuccesses(prev => ({ ...prev, [providerId]: false })), 3000)
        await refreshStatuses()
        onConfigChanged()
        toast.success(`${provider.name} API key saved`)
      } else {
        setErrors(prev => ({ ...prev, [providerId]: 'Connection test failed' }))
      }
    } catch (error) {
      // silent-catch-ok: error displayed inline via errors state
      setErrors(prev => ({
        ...prev,
        [providerId]: error instanceof Error ? error.message : 'Connection test failed',
      }))
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }))
    }
  }

  return (
    <div className="space-y-2" data-testid="provider-key-accordion">
      <Label className="text-sm font-medium">API Keys</Label>
      <p className="text-xs text-muted-foreground">
        Configure API keys for each provider you want to use.
      </p>

      <Accordion type="multiple" className="w-full">
        {API_KEY_PROVIDERS.map(providerId => {
          const provider = AI_PROVIDERS[providerId]
          const status = providerStatuses[providerId]
          const isTesting = testing[providerId] ?? false
          const error = errors[providerId]
          const success = successes[providerId] ?? false

          return (
            <AccordionItem key={providerId} value={providerId} data-testid={`provider-${providerId}`}>
              <AccordionTrigger className="min-h-[44px]">
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>{provider.name}</span>
                  {/* AC1: Status badge */}
                  {status?.hasKey && (
                    <Badge
                      variant={status.isConnected ? 'default' : 'outline'}
                      className={cn(
                        'ml-2 text-[10px]',
                        status.isConnected
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-muted text-muted-foreground'
                      )}
                      data-testid={`provider-status-${providerId}`}
                    >
                      {status.isConnected ? 'Connected' : 'Key saved'}
                      {/* AC4: Show legacy indicator */}
                      {status.isLegacy && ' (legacy)'}
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {/* AC5: Password input — never shows plaintext after save */}
                  <div>
                    <Label htmlFor={`api-key-${providerId}`} className="text-xs">
                      {status?.hasKey ? 'Update API Key' : 'Enter API Key'}
                    </Label>
                    <Input
                      id={`api-key-${providerId}`}
                      type="password"
                      value={keyInputs[providerId] ?? ''}
                      onChange={e =>
                        setKeyInputs(prev => ({ ...prev, [providerId]: e.target.value }))
                      }
                      placeholder={
                        status?.hasKey
                          ? '••••••••••••••••'
                          : `Enter ${provider.name} API key`
                      }
                      className="mt-1"
                      data-testid={`api-key-input-${providerId}`}
                      aria-invalid={!!error}
                      aria-describedby={error ? `key-error-${providerId}` : undefined}
                    />
                  </div>

                  {/* Error message */}
                  {error && (
                    <div
                      id={`key-error-${providerId}`}
                      className="flex items-center gap-2 text-sm text-destructive"
                      role="alert"
                    >
                      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                      {error}
                    </div>
                  )}

                  {/* Success message */}
                  {success && (
                    <div className="flex items-center gap-2 text-sm text-success" role="status">
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      Key saved and connected
                    </div>
                  )}

                  {/* AC2: Test Connection + Save button */}
                  <Button
                    variant="brand"
                    onClick={() => {
                      handleTestAndSave(providerId).catch(err => {
                        console.error(`Failed to test/save key for ${providerId}:`, err)
                        toast.error('Failed to save API key')
                      })
                    }}
                    disabled={isTesting || !(keyInputs[providerId]?.trim())}
                    data-testid={`save-key-${providerId}`}
                    className="min-h-[44px] rounded-lg"
                    aria-label={`Test and save ${provider.name} API key`}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                        Testing...
                      </>
                    ) : (
                      'Save & Test Connection'
                    )}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
