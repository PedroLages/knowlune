import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProviderReconsent } from '../useProviderReconsent'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/compliance/consentEffects', () => ({
  grantConsent: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/compliance/noticeAck', () => ({
  writeNoticeAck: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/compliance/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2026-04-23.1',
}))

vi.mock('@/lib/compliance/consentService', () => ({
  listForUser: vi.fn().mockResolvedValue([]),
}))

import { grantConsent } from '@/lib/compliance/consentEffects'
import { writeNoticeAck } from '@/lib/compliance/noticeAck'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(grantConsent).mockResolvedValue({ success: true })
  vi.mocked(writeNoticeAck).mockResolvedValue(undefined)
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useProviderReconsent', () => {
  describe('handleAIError', () => {
    it('returns true and opens modal for ProviderReconsentError', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        const handled = result.current.handleAIError(
          new ProviderReconsentError('ai_tutor', 'openai'),
        )
        expect(handled).toBe(true)
      })

      expect(result.current.modalProps.open).toBe(true)
    })

    it('returns false and does not open modal for generic errors', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        const handled = result.current.handleAIError(new Error('network error'))
        expect(handled).toBe(false)
      })

      expect(result.current.modalProps.open).toBe(false)
    })

    it('sets correct providerId and purpose from the error', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_embeddings', 'anthropic'))
      })

      expect(result.current.modalProps.providerId).toBe('anthropic')
      expect(result.current.modalProps.purpose).toBe('ai_embeddings')
    })

    it('clears declinedProvider when a new error arrives', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      // Decline first
      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })
      act(() => {
        result.current.modalProps.onDecline()
      })
      expect(result.current.declinedProvider).toBe('openai')

      // New provider error should clear declined state
      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'anthropic'))
      })
      expect(result.current.declinedProvider).toBeNull()
    })
  })

  describe('accept path', () => {
    it('does NOT call onRetry when grantConsent write fails', async () => {
      vi.mocked(grantConsent).mockResolvedValueOnce({ success: false, error: 'IDB error' })
      const onRetry = vi.fn()
      const { result } = renderHook(() => useProviderReconsent('user-1', { onRetry }))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })

      await act(async () => {
        await result.current.modalProps.onAccept()
      })

      // Modal closes but onRetry is suppressed to avoid an immediate re-trigger loop
      expect(result.current.modalProps.open).toBe(false)
      expect(onRetry).not.toHaveBeenCalled()
    })

    it('calls grantConsent with correct evidence.provider_id', async () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })

      await act(async () => {
        await result.current.modalProps.onAccept()
      })

      expect(grantConsent).toHaveBeenCalledWith('user-1', 'ai_tutor', { provider_id: 'openai' })
    })

    it('closes modal after accept', async () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })

      await act(async () => {
        await result.current.modalProps.onAccept()
      })

      expect(result.current.modalProps.open).toBe(false)
    })

    it('calls onRetry after accept when provided', async () => {
      const onRetry = vi.fn()
      const { result } = renderHook(() => useProviderReconsent('user-1', { onRetry }))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })

      await act(async () => {
        await result.current.modalProps.onAccept()
      })

      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('decline path', () => {
    it('closes modal and sets declinedProvider on decline', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'anthropic'))
      })

      act(() => {
        result.current.modalProps.onDecline()
      })

      expect(result.current.modalProps.open).toBe(false)
      expect(result.current.declinedProvider).toBe('anthropic')
    })

    it('does not call grantConsent on decline', () => {
      const { result } = renderHook(() => useProviderReconsent('user-1'))

      act(() => {
        result.current.handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))
      })

      act(() => {
        result.current.modalProps.onDecline()
      })

      expect(grantConsent).not.toHaveBeenCalled()
    })
  })
})
