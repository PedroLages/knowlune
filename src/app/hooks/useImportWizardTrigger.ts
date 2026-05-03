import { useState, useCallback } from 'react'
import {
  isImportWizardOpen,
  IMPORT_WIZARD_SET_TARGET,
} from '@/app/components/figma/ImportWizardDialog'

/**
 * Shared hook for the import-wizard singleton guard pattern.
 * Returns a stable trigger function that dispatches an event to
 * the already-open wizard or opens a new one, plus the local state
 * needed to render the <ImportWizardDialog>.
 */
export function useImportWizardTrigger() {
  const [isOpen, setIsOpen] = useState(false)
  const [targetPathId, setTargetPathId] = useState<string | null>(null)

  const trigger = useCallback((pathId: string | null = null) => {
    if (isImportWizardOpen()) {
      window.dispatchEvent(
        new CustomEvent(IMPORT_WIZARD_SET_TARGET, {
          detail: { pathId },
        })
      )
    } else {
      setTargetPathId(pathId)
      setIsOpen(true)
    }
  }, [])

  return { trigger, isOpen, setIsOpen, targetPathId }
}
