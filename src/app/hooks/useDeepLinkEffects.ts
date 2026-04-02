/**
 * useDeepLinkEffects — Reads URL search params for deep-linking into the lesson player.
 *
 * Supports:
 * - `?t=<seconds>` — seek video to a specific timestamp
 * - `?panel=notes` — open the notes panel (desktop) or switch to notes tab (mobile)
 *
 * Ported from the classic LessonPlayer's inline useEffect calls.
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

interface DeepLinkSetters {
  setSeekToTime: (time: number | undefined) => void
  setNotesOpen: (open: boolean) => void
  setFocusTab: (tab: string | null) => void
}

export function useDeepLinkEffects({
  setSeekToTime,
  setNotesOpen,
  setFocusTab,
}: DeepLinkSetters): void {
  const [searchParams] = useSearchParams()

  // ?t=<seconds> — seek video to timestamp
  const seekParam = searchParams.get('t')
  useEffect(() => {
    if (seekParam) {
      const seconds = Number(seekParam)
      if (!isNaN(seconds) && seconds >= 0) {
        setSeekToTime(seconds)
      }
    }
  }, [seekParam, setSeekToTime])

  // ?panel=notes — open notes panel (desktop) or switch to notes tab (mobile)
  const panelParam = searchParams.get('panel')
  useEffect(() => {
    if (panelParam === 'notes') {
      setNotesOpen(true)
      setFocusTab('notes')
    }
  }, [panelParam, setNotesOpen, setFocusTab])
}
