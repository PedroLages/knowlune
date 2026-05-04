import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { useAuthorStore } from '@/stores/useAuthorStore'

/** Inline banner when author store load/refresh fails (cold load or sync reload). */
export function AuthorsSyncErrorBanner() {
  const error = useAuthorStore(s => s.error)
  const clearAuthorsLoadError = useAuthorStore(s => s.clearAuthorsLoadError)

  if (!error) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="size-4" aria-hidden />
      <AlertTitle>Authors</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{error}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-background/50 bg-transparent"
          onClick={() => clearAuthorsLoadError()}
        >
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  )
}
