/**
 * Per-Feature Model Override Panel
 *
 * Progressive disclosure panel shown beneath each consent toggle,
 * allowing power users to assign specific provider/model combinations
 * to individual AI features.
 *
 * @see E90-S06 — Build Per-Feature Model Override UI
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import { ProviderModelPicker } from './ProviderModelPicker'
import {
  saveFeatureModelOverride,
  clearFeatureModelOverride,
  getConfiguredProviderIds,
  getDecryptedApiKeyForProvider,
  AI_PROVIDERS,
  FEATURE_DEFAULTS,
  type AIFeatureId,
  type AIProviderId,
  type FeatureModelConfig,
} from '@/lib/aiConfiguration'

interface FeatureModelOverridePanelProps {
  /** AI feature ID this panel controls */
  feature: AIFeatureId
  /** Current override config from settings (undefined = using defaults) */
  currentOverride?: FeatureModelConfig
  /** Whether the parent consent toggle is enabled */
  isConsentEnabled: boolean
  /** Called after save so parent can refresh state */
  onConfigChanged: () => void
}

export function FeatureModelOverridePanel({
  feature,
  currentOverride,
  isConsentEnabled,
  onConfigChanged,
}: FeatureModelOverridePanelProps) {
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(!!currentOverride)
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    currentOverride?.provider || FEATURE_DEFAULTS[feature]?.provider || 'openai'
  )
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    currentOverride?.model
  )
  const [apiKeyForProvider, setApiKeyForProvider] = useState<string | null>(null)
  const [configuredProviders, setConfiguredProviders] = useState<AIProviderId[]>([])

  // Sync override enabled state with actual config
  useEffect(() => {
    setIsOverrideEnabled(!!currentOverride)
    if (currentOverride) {
      setSelectedProvider(currentOverride.provider)
      setSelectedModel(currentOverride.model)
    }
  }, [currentOverride])

  // Fetch configured providers (refresh when keys change)
  useEffect(() => {
    const refresh = () => setConfiguredProviders(getConfiguredProviderIds())
    refresh()
    window.addEventListener('ai-configuration-updated', refresh)
    return () => window.removeEventListener('ai-configuration-updated', refresh)
  }, [])

  // Fetch API key for selected provider
  useEffect(() => {
    if (isOverrideEnabled) {
      // silent-catch-ok: decryption failure is non-critical, picker won't render
      getDecryptedApiKeyForProvider(selectedProvider)
        .then(key => setApiKeyForProvider(key))
        .catch(() => setApiKeyForProvider(null))
    }
  }, [selectedProvider, isOverrideEnabled])

  // AC5: Don't render if consent is disabled
  if (!isConsentEnabled) return null

  const handleOverrideToggle = useCallback(
    async (enabled: boolean) => {
      setIsOverrideEnabled(enabled)
      if (!enabled) {
        // AC4: Clear override when disabled
        try {
          await clearFeatureModelOverride(feature)
          setSelectedModel(undefined)
          onConfigChanged()
        } catch (err) {
          console.error(`Failed to clear override for ${feature}:`, err)
          toast.error('Failed to clear model override')
        }
      }
    },
    [feature, onConfigChanged]
  )

  const handleProviderChange = async (provider: AIProviderId) => {
    setSelectedProvider(provider)
    setSelectedModel(undefined) // Reset model when provider changes
    // Don't save yet — user needs to pick a model
  }

  const handleModelSelect = useCallback(
    async (modelId: string) => {
      setSelectedModel(modelId)
      // AC3: Auto-save on change
      try {
        await saveFeatureModelOverride(feature, {
          provider: selectedProvider,
          model: modelId,
        })
        onConfigChanged()
      } catch (err) {
        console.error(`Failed to save override for ${feature}:`, err)
        toast.error('Failed to save model override')
      }
    },
    [feature, selectedProvider, onConfigChanged]
  )

  const handleResetToDefaults = useCallback(async () => {
    try {
      await clearFeatureModelOverride(feature)
      setIsOverrideEnabled(false)
      setSelectedModel(undefined)
      setSelectedProvider(FEATURE_DEFAULTS[feature]?.provider || 'openai')
      onConfigChanged()
      toast.success('Reset to default model')
    } catch (err) {
      console.error(`Failed to reset override for ${feature}:`, err)
      toast.error('Failed to reset model override')
    }
  }, [feature, onConfigChanged])

  const featureDefault = FEATURE_DEFAULTS[feature]
  const defaultLabel = featureDefault
    ? `${AI_PROVIDERS[featureDefault.provider]?.name}: ${featureDefault.model}`
    : 'System default'

  return (
    <div className="ml-0 mt-1" data-testid={`feature-override-${feature}`}>
      {/* AC1: Override model toggle */}
      <div className="flex items-center gap-2 min-h-[44px]">
        <Switch
          id={`override-toggle-${feature}`}
          checked={isOverrideEnabled}
          onCheckedChange={checked => {
            handleOverrideToggle(checked).catch(err => {
              console.error(`Failed to toggle override for ${feature}:`, err)
              toast.error('Failed to toggle model override')
            })
          }}
          className="scale-75"
          data-testid={`override-toggle-${feature}`}
          aria-label={`Override model for ${feature}`}
        />
        <Label
          htmlFor={`override-toggle-${feature}`}
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Override model
          {!isOverrideEnabled && (
            <span className="ml-1 text-muted-foreground/60">({defaultLabel})</span>
          )}
        </Label>
      </div>

      {/* AC2: Expandable override panel */}
      <Collapsible open={isOverrideEnabled}>
        <CollapsibleContent className="mt-2 ml-6 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* AC6: Provider dropdown (only providers with configured keys) */}
          <div>
            <Label
              htmlFor={`override-provider-${feature}`}
              className="text-xs font-medium"
            >
              Provider
            </Label>
            <Select
              value={selectedProvider}
              onValueChange={value => {
                handleProviderChange(value as AIProviderId).catch(err => {
                  console.error('Failed to change provider:', err)
                  toast.error('Failed to change provider')
                })
              }}
            >
              <SelectTrigger
                id={`override-provider-${feature}`}
                className="mt-1 w-full h-9 text-sm"
                data-testid={`override-provider-${feature}`}
                aria-label={`Select provider for ${feature}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {configuredProviders.map(providerId => (
                  <SelectItem key={providerId} value={providerId}>
                    {AI_PROVIDERS[providerId]?.name || providerId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model picker using ProviderModelPicker */}
          {apiKeyForProvider && (
            <ProviderModelPicker
              provider={selectedProvider}
              apiKey={apiKeyForProvider}
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              label="Model"
              showCustomInput={true}
              testIdPrefix={`override-model-${feature}`}
            />
          )}

          {/* AC4: Reset to defaults button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              handleResetToDefaults().catch(err => {
                console.error('Failed to reset:', err)
                toast.error('Failed to reset model override')
              })
            }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            data-testid={`override-reset-${feature}`}
            aria-label={`Reset ${feature} to default model`}
          >
            <RotateCcw className="size-3 mr-1.5" aria-hidden="true" />
            Reset to defaults
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
