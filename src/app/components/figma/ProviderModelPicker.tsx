/**
 * Provider Model Picker Component
 *
 * Generic searchable dropdown (combobox) for selecting AI models from any provider.
 * Uses `discoverModels()` to fetch available models, groups by family when list
 * exceeds 10, and supports a custom model ID escape hatch.
 *
 * @see E90-S05 — Build Global Model Picker UI in Settings
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, ChevronsUpDown, Loader2, AlertTriangle, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { discoverModels, type DiscoveredModel } from '@/lib/modelDiscovery'
import { PROVIDER_DEFAULTS, type AIProviderId } from '@/lib/modelDefaults'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderModelPickerProps {
  /** AI provider to discover models for (AC1) */
  provider: AIProviderId
  /** API key for authentication (AC1) */
  apiKey: string
  /** Currently selected model ID (AC1) */
  selectedModel?: string
  /** Called when user selects a model (AC1) */
  onModelSelect: (modelId: string) => void
  /** Optional custom render for model items (e.g., Ollama shows size) */
  renderModelItem?: (model: DiscoveredModel, isSelected: boolean) => React.ReactNode
  /** Optional additional controls (e.g., Ollama refresh button) */
  headerActions?: React.ReactNode
  /** Label text override */
  label?: string
  /** Whether to show the custom model ID input (AC6). Default: true */
  showCustomInput?: boolean
  /** Test ID prefix for data-testid attributes */
  testIdPrefix?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group models by family when list exceeds threshold (AC3) */
function groupByFamily(models: DiscoveredModel[]): Map<string, DiscoveredModel[]> {
  const groups = new Map<string, DiscoveredModel[]>()
  for (const model of models) {
    const family = model.family || 'Other'
    const existing = groups.get(family)
    if (existing) {
      existing.push(model)
    } else {
      groups.set(family, [model])
    }
  }
  return groups
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderModelPicker({
  provider,
  apiKey,
  selectedModel,
  onModelSelect,
  renderModelItem,
  headerActions,
  label = 'Model',
  showCustomInput = true,
  testIdPrefix = 'provider-model-picker',
}: ProviderModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<DiscoveredModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customModelId, setCustomModelId] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  // Track last fetched provider+key to avoid re-fetching
  const lastFetchRef = useRef<string>('')

  const defaultModel = PROVIDER_DEFAULTS[provider]
  const shouldGroup = models.length > 10

  // Track whether we have models to avoid re-fetching (ref avoids dependency churn)
  const hasModelsRef = useRef(false)

  const fetchModels = useCallback(async () => {
    if (!apiKey && provider !== 'ollama') return

    const fetchKey = `${provider}:${apiKey}`
    // Skip if already fetched for this provider+key combo
    if (fetchKey === lastFetchRef.current && hasModelsRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await discoverModels(provider, apiKey)
      setModels(result)
      hasModelsRef.current = result.length > 0
      lastFetchRef.current = fetchKey
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover models'
      setError(message)
      setModels([])
      hasModelsRef.current = false
      toast.error(`Model discovery failed: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }, [provider, apiKey])

  // Fetch models when provider or apiKey changes
  useEffect(() => {
    const fetchKey = `${provider}:${apiKey}`
    if (fetchKey !== lastFetchRef.current) {
      void fetchModels()
    }
  }, [fetchModels, provider, apiKey])

  // Detect if current selection is a custom model (not in list)
  useEffect(() => {
    if (selectedModel && models.length > 0) {
      const inList = models.some(m => m.id === selectedModel)
      if (!inList) {
        setUseCustom(true)
        setCustomModelId(selectedModel)
      }
    }
  }, [selectedModel, models])

  const selectedModelData = models.find(m => m.id === selectedModel)

  // Handle custom model submission
  function handleCustomModelSubmit() {
    const trimmed = customModelId.trim()
    if (trimmed) {
      onModelSelect(trimmed)
      setUseCustom(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderDefaultModelItem(model: DiscoveredModel, isSelected: boolean) {
    const isRecommended = model.id === defaultModel
    return (
      <>
        <Check
          className={cn('mr-2 size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
          aria-hidden="true"
        />
        <span className="flex-1 truncate">{model.name}</span>
        {isRecommended && (
          <Badge
            variant="secondary"
            className="ml-2 shrink-0 text-[10px] px-1.5 py-0 bg-brand-soft text-brand-soft-foreground"
            data-testid={`${testIdPrefix}-recommended-badge`}
          >
            <Star className="size-2.5 mr-0.5" aria-hidden="true" />
            Recommended
          </Badge>
        )}
        {model.costTier && (
          <span className="text-xs text-muted-foreground shrink-0 ml-1">{model.costTier}</span>
        )}
      </>
    )
  }

  function renderModelOption(model: DiscoveredModel) {
    const isSelected = selectedModel === model.id
    return (
      <CommandItem
        key={model.id}
        value={`${model.name} ${model.id}`}
        onSelect={() => {
          onModelSelect(model.id)
          setUseCustom(false)
          setCustomModelId('')
          setOpen(false)
        }}
        data-testid={`${testIdPrefix}-option-${model.id}`}
      >
        {renderModelItem
          ? renderModelItem(model, isSelected)
          : renderDefaultModelItem(model, isSelected)}
      </CommandItem>
    )
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton (AC5)
  // ---------------------------------------------------------------------------

  if (isLoading && models.length === 0) {
    return (
      <div className="space-y-2" data-testid={`${testIdPrefix}-loading`}>
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {headerActions}
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
        {showCustomInput && <Skeleton className="h-9 w-full rounded-md" />}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header with label and optional actions */}
      <div className="flex items-center justify-between">
        <Label htmlFor={`${testIdPrefix}-trigger`}>{label}</Label>
        {headerActions}
      </div>

      {/* Searchable combobox (AC2) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`${testIdPrefix}-trigger`}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Select ${label.toLowerCase()}`}
            className="w-full justify-between min-h-[44px]"
            data-testid={`${testIdPrefix}-trigger`}
            disabled={isLoading && models.length === 0}
          >
            {useCustom && customModelId ? (
              <span className="flex items-center gap-2 truncate text-muted-foreground">
                <span className="truncate">{customModelId}</span>
                <span className="text-xs">(custom)</span>
              </span>
            ) : selectedModelData ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedModelData.name}</span>
                {selectedModelData.id === defaultModel && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-brand-soft text-brand-soft-foreground"
                  >
                    Recommended
                  </Badge>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select a model...</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] border border-border bg-popover p-0 shadow-md"
          align="start"
        >
          <Command className="rounded-lg border-0">
            <CommandInput
              placeholder="Search models..."
              data-testid={`${testIdPrefix}-search`}
              className="border-b border-border"
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Discovering models...
                  </span>
                ) : error ? (
                  <div className="text-sm px-2 py-1">
                    <p className="text-destructive font-medium">Failed to load models</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                  </div>
                ) : (
                  'No models found for this provider.'
                )}
              </CommandEmpty>

              {/* Grouped display when >10 models (AC3) */}
              {shouldGroup ? (
                Array.from(groupByFamily(models)).map(([family, familyModels]) => (
                  <CommandGroup key={family} heading={family}>
                    {familyModels.map(renderModelOption)}
                  </CommandGroup>
                ))
              ) : (
                <CommandGroup>{models.map(renderModelOption)}</CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Error state (AC5) */}
      {error && (
        <div
          className="flex items-start gap-2 text-sm text-destructive"
          role="alert"
          data-testid={`${testIdPrefix}-error`}
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {/* Custom model ID escape hatch (AC6) */}
      {showCustomInput && (
        <div className="space-y-1">
          <Label htmlFor={`${testIdPrefix}-custom-input`} className="text-xs text-muted-foreground">
            Custom model ID
          </Label>
          <div className="flex gap-2">
            <Input
              id={`${testIdPrefix}-custom-input`}
              type="text"
              value={customModelId}
              onChange={e => setCustomModelId(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomModelSubmit()
                }
              }}
              placeholder="e.g., gpt-4o-2024-08-06"
              className="flex-1 h-9 text-sm"
              data-testid={`${testIdPrefix}-custom-input`}
              aria-describedby={`${testIdPrefix}-custom-hint`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCustomModelSubmit}
              disabled={!customModelId.trim()}
              className="h-9 px-3 text-xs"
              data-testid={`${testIdPrefix}-custom-apply`}
            >
              Apply
            </Button>
          </div>
          <p id={`${testIdPrefix}-custom-hint`} className="text-xs text-muted-foreground">
            Use this if your model is not listed above.
          </p>
        </div>
      )}
    </div>
  )
}
