import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { LucideIcon } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import { Link } from 'react-router'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  'data-testid'?: string
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  'data-testid': testId,
  className,
}: EmptyStateProps) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" data-testid={testId}>
      <Card className={cn('border-2 border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-brand" data-testid="empty-state-icon" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
          {actionLabel && onAction && (
            <Button size="lg" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {actionLabel && actionHref && !onAction && (
            <Button asChild size="lg">
              <Link to={actionHref}>{actionLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
