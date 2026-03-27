// E19-S05: Premium Feature Page wrapper
// Wraps premium feature pages with a blurred preview + upgrade CTA for non-premium users.
// Premium users see the full feature content with no gating.
// Unauthenticated users are directed to sign in before checkout.

import { type ReactNode } from 'react'
import { Crown, Sparkles, type LucideIcon } from 'lucide-react'
import { PremiumGate, UpgradeCTA } from '@/app/components/PremiumGate'

interface PremiumFeaturePageProps {
  /** The full page content rendered for premium users */
  children: ReactNode
  /** Feature name shown in the upgrade CTA (e.g., "AI Q&A") */
  featureName: string
  /** Brief description of what the feature offers */
  featureDescription: string
  /** Icon displayed in the upgrade CTA header */
  icon?: LucideIcon
  /** Optional list of feature highlights shown as bullet points */
  highlights?: readonly string[]
  /** Optional static preview content shown behind the blur (e.g., a mockup) */
  preview?: ReactNode
}

/**
 * E19-S05 AC1: Page-level premium gating with blurred preview and upgrade CTA.
 * AC2: Each CTA includes feature name, description, preview, and upgrade button.
 * AC6: Premium users see full content (no CTA, no gating).
 * AC7: Reusable across all premium features (single component).
 */
export function PremiumFeaturePage({
  children,
  featureName,
  featureDescription,
  icon: Icon = Sparkles,
  highlights,
  preview,
}: PremiumFeaturePageProps) {
  return (
    <PremiumGate
      featureLabel={featureName}
      fallback={
        <FeaturePreview
          featureName={featureName}
          featureDescription={featureDescription}
          icon={Icon}
          highlights={highlights}
          preview={preview}
        />
      }
    >
      {children}
    </PremiumGate>
  )
}

// --- Feature preview descriptions for reuse ---

export const PREMIUM_FEATURES = {
  chatQA: {
    featureName: 'AI Q&A',
    featureDescription:
      'Ask questions about your notes and get AI-powered answers with citations. Your personal knowledge assistant.',
    highlights: [
      'Chat-style Q&A interface',
      'AI-powered answers from your notes',
      'Citation links back to source notes',
      'Streaming response visualization',
    ],
  },
  aiLearningPath: {
    featureName: 'AI Learning Path',
    featureDescription:
      'Get personalized course recommendations powered by AI, tailored to your goals and progress.',
    highlights: [
      'Personalized course ordering',
      'Drag-and-drop manual overrides',
      'AI-powered gap analysis',
      'Progress-aware recommendations',
    ],
  },
  knowledgeGaps: {
    featureName: 'Knowledge Gap Detection',
    featureDescription:
      'AI analyzes your notes and progress to identify topics you may need to revisit.',
    highlights: [
      'Automatic gap detection',
      'Severity-based prioritization',
      'Direct links to course content',
      'Under-noted and skipped topic alerts',
    ],
  },
  reviewQueue: {
    featureName: 'Spaced Review',
    featureDescription:
      'Optimize your retention with scientifically-backed spaced repetition scheduling.',
    highlights: [
      'Smart review scheduling',
      'Retention prediction',
      'Priority-based review queue',
      'Confidence-based rating system',
    ],
  },
  interleavedReview: {
    featureName: 'Interleaved Review',
    featureDescription:
      'Review notes from multiple courses in a mixed session for deeper learning and better retention.',
    highlights: [
      'Cross-course interleaving',
      'Session progress tracking',
      'Review summary and statistics',
      'Scientifically-optimized mixing',
    ],
  },
  retentionDashboard: {
    featureName: 'Retention Analytics',
    featureDescription:
      'Visualize your knowledge retention across topics with decay alerts and trend analysis.',
    highlights: [
      'Topic-level retention scores',
      'Engagement decay alerts',
      'Retention statistics overview',
      'Visual retention trends',
    ],
  },
  flashcards: {
    featureName: 'Flashcard Review',
    featureDescription:
      'Study with auto-generated flashcards using spaced repetition for long-term retention.',
    highlights: [
      'Auto-generated flashcards',
      'Spaced repetition scheduling',
      'Deck management by course',
      'Review session summaries',
    ],
  },
} as const

// --- Internal preview component ---

interface FeaturePreviewProps {
  featureName: string
  featureDescription: string
  icon: LucideIcon
  highlights?: readonly string[]
  preview?: ReactNode
}

function FeaturePreview({
  featureName,
  featureDescription,
  icon: Icon,
  highlights,
  preview,
}: FeaturePreviewProps) {
  return (
    <div className="relative min-h-[500px]" data-testid="premium-feature-preview">
      {/* Blurred static preview mockup (AC1) */}
      {preview && (
        <div
          className="pointer-events-none select-none overflow-hidden rounded-[24px] max-h-[600px]"
          aria-hidden="true"
        >
          <div className="blur-sm opacity-40 scale-[0.98]">{preview}</div>
          {/* Gradient fade at bottom of preview */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      {/* Static placeholder when no preview provided */}
      {!preview && (
        <div
          className="pointer-events-none select-none overflow-hidden rounded-[24px] max-h-[600px]"
          aria-hidden="true"
        >
          <div className="blur-sm opacity-30 space-y-4 p-6">
            <div className="h-8 w-48 rounded-lg bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 rounded-[24px] bg-muted" />
              <div className="h-28 rounded-[24px] bg-muted" />
              <div className="h-28 rounded-[24px] bg-muted" />
            </div>
            <div className="h-48 rounded-[24px] bg-muted" />
            <div className="h-32 rounded-[24px] bg-muted" />
          </div>
        </div>
      )}

      {/* Overlay CTA card (AC2) */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="w-full max-w-lg rounded-[24px] border border-gold-muted/50 bg-card/95 backdrop-blur-md p-8 shadow-xl"
          role="region"
          aria-label={`${featureName} — Premium feature`}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Feature icon */}
            <div className="rounded-full bg-gold-muted p-4">
              <Icon className="size-8 text-gold" aria-hidden="true" />
            </div>

            {/* Feature name and description (AC2) */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Crown className="size-4 text-gold" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gold">
                  Premium Feature
                </span>
              </div>
              <h1 className="text-xl font-display font-bold text-foreground">{featureName}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {featureDescription}
              </p>
            </div>

            {/* Feature highlights */}
            {highlights && highlights.length > 0 && (
              <ul className="text-left text-sm text-muted-foreground space-y-2 w-full max-w-xs">
                {highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Sparkles className="size-4 text-gold mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* UpgradeCTA handles the button + auth flow (AC3, AC4, AC5) */}
            <div className="w-full">
              <UpgradeCTA featureLabel={featureName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
