/**
 * useDeepLinkEffects — Reads URL search params for deep-linking into the lesson player.
 *
 * Supports:
 * - `?t=<seconds>` — seek video to a specific timestamp
 * - `?panel=notes` — open the notes panel (desktop) or switch to notes tab (mobile/tablet)
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

interface DeepLinkSetters {
  setSeekToTime: (time: number | undefined) => void
  setFocusTab: (tab: string | null) => void
  isDesktop: boolean
  openNotesWithFocus: () => void
}

export function useDeepLinkEffects({
  setSeekToTime,
  setFocusTab,
  isDesktop,
  openNotesWithFocus,
}: DeepLinkSetters): void {
  const [searchParams] = useSearchParams()

  const seekParam = searchParams.get('t')
  useEffect(() => {
    if (seekParam) {
      const seconds = Number(seekParam)
      if (!isNaN(seconds) && seconds >= 0) {
        setSeekToTime(seconds)
      }
    }
  }, [seekParam, setSeekToTime])

  const panelParam = searchParams.get('panel')
  useEffect(() => {
    if (panelParam === 'notes') {
      if (isDesktop) {
        openNotesWithFocus()
      } else {
        setFocusTab('notes')
      }
    }
  }, [panelParam, isDesktop, openNotesWithFocus, setFocusTab])
}
