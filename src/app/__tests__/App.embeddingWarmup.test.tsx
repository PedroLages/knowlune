/**
 * E68-S01: App warm-up effect tests.
 *
 * Verifies that the embedding model warm-up effect in App.tsx:
 * 1. Fires after a 3s delay
 * 2. Checks supportsWorkers() before proceeding
 * 3. Respects deviceMemory >= 4GB gate
 * 4. Uses requestIdleCallback when available, with fallback
 * 5. Cleans up the timer on unmount
 * 6. Handles errors silently (best-effort)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// ─── Module mocks ───────────────────────────────────────────────────────────

let mockSupportsWorkers = true

vi.mock('@/ai/lib/workerCapabilities', () => ({
  supportsWorkers: vi.fn(() => mockSupportsWorkers),
}))

vi.mock('@/ai/embeddingPipeline', () => ({
  embeddingPipeline: {
    warmUp: vi.fn().mockResolvedValue(undefined),
  },
}))

// Stub out heavy dependencies not under test
vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, RouterProvider: () => <div data-testid="router-stub" /> }
})
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/app/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/app/components/WelcomeWizard', () => ({ WelcomeWizard: () => null }))
vi.mock('@/app/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/app/components/PWAUpdatePrompt', () => ({ PWAUpdatePrompt: () => null }))
vi.mock('@/app/components/PWAInstallBanner', () => ({ PWAInstallBanner: () => null }))
vi.mock('@/app/components/embeddings/EmbeddingModelProgressToast', () => ({
  EmbeddingModelProgressToast: () => null,
}))
vi.mock('@/stores/useSessionStore', () => {
  const recoverOrphanedSessions = vi.fn()
  function useSessionStore() {
    return {}
  }
  useSessionStore.getState = () => ({ recoverOrphanedSessions })
  return { useSessionStore }
})
vi.mock('@/stores/useWelcomeWizardStore', () => ({
  useWelcomeWizardStore: () => ({ initialize: vi.fn() }),
}))
vi.mock('@/stores/useNotificationPrefsStore', () => ({
  useNotificationPrefsStore: { getState: () => ({ init: vi.fn() }) },
}))
vi.mock('@/hooks/useFontScale', () => ({ useFontScale: vi.fn() }))
vi.mock('@/hooks/useColorScheme', () => ({ useColorScheme: vi.fn() }))
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ shouldReduceMotion: false }),
}))
vi.mock('@/hooks/useAccessibilityFont', () => ({ useAccessibilityFont: vi.fn() }))
vi.mock('@/hooks/useContentDensity', () => ({ useContentDensity: vi.fn() }))
vi.mock('@/lib/errorTracking', () => ({ initErrorTracking: vi.fn() }))
vi.mock('@/ai/vector-store', () => ({
  vectorStorePersistence: { loadAll: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/lib/youtubeMetadataRefresh', () => ({
  refreshStaleMetadata: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/services/NotificationService', () => ({
  initNotificationService: vi.fn(),
  destroyNotificationService: vi.fn(),
}))
vi.mock('motion/react', () => ({
  MotionConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('agentation', () => ({ Agentation: () => null }))
vi.mock('@/app/components/sync/SyncUXShell', () => ({
  SyncUXShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ─── Imports ─────────────────────────────────────────────────────────────────
import App from '../App'
import { embeddingPipeline } from '@/ai/embeddingPipeline'
// supportsWorkers is accessed via the mocked module — not directly imported

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setDeviceMemory(mb: number | undefined): void {
  if (mb === undefined) {
    delete (navigator as unknown as Record<string, unknown>).deviceMemory
  } else {
    Object.defineProperty(navigator, 'deviceMemory', {
      value: mb,
      writable: true,
      configurable: true,
    })
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('App — embedding model warm-up', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockSupportsWorkers = true
    setDeviceMemory(8)

    // Ensure requestIdleCallback is not available by default (jsdom doesn't have it)
    delete (window as unknown as Record<string, unknown>).requestIdleCallback
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls warmUp() after the 3s delay when conditions are met', async () => {
    render(<App />)

    // Before 3s, warmUp should not be called
    await vi.advanceTimersByTimeAsync(2_900)
    expect(embeddingPipeline.warmUp).not.toHaveBeenCalled()

    // After 3s, warmUp should be called
    await vi.advanceTimersByTimeAsync(200)
    expect(embeddingPipeline.warmUp).toHaveBeenCalledTimes(1)
  })

  it('skips warmUp when supportsWorkers() returns false', async () => {
    mockSupportsWorkers = false

    render(<App />)

    await vi.advanceTimersByTimeAsync(4_000)

    expect(embeddingPipeline.warmUp).not.toHaveBeenCalled()
  })

  it('skips warmUp when deviceMemory < 4GB', async () => {
    setDeviceMemory(2)

    render(<App />)

    await vi.advanceTimersByTimeAsync(4_000)

    expect(embeddingPipeline.warmUp).not.toHaveBeenCalled()
  })

  it('proceeds with warmUp when deviceMemory is undefined', async () => {
    setDeviceMemory(undefined)

    render(<App />)

    await vi.advanceTimersByTimeAsync(4_000)

    expect(embeddingPipeline.warmUp).toHaveBeenCalledTimes(1)
  })

  it('uses requestIdleCallback when available', async () => {
    const idleCallbackSpy = vi.fn((cb: IdleRequestCallback): number => {
      cb({ didTimeout: false, timeRemaining: () => 50 })
      return 1
    })
    window.requestIdleCallback = idleCallbackSpy

    render(<App />)

    await vi.advanceTimersByTimeAsync(4_000)

    // The idle callback should have been registered
    expect(idleCallbackSpy).toHaveBeenCalled()
    // warmUp should have been called (via the idle callback invocation)
    expect(embeddingPipeline.warmUp).toHaveBeenCalledTimes(1)
  })

  it('handles warmUp errors silently (best-effort)', async () => {
    vi.mocked(embeddingPipeline.warmUp).mockRejectedValueOnce(new Error('Network error'))

    render(<App />)

    // Should not throw — the catch in App.tsx silently ignores warm-up failures
    await vi.advanceTimersByTimeAsync(4_000)

    // Verify warmUp was called (and its rejection was silently caught)
    expect(embeddingPipeline.warmUp).toHaveBeenCalledTimes(1)
  })

  it('cleans up the timeout on unmount', async () => {
    const { unmount } = render(<App />)

    // Unmount before the 3s delay fires
    unmount()

    await vi.advanceTimersByTimeAsync(4_000)

    // warmUp should NOT be called since the timer was cleaned up
    expect(embeddingPipeline.warmUp).not.toHaveBeenCalled()
  })
})
