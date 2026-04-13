/**
 * KnowledgeMapWidget (E56-S03)
 *
 * Dashboard widget showing category-level knowledge treemap and focus areas.
 * Mobile fallback: sorted topic list with progress bars grouped by category.
 */

import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Map } from 'lucide-react'
import { useKnowledgeMapStore } from '@/stores/useKnowledgeMapStore'
import { TopicTreemap, type TreemapDataItem } from './TopicTreemap'
import { FocusAreasPanel } from './FocusAreasPanel'
import { Progress } from '@/app/components/ui/progress'
import { Badge } from '@/app/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import type { KnowledgeTier } from '@/lib/knowledgeScore'

function tierBadgeClass(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'bg-success/15 text-success border-success/30'
    case 'fading':
      return 'bg-warning/15 text-warning border-warning/30'
    case 'weak':
      return 'bg-destructive/15 text-destructive border-destructive/30'
  }
}

function tierLabel(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'Strong'
    case 'fading':
      return 'Fading'
    case 'weak':
      return 'Weak'
  }
}

export function KnowledgeMapWidget() {
  const categories = useKnowledgeMapStore(s => s.categories)
  const focusAreas = useKnowledgeMapStore(s => s.focusAreas)
  const topics = useKnowledgeMapStore(s => s.topics)
  const isLoading = useKnowledgeMapStore(s => s.isLoading)
  const computeScores = useKnowledgeMapStore(s => s.computeScores)

  useEffect(() => {
    let ignore = false

    computeScores().catch(err => {
      // silent-catch-ok — store sets its own error state
      if (!ignore) {
        console.warn('[KnowledgeMapWidget] Failed to compute scores:', err)
      }
    })

    return () => {
      ignore = true
    }
  }, [computeScores])

  // Empty state
  if (!isLoading && topics.length === 0) {
    return (
      <div className="text-center py-10" data-testid="knowledge-map-empty">
        <Map className="size-10 mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">Import courses to build your Knowledge Map</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center" aria-busy="true">
        <p className="text-sm text-muted-foreground">Computing knowledge scores...</p>
      </div>
    )
  }

  // Build treemap data from categories
  const treemapData: TreemapDataItem[] = categories.map(cat => ({
    name: cat.category,
    size: Math.max(cat.topics.length, 1),
    score: cat.averageScore,
    tier: cat.averageScore >= 70 ? 'strong' : cat.averageScore >= 40 ? 'fading' : ('weak' as const),
  }))

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold">Knowledge Map</h2>
        <Link
          to="/knowledge-map"
          className="text-sm text-brand hover:text-brand-hover flex items-center gap-1 motion-safe:transition-colors"
          data-testid="see-full-map-link"
        >
          See full map
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Desktop/tablet: Treemap */}
      <div className="hidden sm:block">
        <TopicTreemap data={treemapData} />
      </div>

      {/* Mobile: Accordion-grouped sorted list */}
      <div className="block sm:hidden">
        <Accordion type="multiple" defaultValue={categories.map(c => c.category)}>
          {categories.map(cat => (
            <AccordionItem key={cat.category} value={cat.category}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {cat.category}
                  <Badge
                    className={tierBadgeClass(
                      cat.averageScore >= 70 ? 'strong' : cat.averageScore >= 40 ? 'fading' : 'weak'
                    )}
                  >
                    {cat.averageScore}%
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2.5">
                  {cat.topics.map(topic => (
                    <div key={topic.canonicalName} className="flex items-center gap-3">
                      <span className="text-xs w-24 truncate shrink-0">{topic.name}</span>
                      <Progress
                        value={topic.scoreResult.score}
                        className="flex-1 h-2"
                        aria-label={`${topic.name} knowledge score: ${topic.scoreResult.score}%`}
                      />
                      <Badge className={`${tierBadgeClass(topic.scoreResult.tier)} text-[10px]`}>
                        {tierLabel(topic.scoreResult.tier)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Focus Areas */}
      <FocusAreasPanel focusAreas={focusAreas} />
    </div>
  )
}
