import { motion } from 'motion/react'
import type { QualityFactors } from '@/data/types'
import { fadeUp, staggerContainer } from '@/lib/motion'

interface FactorBreakdownProps {
  factors: QualityFactors
}

interface FactorConfig {
  key: keyof QualityFactors
  label: string
  weight: string
  color: string
  testId: string
}

const FACTORS: FactorConfig[] = [
  {
    key: 'activeTimeScore',
    label: 'Active Time',
    weight: '40%',
    color: 'var(--chart-1)',
    testId: 'factor-active-time',
  },
  {
    key: 'interactionDensityScore',
    label: 'Interactions',
    weight: '30%',
    color: 'var(--chart-2)',
    testId: 'factor-interaction-density',
  },
  {
    key: 'sessionLengthScore',
    label: 'Session Length',
    weight: '15%',
    color: 'var(--chart-3)',
    testId: 'factor-session-length',
  },
  {
    key: 'breaksScore',
    label: 'Breaks',
    weight: '15%',
    color: 'var(--chart-4)',
    testId: 'factor-breaks',
  },
]

export function FactorBreakdown({ factors }: FactorBreakdownProps) {
  return (
    <motion.div
      className="grid gap-3"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {FACTORS.map(factor => {
        const value = factors[factor.key]
        return (
          <motion.div
            key={factor.key}
            className="space-y-1"
            variants={fadeUp}
            data-testid={factor.testId}
            role="meter"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${factor.label} (${factor.weight} weight): ${value} out of 100`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">
                {factor.label}{' '}
                <span className="text-muted-foreground text-xs">({factor.weight})</span>
              </span>
              <span className="tabular-nums font-medium">{value}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic CSS variable (var(--chart-N)) per factor; cannot be expressed as static Tailwind class
                style={{ backgroundColor: factor.color }}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
