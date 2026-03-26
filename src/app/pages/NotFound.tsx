import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full rounded-[24px]">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="size-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
            <MapPinOff className="size-8 text-brand-muted" aria-hidden="true" />
          </div>
          <h1 className="font-display text-4xl font-bold mb-2">404</h1>
          <h2 className="font-display text-lg font-medium mb-2">Page not found</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link to="/">Go to Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
