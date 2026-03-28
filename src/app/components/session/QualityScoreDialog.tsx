import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import type { QualityFactors } from '@/data/types'
import { QualityScoreRing } from './QualityScoreRing'
import { FactorBreakdown } from './FactorBreakdown'

interface QualityScoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  score: number
  factors: QualityFactors
}

function ScoreContent({
  score,
  factors,
  onClose,
}: {
  score: number
  factors: QualityFactors
  onClose: () => void
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-6 py-4">
        <QualityScoreRing score={score} />
        <div className="w-full">
          <FactorBreakdown factors={factors} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button className="w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </>
  )
}

export function QualityScoreDialog({
  open,
  onOpenChange,
  score,
  factors,
}: QualityScoreDialogProps) {
  const isMobile = useIsMobile()
  const handleClose = () => onOpenChange(false)

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[24px]">
          <SheetHeader>
            <SheetTitle className="text-center">Session Complete</SheetTitle>
            <SheetDescription className="text-center">
              Here&apos;s how your study session went
            </SheetDescription>
          </SheetHeader>
          <ScoreContent score={score} factors={factors} onClose={handleClose} />
          <SheetFooter />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-center">Session Complete</DialogTitle>
          <DialogDescription className="text-center">
            Here&apos;s how your study session went
          </DialogDescription>
        </DialogHeader>
        <ScoreContent score={score} factors={factors} onClose={handleClose} />
        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}
