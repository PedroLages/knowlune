/**
 * Per-Feature Model Override Panel
 *
 * Progressive disclosure panel shown beneath each consent toggle,
 * allowing power users to assign specific provider/model combinations
 * to individual AI features.
 *
 * @see E90-S06 — Build Per-Feature Model Override UI
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Info } from 'lucide-react'
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
import { Slider } from '@/app/components/ui/slider'
import { Input } from '@/app/components/ui/input'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/app/components/ui/tooltip'
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
  const [temperature, setTemperature] = useState<number | undefined>(
    currentOverride?.temperature
  )
  const [maxTokens, setMaxTokens] = useState<number | undefined>(
    currentOverride?.maxTokens
  )
  const [apiKeyForProvider, setApiKeyForProvider] = useState<string | null>(null)
  const [configuredProviders, setConfiguredProviders] = useState<AIProviderId[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync override enabled state with actual config
  useEffect(() => {
    setIsOverrideEnabled(!!currentOverride)
    if (currentOverride) {
      setSelectedProvider(currentOverride.provider)
      setSelectedModel(currentOverride.model)
      setTemperature(currentOverride.temperature)
      setMaxTokens(currentOverride.maxTokens)
    }
  }, [currentOverride])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

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
          ...(temperature !== undefined && { temperature }),
          ...(maxTokens !== undefined && { maxTokens }),
        })
        onConfigChanged()
      } catch (err) {
        console.error(`Failed to save override for ${feature}:`, err)
        toast.error('Failed to save model override')
      }
    },
    [feature, selectedProvider, temperature, maxTokens, onConfigChanged]
  )

  const handleResetToDefaults = useCallback(async () => {
    try {
      await clearFeatureModelOverride(feature)
      setIsOverrideEnabled(false)
      setSelectedModel(undefined)
      setTemperature(undefined)
      setMaxTokens(undefined)
      setSelectedProvider(FEATURE_DEFAULTS[feature]?.provider || 'openai')
      onConfigChanged()
      toast.success('Reset to default model')
    } catch (err) {
      console.error(`Failed to reset override for ${feature}:`, err)
      toast.error('Failed to reset model override')
    }
  }, [feature, onConfigChanged])

  // AC4: Debounced save for slider/input changes (500ms)
  const debouncedSave = useCallback(
    (updates: Partial<FeatureModelConfig>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await saveFeatureModelOverride(feature, {
            provider: selectedProvider,
            model: selectedModel || FEATURE_DEFAULTS[feature]?.model || '',
            ...(temperature !== undefined && { temperature }),
            ...(maxTokens !== undefined && { maxTokens }),
            ...updates,
          })
          onConfigChanged()
        } catch (err) {
          console.error(`Failed to save override for ${feature}:`, err)
          toast.error('Failed to save model settings')
        }
      }, 500)
    },
    [feature, selectedProvider, selectedModel, temperature, maxTokens, onConfigChanged]
  )

  // AC1: Temperature slider handler
  const handleTemperatureChange = useCallback(
    (value: number[]) => {
      const temp = value[0]
      setTemperature(temp)
      debouncedSave({ temperature: temp })
    },
    [debouncedSave]
  )

  // AC2: Max tokens input handler
  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        setMaxTokens(undefined)
        debouncedSave({ maxTokens: undefined })
        return
      }
      const val = Math.min(32000, Math.max(100, parseInt(raw, 10) || 100))
      setMaxTokens(val)
      debouncedSave({ maxTokens: val })
    },
    [debouncedSave]
  )

  /** Temperature preset suggestions */
  const TEMPERATURE_PRESETS = [
    { label: 'Precise', value: 0.1 },
    { label: 'Balanced', value: 0.7 },
    { label: 'Creative', value: 1.2 },
  ] as const

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

          {/* AC1: Temperature slider (0.0–2.0, step 0.1) */}
          <div data-testid={`override-temperature-${feature}`}>
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor={`override-temp-${feature}`}
                className="text-xs font-medium"
              >
                Temperature
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info
                    className="size-3 text-muted-foreground cursor-help"
                    aria-label="Temperature info"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  Lower = more deterministic, Higher = more creative
                </TooltipContent>
              </Tooltip>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {temperature !== undefined ? temperature.toFixed(1) : (
                  <span className="italic">Default</span>
                )}
              </span>
            </div>
            <Slider
              id={`override-temp-${feature}`}
              min={0}
              max={20}
              step={1}
              value={temperature !== undefined ? [Math.round(temperature * 10)] : [7]}
              onValueChange={(val: number[]) => handleTemperatureChange([val[0] / 10])}
              className="mt-1.5"
              aria-label={`Temperature for ${feature}`}
              aria-valuetext={temperature !== undefined ? `${temperature.toFixed(1)}` : 'Default (0.7)'}
              data-testid={`override-temp-slider-${feature}`}
            />
            <div className="flex gap-1 mt-1.5">
              {TEMPERATURE_PRESETS.map(preset => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTemperatureChange([preset.value])}
                  className={`h-6 px-2 text-[10px] ${
                    temperature === preset.value
                      ? 'border-brand text-brand-soft-foreground'
                      : 'text-muted-foreground'
                  }`}
                  data-testid={`temp-preset-${preset.label.toLowerCase()}-${feature}`}
                  aria-label={`Set temperature to ${preset.value} (${preset.label})`}
                >
                  {preset.label} ({preset.value})
                </Button>
              ))}
            </div>
          </div>

          {/* AC2: Max tokens input (100–32000) */}
          <div data-testid={`override-max-tokens-${feature}`}>
            <Label
              htmlFor={`override-tokens-${feature}`}
              className="text-xs font-medium"
            >
              Max Tokens
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id={`override-tokens-${feature}`}
                type="number"
                min={100}
                max={32000}
                step={100}
                value={maxTokens ?? ''}
                onChange={handleMaxTokensChange}
                placeholder="Default"
                className="h-8 text-sm w-32"
                aria-label={`Max tokens for ${feature}`}
                data-testid={`override-tokens-input-${feature}`}
              />
              <span className="text-[10px] text-muted-foreground">
                {maxTokens !== undefined ? `${maxTokens.toLocaleString()} tokens` : (
                  <span className="italic">Using model default</span>
                )}
              </span>
            </div>
          </div>

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
