import { useState, useCallback } from 'react'
import {
  isImportWizardOpen,
  IMPORT_WIZARD_SET_TARGET,
} from '@/app/components/figma/ImportWizardDialog'

export interface GapContext {
  gapEntryId: string
  searchTerm?: string
}

/**
 * Shared hook for the import-wizard singleton guard pattern.
 * Returns a stable trigger function that dispatches an event to
 * the already-open wizard or opens a new one, plus the local state
 * needed to render the <ImportWizardDialog>.
 */
export function useImportWizardTrigger() {
  const [isOpen, setIsOpen] = useState(false)
  const [targetPathId, setTargetPathId] = useState<string | null>(null)
  const [gapContext, setGapContext] = useState<GapContext | null>(null)

  const trigger = useCallback((pathId: string | null = null, gap?: GapContext) => {
    if (isImportWizardOpen()) {
      window.dispatchEvent(
        new CustomEvent(IMPORT_WIZARD_SET_TARGET, {
          detail: { pathId, gap },
        })
      )
    } else {
      setTargetPathId(pathId)
      setGapContext(gap ?? null)
      setIsOpen(true)
    }
  }, [])

  return { trigger, isOpen, setIsOpen, targetPathId, gapContext }
}
