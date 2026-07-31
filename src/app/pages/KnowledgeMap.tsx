/**
 * KnowledgeMap Page (E56-S04)
 *
 * Full-screen knowledge map with topic-level treemap, category filtering,
 * topic detail popovers, and focus areas panel. Mobile fallback uses a
 * sorted card list grouped by category.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useKnowledgeMapStore } from '@/stores/useKnowledgeMapStore'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import { TopicTreemap } from '@/app/components/knowledge/TopicTreemap'
import type { TreemapDataItem } from '@/app/components/knowledge/TopicTreemap'
import { SuggestedActionsPanel } from '@/app/components/knowledge/SuggestedActionsPanel'
import { TopicDetailPanel } from '@/app/components/knowledge/TopicDetailPanel'
import { KnowledgeMapSummary } from '@/app/components/knowledge/KnowledgeMapSummary'
import { PriorityTopicsCard } from '@/app/components/knowledge/PriorityTopicsCard'
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/app/components/ui/sheet'

const ALL_CATEGORIES = 'All Categories'

export function KnowledgeMap() {
  const topics = useKnowledgeMapStore(state => state.topics)
  const categories = useKnowledgeMapStore(state => state.categories)
  const focusAreas = useKnowledgeMapStore(state => state.focusAreas)
  const suggestions = useKnowledgeMapStore(state => state.suggestions)
  const isLoading = useKnowledgeMapStore(state => state.isLoading)
  const error = useKnowledgeMapStore(state => state.error)
  const computeScores = useKnowledgeMapStore(state => state.computeScores)
  const invalidateCache = useKnowledgeMapStore(state => state.invalidateCache)
  const sourceCourseCount = useKnowledgeMapStore(state => state.sourceCourseCount)
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    void computeScores()
  }, [computeScores])

  const filteredTopics = useMemo(
    () =>
      selectedCategory === ALL_CATEGORIES
        ? topics
        : topics.filter(topic => topic.category === selectedCategory),
    [selectedCategory, topics]
  )

  // A flat topic map is more robust and preserves usable tile area. Category
  // context remains available in each tile's label and through the filter.
  const treemapData: TreemapDataItem[] = useMemo(
    () =>
      filteredTopics.map(topic => ({
        name: topic.name,
        canonicalName: topic.canonicalName,
        category: topic.category,
        size: Math.max(topic.courseIds.length, 1),
        score: topic.scoreResult.score,
        tier: topic.scoreResult.tier,
        aggregateRetention: topic.aggregateRetention,
        predictedDecayDate: topic.predictedDecayDate,
      })),
    [filteredTopics]
  )

  const selectedTopic = selectedTopicId
    ? (topics.find(topic => topic.canonicalName === selectedTopicId) ?? null)
    : null

  const categoryFilters = useMemo(
    () => [
      { name: ALL_CATEGORIES, count: topics.length },
      ...categories.map(category => ({
        name: category.category,
        count: category.topics.length,
      })),
    ],
    [categories, topics.length]
  )

  const handleCellClick = useCallback((canonicalName: string) => {
    setSelectedTopicId(previous => (previous === canonicalName ? null : canonicalName))
  }, [])

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category)
    setSelectedTopicId(null)
  }, [])

  const handleRetry = useCallback(() => {
    invalidateCache()
    void computeScores()
  }, [computeScores, invalidateCache])

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
        <EmptyState
          icon={Brain}
          title="Unable to load Knowledge Map"
          description={error}
          actionLabel="Try again"
          onAction={handleRetry}
        />
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="p-1">
        <EmptyState
          icon={Brain}
          title={sourceCourseCount > 0 ? 'Add topics to your courses' : 'No knowledge data yet'}
          description={
            sourceCourseCount > 0
              ? 'Add course tags or complete quizzes with topic labels to unlock a more useful map.'
              : 'Import a course, then complete lessons, quizzes, or flashcard reviews to build your knowledge map.'
          }
          actionLabel={sourceCourseCount > 0 ? 'Browse courses' : 'Import a course'}
          actionHref="/courses"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-1">
      {/* Page header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Map</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            See what is holding, what is fading, and where a short review will have the most impact.
          </p>
        </div>
        <KnowledgeMapSummary topics={topics} />
      </div>

      {/* Category filter chips */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by category"
      >
        <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          View
        </span>
        {categoryFilters.map(category => (
          <button
            key={category.name}
            type="button"
            onClick={() => handleCategoryChange(category.name)}
            className={`min-h-[44px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
              selectedCategory === category.name
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            aria-pressed={selectedCategory === category.name}
          >
            {category.name}
            <span className="ml-1.5 opacity-70">{category.count}</span>
          </button>
        ))}
      </div>

      {/* Suggested Actions — mobile: inline above topic list (desktop version in sidebar below) */}
      {isMobile && <SuggestedActionsPanel suggestions={suggestions} />}

      {/* Main content: treemap + sidebars */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Treemap / Mobile list */}
        <div className="min-w-0">
          {isMobile ? (
            <MobileTopicList
              topics={filteredTopics}
              onSelect={handleCellClick}
              selectedTopicId={selectedTopicId}
              categories={categories
                .filter(c => selectedCategory === ALL_CATEGORIES || c.category === selectedCategory)
                .map(c => c.category)}
            />
          ) : (
            <Card className="gap-0 overflow-hidden">
              <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Topic landscape</h2>
                  <p className="text-xs text-muted-foreground">
                    Tile size shows topic reach across courses; color shows current strength.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a topic for its score breakdown
                </p>
              </div>
              <div className="relative p-4">
                <TopicTreemap data={treemapData} onCellClick={handleCellClick} />
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar column — desktop only; Focus Areas rendered once for all viewports */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          {/* Suggested Actions — desktop sidebar only (mobile version rendered above) */}
          {!isMobile && <SuggestedActionsPanel suggestions={suggestions} maxVisible={3} />}

          <PriorityTopicsCard
            topics={focusAreas}
            selectedTopicId={selectedTopicId}
            onSelect={handleCellClick}
          />
        </aside>
      </div>

      {selectedTopic && (
        <Sheet
          open={Boolean(selectedTopic)}
          onOpenChange={open => {
            if (!open) setSelectedTopicId(null)
          }}
        >
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            showCloseButton={false}
            className={
              isMobile
                ? 'h-[min(42rem,85dvh)] w-full max-w-none rounded-t-2xl p-0'
                : 'w-full p-0 sm:max-w-md'
            }
          >
            <SheetTitle className="sr-only">{selectedTopic.name} topic details</SheetTitle>
            <SheetDescription className="sr-only">
              Knowledge score breakdown and recommended actions for {selectedTopic.name}.
            </SheetDescription>
            <TopicDetailPanel
              topic={selectedTopic}
              embedded
              onClose={() => setSelectedTopicId(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

/**
 * Mobile fallback: sorted topic list with accordion groups by category.
 */
function MobileTopicList({
  topics,
  categories,
  onSelect,
  selectedTopicId,
}: {
  topics: ScoredTopic[]
  categories: string[]
  onSelect: (canonicalName: string) => void
  selectedTopicId: string | null
}) {
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
                <MobileTopicCard
                  key={topic.canonicalName}
                  topic={topic}
                  onSelect={onSelect}
                  selected={selectedTopicId === topic.canonicalName}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function MobileTopicCard({
  topic,
  onSelect,
  selected,
}: {
  topic: ScoredTopic
  onSelect: (canonicalName: string) => void
  selected: boolean
}) {
  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-accent/50"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={selected}
      aria-label={`Topic: ${topic.name}, knowledge score: ${topic.scoreResult.score} percent, status: ${tierLabel(topic.scoreResult.tier)}`}
      onClick={() => onSelect(topic.canonicalName)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(topic.canonicalName)
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
  )
}
