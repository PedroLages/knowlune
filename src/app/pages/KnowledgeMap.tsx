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
import type { TreemapDataItem } from '@/app/components/knowledge/TopicTreemap'
import { FocusAreasPanel } from '@/app/components/knowledge/FocusAreasPanel'
import { SuggestedActionsPanel } from '@/app/components/knowledge/SuggestedActionsPanel'
import { TopicDetailPopover } from '@/app/components/knowledge/TopicDetailPopover'
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
  const { topics, categories, focusAreas, suggestions, isLoading, error, computeScores } = useKnowledgeMapStore()
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [popoverTopic, setPopoverTopic] = useState<string | null>(null)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    void computeScores()
  }, [computeScores])

  const filteredTopics =
    selectedCategory === ALL_CATEGORIES
      ? topics
      : topics.filter(t => t.category === selectedCategory)

  const treemapData: TreemapDataItem[] = filteredTopics.map(t => ({
    name: t.name,
    size: Math.max(t.courseIds.length, 1),
    score: t.scoreResult.score,
    tier: t.scoreResult.tier,
  }))

  const categoryNames = [ALL_CATEGORIES, ...categories.map(c => c.category)]

  const handleCellClick = useCallback(
    (name: string, event?: React.MouseEvent) => {
      const topic = topics.find(t => t.name === name)
      if (topic) {
        if (event) {
          const rect = (event.currentTarget as HTMLElement)
            .closest('[data-treemap-container]')
            ?.getBoundingClientRect()
          if (rect) {
            setClickPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
          } else {
            setClickPos({ x: event.clientX, y: event.clientY })
          }
        }
        setPopoverTopic(prev => (prev === topic.canonicalName ? null : topic.canonicalName))
      }
    },
    [topics]
  )

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
      {isMobile && (
        <SuggestedActionsPanel suggestions={suggestions} />
      )}

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
            <Card className="p-4">
              {/* position:relative container so popover trigger is anchored to click position */}
              <div
                className="relative"
                data-treemap-container
                onClick={e => {
                  // Capture position for popover anchor
                  const rect = e.currentTarget.getBoundingClientRect()
                  setClickPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                }}
              >
                <TopicTreemap data={treemapData} onCellClick={handleCellClick} />
                {/* Popover trigger anchored at click position */}
                {popoverTopic && clickPos && (
                  <PopoverForTopic
                    canonicalName={popoverTopic}
                    anchorPos={clickPos}
                    onClose={() => setPopoverTopic(null)}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar column — desktop only; Focus Areas rendered once for all viewports */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {/* Suggested Actions — desktop sidebar only (mobile version rendered above) */}
          {!isMobile && (
            <SuggestedActionsPanel suggestions={suggestions} />
          )}

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
 * Standalone popover that renders for a given topic.
 * Used when treemap cell is clicked on desktop.
 */
function PopoverForTopic({
  canonicalName,
  anchorPos,
  onClose,
}: {
  canonicalName: string
  anchorPos: { x: number; y: number }
  onClose: () => void
}) {
  const topic = useKnowledgeMapStore(s => s.getTopicByName(canonicalName))
  if (!topic) return null

  return (
    <TopicDetailPopover topic={topic} open={true} onOpenChange={open => !open && onClose()}>
      {/* Trigger span positioned at click coordinates to anchor the popover correctly */}
      <span
        // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic anchor position
        style={{
          position: 'absolute',
          left: anchorPos.x,
          top: anchorPos.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
    </TopicDetailPopover>
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
