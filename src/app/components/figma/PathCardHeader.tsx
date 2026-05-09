import { Sparkles, CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { PathCoverReadabilityScrim } from '@/app/components/learning-path/PathCoverReadabilityScrim'
import {
  normalizePathCoverCompletionPct,
  resolvePathCoverTheme,
} from '@/data/pathCoverGradients'

interface PathCardHeaderProps {
  /** Path name — used for hash fallback when there is no preset, image, or (after normalization) no progress */
  pathName: string
  /** Completion percentage (0–100); coerced via `normalizePathCoverCompletionPct` for theme + completed overlay */
  completionPct: number
  /** Whether the path was AI-generated */
  isAIGenerated?: boolean
  /** Custom cover image URL (Supabase Storage public URL) */
  coverImageUrl?: string
  /** Named gradient preset key (e.g. 'cyan-blue'). Used when coverImageUrl is absent. */
  coverPreset?: string
  /** Additional className */
  className?: string
}

/**
 * Gradient or photo header strip for learning path cards.
 * Theme resolution matches {@link resolvePathCoverTheme}: image, preset, muted at 0% (after normalization),
 * then hash fallback. Completed paths get a success overlay; AI-generated paths show a badge.
 */
export function PathCardHeader({
  pathName,
  completionPct,
  isAIGenerated,
  coverImageUrl,
  coverPreset,
  className,
}: PathCardHeaderProps) {
  const pct = normalizePathCoverCompletionPct(completionPct)
  const isCompleted = pct >= 100
  const theme = resolvePathCoverTheme({
    pathName,
    coverImageUrl,
    coverPreset,
    completionPct: pct,
  })
  const hasCoverImage = theme.kind === 'image'
  const gradient = theme.kind === 'gradient' ? theme.tailwindFragment : ''

  return (
    <div
      className={cn(
        'relative h-32 overflow-hidden',
        hasCoverImage ? 'bg-muted' : `bg-gradient-to-br ${gradient}`,
        className
      )}
    >
      {/* Cover image */}
      {theme.kind === 'image' && (
        <>
          <img
            src={theme.url}
            alt=""
            role="presentation"
            className="absolute inset-0 w-full h-full object-cover shrink-0"
            loading="lazy"
          />
          <PathCoverReadabilityScrim />
        </>
      )}

      {/* Subtle radial highlight — only on gradient backgrounds */}
      {!hasCoverImage && (
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
      )}

      {/* Completed overlay */}
      {isCompleted && (
        <div className="absolute inset-0 flex items-center justify-center bg-success/20">
          <div className="bg-card/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            <span className="text-xs font-bold text-success uppercase tracking-tight">
              Completed
            </span>
          </div>
        </div>
      )}

      {/* AI Generated badge */}
      {isAIGenerated && (
        <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/30 flex items-center gap-1">
          <Sparkles className="size-3.5 text-white" aria-hidden="true" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            AI Generated
          </span>
        </div>
      )}
    </div>
  )
}
