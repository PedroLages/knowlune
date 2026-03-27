/**
 * Data Retention Settings (E32-S04)
 *
 * Allows users to configure TTL for studySessions and aiUsageEvents,
 * and toggle orphaned embeddings cleanup. Displayed in Settings > Data Management.
 */

import { useState, useCallback } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Button } from '@/app/components/ui/button'
import {
  getRetentionSettings,
  saveRetentionSettings,
  runDataPruning,
  TTL_OPTIONS,
  type RetentionDays,
} from '@/lib/dataPruning'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

export function DataRetentionSettings() {
  const [settings, setSettings] = useState(() => getRetentionSettings())
  const [isPruning, setIsPruning] = useState(false)

  const handleTTLChange = useCallback(
    (field: 'studySessionsTTL' | 'aiUsageEventsTTL', value: string) => {
      const days = Number(value) as RetentionDays
      const updated = saveRetentionSettings({ [field]: days })
      setSettings(updated)
    },
    []
  )

  const handleToggleOrphanedEmbeddings = useCallback((checked: boolean) => {
    const updated = saveRetentionSettings({ pruneOrphanedEmbeddings: checked })
    setSettings(updated)
  }, [])

  const handlePruneNow = useCallback(async () => {
    setIsPruning(true)
    try {
      const result = await runDataPruning()
      const total =
        result.studySessionsPruned + result.aiUsageEventsPruned + result.embeddingsPruned
      if (total > 0) {
        toastSuccess.generic(
          `Pruned ${total} records (${result.studySessionsPruned} sessions, ${result.aiUsageEventsPruned} AI events, ${result.embeddingsPruned} embeddings)`
        )
      } else {
        toastSuccess.generic('No old data to prune')
      }
    } catch (error) {
      console.error('[DataRetention] Manual prune failed:', error)
      toastError.generic('Failed to prune data. Please try again.')
    } finally {
      setIsPruning(false)
    }
  }, [])

  return (
    <div className="space-y-4" data-testid="data-retention-settings">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">Data Retention</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure how long to keep historical data. Old records are automatically pruned on app
        startup. Pruning frees storage space without affecting your current courses or progress.
      </p>

      <div className="space-y-4">
        {/* Study Sessions TTL */}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="study-sessions-ttl" className="text-sm">
            Study sessions
          </Label>
          <Select
            value={String(settings.studySessionsTTL)}
            onValueChange={v => handleTTLChange('studySessionsTTL', v)}
          >
            <SelectTrigger id="study-sessions-ttl" className="w-[140px] min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* AI Usage Events TTL */}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ai-usage-ttl" className="text-sm">
            AI usage events
          </Label>
          <Select
            value={String(settings.aiUsageEventsTTL)}
            onValueChange={v => handleTTLChange('aiUsageEventsTTL', v)}
          >
            <SelectTrigger id="ai-usage-ttl" className="w-[140px] min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orphaned Embeddings Toggle */}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="prune-orphaned-embeddings" className="text-sm">
            Clean up orphaned embeddings
          </Label>
          <Switch
            id="prune-orphaned-embeddings"
            checked={settings.pruneOrphanedEmbeddings}
            onCheckedChange={handleToggleOrphanedEmbeddings}
          />
        </div>

        {/* Manual Prune Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePruneNow}
          disabled={isPruning}
          className="gap-2 min-h-[44px] w-full"
          aria-label="Run data pruning now"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {isPruning ? 'Pruning...' : 'Prune Now'}
        </Button>
      </div>
    </div>
  )
}
