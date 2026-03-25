/**
 * Ollama Model Picker Component
 *
 * A searchable dropdown (combobox) that discovers and displays available Ollama models.
 * Fetches models from the Ollama /api/tags endpoint when the server URL is configured.
 *
 * Features:
 * - Auto-fetches models when serverUrl changes (AC5)
 * - Searchable with model name filtering (AC2)
 * - Shows model name and size (AC2)
 * - Persists selection in AI configuration (AC3)
 * - Error states with troubleshooting hints (AC4)
 * - Keyboard accessible (WCAG AA)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, ChevronsUpDown, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
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
import { Label } from '@/app/components/ui/label'
import { cn } from '@/app/components/ui/utils'
import { OllamaLLMClient } from '@/ai/llm/ollama-client'
import type { OllamaModel } from '@/lib/aiConfiguration'

interface OllamaModelPickerProps {
  /** Ollama server URL to fetch models from */
  serverUrl: string
  /** Whether to connect directly to Ollama (vs. through proxy) */
  directConnection: boolean
  /** Currently selected model name */
  selectedModel: string | undefined
  /** Called when user selects a model */
  onModelSelect: (modelName: string) => void
  /** Whether the Ollama server connection is established */
  isConnected: boolean
}

export function OllamaModelPicker({
  serverUrl,
  directConnection,
  selectedModel,
  onModelSelect,
  isConnected,
}: OllamaModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Track the URL that was used for the last successful fetch to detect changes (AC5)
  const lastFetchedUrl = useRef<string>('')

  const fetchModels = useCallback(async () => {
    if (!serverUrl || !isConnected) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await OllamaLLMClient.fetchModels(serverUrl, directConnection)
      setModels(result)
      lastFetchedUrl.current = serverUrl

      // If no model selected and models are available, auto-select the first
      if (!selectedModel && result.length > 0) {
        onModelSelect(result[0].name)
      }
    } catch (err) {
      // silent-catch-ok — error state rendered inline via the error alert below the picker
      const message = err instanceof Error ? err.message : 'Failed to fetch models'
      setError(message)
      setModels([])
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, directConnection, isConnected, selectedModel, onModelSelect])

  // Fetch models when serverUrl changes or connection is established (AC1, AC5)
  useEffect(() => {
    if (isConnected && serverUrl && serverUrl !== lastFetchedUrl.current) {
      void fetchModels()
    }
  }, [fetchModels])

  // Don't render if not connected
  if (!isConnected) return null

  const selectedModelData = models.find(m => m.name === selectedModel)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="ollama-model-picker">Model</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void fetchModels()}
          disabled={isLoading}
          className="h-7 px-2 text-xs text-muted-foreground"
          data-testid="refresh-models-button"
          aria-label="Refresh model list"
        >
          <RefreshCw
            className={cn('size-3 mr-1', isLoading && 'animate-spin')}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="ollama-model-picker"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select Ollama model"
            className="w-full justify-between min-h-[44px]"
            data-testid="ollama-model-picker"
            disabled={isLoading && models.length === 0}
          >
            {isLoading && models.length === 0 ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading models...
              </span>
            ) : selectedModelData ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedModelData.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {selectedModelData.size}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a model...</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search models..." data-testid="model-search-input" />
            <CommandList>
              <CommandEmpty>
                {error ? (
                  <span className="text-destructive">Failed to load models</span>
                ) : (
                  'No models found. Pull a model with: ollama pull llama3.2'
                )}
              </CommandEmpty>
              <CommandGroup>
                {models.map(model => (
                  <CommandItem
                    key={model.name}
                    value={model.name}
                    onSelect={value => {
                      onModelSelect(value)
                      setOpen(false)
                    }}
                    data-testid={`model-option-${model.name}`}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        selectedModel === model.name ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{model.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{model.size}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Error state with troubleshooting hint (AC4) */}
      {error && (
        <div
          className="flex items-start gap-2 text-sm text-destructive"
          role="alert"
          data-testid="model-fetch-error"
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure Ollama is running and accessible at the configured URL. You can check with:{' '}
              <code className="bg-muted px-1 rounded text-xs">curl {serverUrl}/api/tags</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
