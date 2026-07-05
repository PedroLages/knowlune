import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/app/components/ui/button'

/**
 * Fallback UI shown when a lazy-loaded route chunk fails to load while offline.
 *
 * Follows the EmptyState component pattern: centered card with icon, heading,
 * description, and action button. Uses design tokens for theme consistency.
 *
 * @since E64-S09
 */
export function OfflineRouteFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-6" role="alert" aria-live="assertive">
      <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center shadow-lg">
        {/* Icon */}
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-soft">
          <WifiOff className="size-8 text-brand-soft-foreground" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h2 className="mb-2 text-xl font-semibold text-card-foreground">
          This page isn't available offline
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Visit it while connected to access it later.
        </p>

        {/* Action */}
        <Button variant="brand" size="lg" asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    </div>
  )
}
