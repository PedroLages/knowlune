import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import type { QualityFactors } from '@/data/types'
import { QualityScoreRing } from './QualityScoreRing'
import { FactorBreakdown } from './FactorBreakdown'

interface QualityScoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  score: number
  factors: QualityFactors
}

export function QualityScoreDialog({
  open,
  onOpenChange,
  score,
  factors,
}: QualityScoreDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-center">Session Complete</DialogTitle>
          <DialogDescription className="text-center">
            Here&apos;s how your study session went
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <QualityScoreRing score={score} />
          <div className="w-full">
            <FactorBreakdown factors={factors} />
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
