/**
 * KnowledgeMap Page (E56-S04)
 *
 * Full-screen knowledge map with topic-level treemap, category filtering,
 * topic detail popovers, and focus areas panel. Mobile fallback uses a
 * sorted card list grouped by category.
 */

import { useEffect, useState, useCallback } from 'react'
import { useKnowledgeMapStore } from '@/stores/useKnowledgeMapStore'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import { TopicTreemap } from '@/app/components/knowledge/TopicTreemap'
import type { TreemapDataItem, TreemapCategoryData } from '@/app/components/knowledge/TopicTreemap'
import { FocusAreasPanel } from '@/app/components/knowledge/FocusAreasPanel'
import { SuggestedActionsPanel } from '@/app/components/knowledge/SuggestedActionsPanel'
import { TopicDetailPopover } from '@/app/components/knowledge/TopicDetailPopover'
import { TopicDetailPanel } from '@/app/components/knowledge/TopicDetailPanel'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import { tierBadgeClass, tierLabel } from '@/lib/knowledgeTierUtils'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { EmptyState } from '@/app/components/EmptyState'
import { Brain } from 'lucide-react'

const ALL_CATEGORIES = 'All Categories'

export function KnowledgeMap() {
  const { topics, categories, focusAreas, suggestions, isLoading, error, computeScores } =
    useKnowledgeMapStore()
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [selectedTopicName, setSelectedTopicName] = useState<string | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    void computeScores()
  }, [computeScores])

  const filteredTopics =
    selectedCategory === ALL_CATEGORIES
      ? topics
      : topics.filter(t => t.category === selectedCategory)

  // Build nested treemap data grouped by category (desktop) or flat (mobile data source)
  const nestedTreemapData: TreemapCategoryData[] = (
    selectedCategory === ALL_CATEGORIES
      ? categories
      : categories.filter(c => c.category === selectedCategory)
  )
    .map(cat => {
      const catTopics = filteredTopics.filter(t => t.category === cat.category)
      if (catTopics.length === 0) return null
      return {
        name: cat.category,
        children: catTopics.map(t => ({
          name: t.name,
          size: Math.max(t.courseIds.length, 1),
          score: t.scoreResult.score,
          tier: t.scoreResult.tier,
          aggregateRetention: t.aggregateRetention,
          predictedDecayDate: t.predictedDecayDate,
        })),
      }
    })
    .filter((item): item is TreemapCategoryData => item !== null)

  // Also build flat data for fallback (single-category view with no children nesting needed)
  const flatTreemapData: TreemapDataItem[] = filteredTopics.map(t => ({
    name: t.name,
    size: Math.max(t.courseIds.length, 1),
    score: t.scoreResult.score,
    tier: t.scoreResult.tier,
    aggregateRetention: t.aggregateRetention,
    predictedDecayDate: t.predictedDecayDate,
  }))

  // Use nested data when showing all categories, flat when filtered to one category
  const treemapData = selectedCategory === ALL_CATEGORIES ? nestedTreemapData : flatTreemapData

  const selectedTopic = selectedTopicName
    ? (topics.find(t => t.name === selectedTopicName) ?? null)
    : null

  const categoryNames = [ALL_CATEGORIES, ...categories.map(c => c.category)]

  const handleCellClick = useCallback((name: string) => {
    setSelectedTopicName(prev => (prev === name ? null : name))
  }, [])

  if (isLoading) {
    return (
      <div
        className="space-y-6 p-1"
        role="status"
        aria-busy="true"
        aria-label="Loading knowledge map"
      >
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-1">
        <EmptyState icon={Brain} title="Unable to load Knowledge Map" description={error} />
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="p-1">
        <EmptyState
          icon={Brain}
          title="No knowledge data yet"
          description="Complete some course lessons, quizzes, or flashcard reviews to build your knowledge map."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-1">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Map</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore your topic knowledge across all courses
        </p>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {categoryNames.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
              selectedCategory === cat
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            aria-pressed={selectedCategory === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Suggested Actions — mobile: inline above topic list (desktop version in sidebar below) */}
      {isMobile && <SuggestedActionsPanel suggestions={suggestions} />}

      {/* Main content: treemap + sidebars */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Treemap / Mobile list */}
        <div className="flex-1 min-w-0">
          {isMobile ? (
            <MobileTopicList
              topics={filteredTopics}
              categories={categories
                .filter(c => selectedCategory === ALL_CATEGORIES || c.category === selectedCategory)
                .map(c => c.category)}
            />
          ) : (
            <Card className="p-4 overflow-hidden">
              <div className="relative">
                <TopicTreemap data={treemapData} onCellClick={handleCellClick} />
                {selectedTopic && (
                  <TopicDetailPanel
                    topic={selectedTopic}
                    onClose={() => setSelectedTopicName(null)}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar column — desktop only; Focus Areas rendered once for all viewports */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {/* Suggested Actions — desktop sidebar only (mobile version rendered above) */}
          {!isMobile && <SuggestedActionsPanel suggestions={suggestions} />}

          {/* Focus Areas — single instance, shown on all viewports */}
          <Card className="p-4">
            <h2 className="text-base font-semibold mb-1">Focus Areas</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Topics that need your attention most
            </p>
            <FocusAreasPanel focusAreas={focusAreas} />
          </Card>
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile fallback: sorted topic list with accordion groups by category.
 */
function MobileTopicList({ topics, categories }: { topics: ScoredTopic[]; categories: string[] }) {
  // Group topics by category, sorted worst-first within each category
  const grouped = categories
    .map(cat => ({
      category: cat,
      topics: topics
        .filter(t => t.category === cat)
        .sort((a, b) => a.scoreResult.score - b.scoreResult.score),
    }))
    .filter(g => g.topics.length > 0)

  if (grouped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">No topics in this category.</p>
    )
  }

  return (
    <Accordion type="multiple" defaultValue={grouped.map(g => g.category)}>
      {grouped.map(group => (
        <AccordionItem key={group.category} value={group.category}>
          <AccordionTrigger className="text-sm font-semibold">
            {group.category}{' '}
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {group.topics.length} topics
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {group.topics.map(topic => (
                <MobileTopicCard key={topic.canonicalName} topic={topic} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function MobileTopicCard({ topic }: { topic: ScoredTopic }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TopicDetailPopover topic={topic} open={expanded} onOpenChange={setExpanded}>
      <Card
        className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        role="button"
        tabIndex={0}
        aria-label={`Topic: ${topic.name}, knowledge score: ${topic.scoreResult.score} percent, status: ${tierLabel(topic.scoreResult.tier)}`}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(true)
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{topic.name}</span>
          <Badge className={tierBadgeClass(topic.scoreResult.tier)}>
            {topic.scoreResult.score}% {tierLabel(topic.scoreResult.tier)}
          </Badge>
        </div>
        <Progress
          value={topic.scoreResult.score}
          className="mt-2 h-1.5"
          aria-label={`${topic.name} score: ${topic.scoreResult.score}%`}
        />
      </Card>
    </TopicDetailPopover>
  )
}
