import { useEffect, useState } from 'react'
import {
  getNoteQAAvailability,
  type NoteQAAvailability,
} from '@/lib/aiConfiguration'

type NoteQAAvailabilityState =
  | { status: 'checking'; availability: null }
  | { status: 'available'; availability: Extract<NoteQAAvailability, { available: true }> }
  | { status: 'unavailable'; availability: Extract<NoteQAAvailability, { available: false }> }

export function useNoteQAAvailability(): NoteQAAvailabilityState {
  const [state, setState] = useState<NoteQAAvailabilityState>({
    status: 'checking',
    availability: null,
  })

  useEffect(() => {
    let runId = 0
    let cancelled = false

    const refresh = () => {
      const currentRun = ++runId
      setState(prev => (prev.status === 'checking' ? prev : { status: 'checking', availability: null }))

      getNoteQAAvailability()
        .then(availability => {
          if (cancelled || currentRun !== runId) return
          setState(
            availability.available
              ? { status: 'available', availability }
              : { status: 'unavailable', availability }
          )
        })
        .catch(() => {
          // silent-catch-ok: the hook converts check failures into an unavailable state.
          if (cancelled || currentRun !== runId) return
          setState({
            status: 'unavailable',
            availability: {
              available: false,
              reason: 'availability-check-failed',
              provider: 'openai',
              providerName: 'AI provider',
            },
          })
        })
    }

    refresh()
    window.addEventListener('ai-configuration-updated', refresh)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== 'ai-configuration') return
      refresh()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      cancelled = true
      window.removeEventListener('ai-configuration-updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return state
}
