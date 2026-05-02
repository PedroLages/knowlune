/**
 * ReadingSection — grid container for the Reports page reading tab.
 *
 * Wraps 5 reading cards in a responsive layout: stats section (full width),
 * followed by two 2-column grid rows for the remaining cards.
 *
 * Delegates data loading and state to each child card; this component
 * is purely presentational.
 *
 * @module ReadingSection
 */
import { ReadingStatsSection } from '@/app/components/reports/ReadingStatsSection'
import { ReadingPatternsCard } from '@/app/components/reports/ReadingPatternsCard'
import { ReadingGoalsCard } from '@/app/components/reports/ReadingGoalsCard'
import { GenreDistributionCard } from '@/app/components/reports/GenreDistributionCard'
import { ReadingSummaryCard } from '@/app/components/reports/ReadingSummaryCard'

export function ReadingSection() {
  return (
    <div data-testid="reading-section" className="space-y-4">
      <ReadingStatsSection showHeader={false} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReadingPatternsCard />
        <GenreDistributionCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReadingGoalsCard />
        <ReadingSummaryCard />
      </div>
    </div>
  )
}
