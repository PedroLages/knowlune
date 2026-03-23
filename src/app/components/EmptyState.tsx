import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Link } from 'react-router'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
}

type EmptyStateAction =
  | { actionLabel: string; actionHref: string; onAction?: never }
  | { actionLabel: string; onAction: () => void; actionHref?: never }
  | { actionLabel?: never; actionHref?: never; onAction?: never }

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  headingLevel?: 2 | 3
  'data-testid'?: string
  className?: string
} & EmptyStateAction

export function EmptyState({
  icon: Icon,
  title,
  description,
  headingLevel = 2,
  actionLabel,
  actionHref,
  onAction,
  'data-testid': testId,
  className,
}: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion()
  const Heading = headingLevel === 3 ? 'h3' : 'h2'

  return (
    <motion.div
      role="status"
      variants={fadeUp}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="visible"
      data-testid={testId}
    >
      <Card className={cn('border-2 border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="size-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
            <Icon
              className="size-8 text-brand-muted"
              aria-hidden="true"
              data-testid="empty-state-icon"
            />
          </div>
          <Heading className="font-display text-lg font-medium mb-2">{title}</Heading>
          <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
          {actionLabel && onAction && (
            <Button variant="brand" size="lg" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {actionLabel && actionHref && !onAction && (
            <Button asChild variant="brand" size="lg">
              <Link to={actionHref}>{actionLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
