/**
 * Manual Chapter Mapping Editor
 *
 * Side-by-side view showing EPUB chapters mapped to audiobook chapters.
 * Pre-populated with auto-match results; users can manually override via dropdowns.
 *
 * @since E103-S01
 */

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import type { ChapterMapping } from '@/data/types'
import {
  computeChapterMapping,
  DEFAULT_CONFIDENCE_THRESHOLD,
  type EpubChapterInput,
  type AudioChapterInput,
} from '@/lib/chapterMatcher'

interface ChapterMappingEditorProps {
  epubChapters: EpubChapterInput[]
  audioChapters: AudioChapterInput[]
  initialMappings?: ChapterMapping[]
  threshold?: number
  onSave: (mappings: ChapterMapping[]) => void
  onCancel?: () => void
}

const NONE_VALUE = '__none__'

export function ChapterMappingEditor({
  epubChapters,
  audioChapters,
  initialMappings,
  threshold = DEFAULT_CONFIDENCE_THRESHOLD,
  onSave,
  onCancel,
}: ChapterMappingEditorProps) {
  // Build initial selection state from mappings
  const buildSelections = useCallback(
    (mappings: ChapterMapping[]): Map<string, { audioIndex: number; confidence: number }> => {
      const map = new Map<string, { audioIndex: number; confidence: number }>()
      for (const m of mappings) {
        map.set(m.epubChapterHref, { audioIndex: m.audioChapterIndex, confidence: m.confidence })
      }
      return map
    },
    []
  )

  const autoMappings = useMemo(
    () => initialMappings ?? computeChapterMapping(epubChapters, audioChapters, threshold),
    [initialMappings, epubChapters, audioChapters, threshold]
  )

  const [selections, setSelections] = useState(() => buildSelections(autoMappings))

  const handleSelect = useCallback((epubHref: string, value: string) => {
    setSelections(prev => {
      const next = new Map(prev)
      if (value === NONE_VALUE) {
        next.delete(epubHref)
      } else {
        next.set(epubHref, { audioIndex: parseInt(value, 10), confidence: 1.0 })
      }
      return next
    })
  }, [])

  const handleRerunAutoMatch = useCallback(() => {
    const fresh = computeChapterMapping(epubChapters, audioChapters, threshold)
    setSelections(buildSelections(fresh))
  }, [epubChapters, audioChapters, threshold, buildSelections])

  const handleSave = useCallback(() => {
    const mappings: ChapterMapping[] = []
    for (const [href, sel] of selections) {
      mappings.push({
        epubChapterHref: href,
        audioChapterIndex: sel.audioIndex,
        confidence: sel.confidence,
      })
    }
    onSave(mappings)
  }, [selections, onSave])

  const matchedCount = selections.size
  const totalEpub = epubChapters.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Chapter Mapping</h3>
          <p className="text-sm text-muted-foreground">
            {matchedCount} of {totalEpub} chapters matched
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRerunAutoMatch}>
            Re-run Auto-Match
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="brand" size="sm" onClick={handleSave}>
            Save Mapping
          </Button>
        </div>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>EPUB Chapter</span>
          <span className="w-16 text-center">Match</span>
          <span>Audio Chapter</span>
        </div>

        <div className="divide-y divide-border">
          {epubChapters.map((epub, idx) => {
            const sel = selections.get(epub.href)
            const isUnmatched = !sel
            const isLowConfidence = sel && sel.confidence < threshold && sel.confidence < 1.0

            return (
              <div
                key={epub.href}
                className={cn(
                  'grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-3 items-center',
                  isUnmatched && 'border-l-2 border-l-destructive bg-destructive/5',
                  isLowConfidence && 'border-l-2 border-l-warning bg-warning/5'
                )}
              >
                {/* EPUB chapter label */}
                <div className="min-w-0">
                  <span className="text-sm text-foreground truncate block">
                    <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                    {epub.label}
                  </span>
                </div>

                {/* Confidence badge */}
                <div className="w-16 text-center">
                  {sel ? (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        sel.confidence >= 0.9 && 'bg-brand-soft text-brand-soft-foreground',
                        sel.confidence >= threshold &&
                          sel.confidence < 0.9 &&
                          'bg-muted text-muted-foreground',
                        sel.confidence < threshold && 'bg-warning/20 text-warning'
                      )}
                    >
                      {Math.round(sel.confidence * 100)}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>

                {/* Audio chapter selector */}
                <div className="min-w-0">
                  <Select
                    value={sel ? String(sel.audioIndex) : NONE_VALUE}
                    onValueChange={v => handleSelect(epub.href, v)}
                  >
                    <SelectTrigger
                      className="w-full text-sm"
                      aria-label={`Audio chapter for "${epub.label}"`}
                    >
                      <SelectValue placeholder="Select audio chapter..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None (unmatched)</SelectItem>
                      {audioChapters.map((audio, ai) => (
                        <SelectItem key={ai} value={String(ai)}>
                          {ai + 1}. {audio.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
