import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { cn } from '@/app/components/ui/utils'

interface FocusOverlayProps {
  isFocusMode: boolean
  isMobile: boolean
  shouldReduceMotion: boolean
  showExitConfirmation: boolean
  announcement: string
  onOverlayClick: () => void
  onCloseClick: () => void
  onConfirmExit: () => void
  onCancelExit: () => void
  getPortalContainer: () => HTMLDivElement
}

/**
 * Full-viewport dimmed overlay with backdrop blur for focus mode.
 * Rendered via React portal to document.body.
 *
 * Desktop/Tablet: semi-transparent overlay with blur.
 * Mobile: no overlay needed (focused component goes full-screen).
 */
export function FocusOverlay({
  isFocusMode,
  isMobile,
  shouldReduceMotion,
  showExitConfirmation,
  announcement,
  onOverlayClick,
  onCloseClick,
  onConfirmExit,
  onCancelExit,
  getPortalContainer,
}: FocusOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when overlay is visible
  useEffect(() => {
    if (isFocusMode) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFocusMode])

  if (!isFocusMode) return null

  const portalContainer = getPortalContainer()

  const overlay = (
    <>
      {/* Aria-live announcement region */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="focus-mode-announcement"
      >
        {announcement}
      </div>

      {/* Overlay backdrop (desktop/tablet only) */}
      {!isMobile && (
        <div
          ref={overlayRef}
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm dark:bg-black/65',
            shouldReduceMotion
              ? 'transition-none'
              : 'animate-in fade-in duration-200'
          )}
          onClick={onOverlayClick}
          data-testid="focus-overlay-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed z-50 text-muted-foreground hover:text-foreground',
          isMobile ? 'top-3 right-3' : 'top-4 right-4'
        )}
        onClick={onCloseClick}
        aria-label="Exit focus mode"
        data-testid="focus-overlay-close"
      >
        <X className="size-5" />
      </Button>

      {/* Quiz exit confirmation dialog */}
      <AlertDialog open={showExitConfirmation}>
        <AlertDialogContent data-testid="focus-exit-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Exit focus mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Your quiz progress will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelExit}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmExit}>Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return createPortal(overlay, portalContainer)
}
