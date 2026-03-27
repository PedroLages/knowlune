import { Sparkles, CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

/**
 * Gradient presets for path card headers.
 * Each path gets a deterministic gradient based on its name hash.
 */
const GRADIENTS = [
  'from-cyan-400 to-blue-600',
  'from-emerald-400 to-green-600',
  'from-purple-500 to-indigo-700',
  'from-orange-400 to-blue-500',
  'from-pink-400 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-teal-400 to-cyan-600',
  'from-rose-400 to-red-600',
] as const

/** Not-started paths get a muted gradient */
const MUTED_GRADIENT = 'from-muted-foreground/60 to-muted-foreground/80'

/** Simple string hash to pick a gradient deterministically */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface PathCardHeaderProps {
  /** Path name — used to seed gradient selection */
  pathName: string
  /** Completion percentage — determines visual treatment */
  completionPct: number
  /** Whether the path was AI-generated */
  isAIGenerated?: boolean
  /** Additional className */
  className?: string
}

/**
 * Gradient header for learning path cards.
 * Picks a gradient deterministically from the path name,
 * adds a completed overlay for 100% paths, and shows
 * an AI badge for AI-generated paths.
 */
export function PathCardHeader({
  pathName,
  completionPct,
  isAIGenerated,
  className,
}: PathCardHeaderProps) {
  const isCompleted = completionPct >= 100
  const isNotStarted = completionPct === 0

  const gradient = isNotStarted
    ? MUTED_GRADIENT
    : GRADIENTS[hashString(pathName) % GRADIENTS.length]

  return (
    <div
      className={cn(
        'relative h-32 bg-gradient-to-br overflow-hidden',
        gradient,
        className
      )}
    >
      {/* Subtle radial highlight */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />

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
