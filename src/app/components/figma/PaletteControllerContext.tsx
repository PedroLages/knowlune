import { createContext, useContext } from 'react'
import type { EntityType } from '@/lib/unifiedSearch'

interface PaletteController {
  /** Open the palette, optionally pre-scoped to `scope`. */
  open: (scope?: EntityType) => void
}

const PaletteControllerContext = createContext<PaletteController | null>(null)

export const PaletteControllerProvider = PaletteControllerContext.Provider

export function usePaletteController(): PaletteController {
  const ctx = useContext(PaletteControllerContext)
  if (!ctx) {
    throw new Error('usePaletteController must be used inside <PaletteControllerProvider>')
  }
  return ctx
}
