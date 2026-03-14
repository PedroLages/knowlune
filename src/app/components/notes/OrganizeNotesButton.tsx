import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { toast } from 'sonner'
import { isAIAvailable, isFeatureEnabled } from '@/lib/aiConfiguration'
import { organizeNotes, type NoteOrganizationProposal } from '@/ai/noteOrganizer'
import { OrganizePreviewDialog } from './OrganizePreviewDialog'
import type { Note } from '@/data/types'

interface OrganizeNotesButtonProps {
  notes: Note[]
  courseNames: Map<string, string>
}

export function OrganizeNotesButton({ notes, courseNames }: OrganizeNotesButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [proposals, setProposals] = useState<NoteOrganizationProposal[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const aiAvailable = isAIAvailable()
  const featureEnabled = isFeatureEnabled('noteOrganization')
  const hasNotes = notes.length > 0
  const isDisabled = !aiAvailable || !featureEnabled || !hasNotes || isProcessing

  async function handleOrganize() {
    setIsProcessing(true)
    try {
      const result = await organizeNotes(notes, courseNames)
      setProposals(result)
      setDialogOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to organize notes'
      toast.error(message, {
        action: {
          label: 'Retry',
          onClick: () => handleOrganize(),
        },
      })
    } finally {
      setIsProcessing(false)
    }
  }

  function getTooltipMessage(): string | null {
    if (!aiAvailable) return 'AI provider not configured. Set up in Settings.'
    if (!featureEnabled) return 'Note organization is disabled in Settings.'
    if (!hasNotes) return 'No notes to organize.'
    return null
  }

  const tooltipMessage = getTooltipMessage()

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleOrganize}
      disabled={isDisabled}
      aria-label="Organize notes with AI"
      aria-busy={isProcessing}
    >
      {isProcessing ? (
        <Loader2 className="size-4 animate-spin mr-1.5" aria-hidden="true" />
      ) : (
        <Sparkles className="size-4 mr-1.5" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{isProcessing ? 'Analyzing...' : 'Organize with AI'}</span>
      <span className="sm:hidden">{isProcessing ? '' : ''}</span>
    </Button>
  )

  return (
    <>
      {tooltipMessage ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltipMessage}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <OrganizePreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proposals={proposals}
        notes={notes}
      />
    </>
  )
}
