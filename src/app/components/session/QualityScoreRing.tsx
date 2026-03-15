import { motion } from 'motion/react'
import { getQualityTier, QUALITY_TIER_LABELS } from '@/lib/qualityScore'
import type { QualityTier } from '@/data/types'

interface QualityScoreRingProps {
  score: number
  size?: number
}

const TIER_COLORS: Record<QualityTier, string> = {
  excellent: 'text-success',
  good: 'text-brand',
  fair: 'text-warning',
  'needs-improvement': 'text-destructive',
}

const TIER_STROKE_COLORS: Record<QualityTier, string> = {
  excellent: 'var(--success)',
  good: 'var(--brand)',
  fair: 'var(--warning)',
  'needs-improvement': 'var(--destructive)',
}

export function QualityScoreRing({ score, size = 160 }: QualityScoreRingProps) {
  const tier = getQualityTier(score)
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Session quality score: ${score} out of 100, ${QUALITY_TIER_LABELS[tier]}`}
      data-testid="quality-score-display"
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TIER_STROKE_COLORS[tier]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-heading text-4xl font-bold"
          data-testid="quality-score-value"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {score}
        </motion.span>
        <motion.span
          className={`text-sm font-medium ${TIER_COLORS[tier]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          {QUALITY_TIER_LABELS[tier]}
        </motion.span>
      </div>
    </div>
  )
}
