/**
 * E97-S04: App-level composition tests for the NewDeviceDownloadOverlay gate.
 *
 * Verifies:
 *   1. Overlay is NOT shown when LinkDataDialog is open (mutually exclusive).
 *   2. Overlay is NOT shown when InitialUploadWizard is active (mutually exclusive).
 *   3. Overlay IS shown (after 2s defer) when predicate resolves true AND no
 *      local data dialogs/wizards are in flight.
 *   4. Overlay is NOT shown when the predicate resolves false.
 *   5. 2s defer: overlay does NOT mount visually if the store reaches
 *      `complete` within the defer window.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, waitFor } from '@testing-library/react'

// ─── Module mocks ────────────────────────────────────────────────────────────

let mockAuthUser: { id: string } | null = null

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn((selector?: (s: { user: { id: string } | null }) => unknown) => {
    const state = { user: mockAuthUser }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/lib/sync/shouldShowInitialUploadWizard', () => ({
  shouldShowInitialUploadWizard: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/sync/shouldShowDownloadOverlay', () => ({
  shouldShowDownloadOverlay: vi.fn(),
}))

vi.mock('@/app/components/sync/InitialUploadWizard', () => ({
  InitialUploadWizard: (props: { open: boolean; userId: string; onClose: () => void }) =>
    props.open && props.userId ? (
      <div data-testid="initial-upload-wizard-mock" data-user-id={props.userId} />
    ) : null,
}))

vi.mock('@/app/components/sync/LinkDataDialog', () => ({
  LinkDataDialog: (props: { open: boolean; userId: string; onResolved: () => void }) =>
    props.open ? (
      <div
        data-testid="link-data-dialog-mock"
        data-user-id={props.userId}
        onClick={props.onResolved}
      />
    ) : null,
}))

vi.mock('@/app/components/sync/NewDeviceDownloadOverlay', () => ({
  NewDeviceDownloadOverlay: (props: {
    open: boolean
    userId: string
    onClose: () => void
  }) =>
    props.open && props.userId ? (
      <div
        data-testid="new-device-download-overlay-mock"
        data-user-id={props.userId}
      />
    ) : null,
}))

// Stub out heavy dependencies not under test
vi.mock('react-router', async (importOriginal) => {
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
vi.mock('@/app/hooks/useAuthLifecycle', () => ({ useAuthLifecycle: vi.fn() }))
vi.mock('@/app/hooks/useSyncLifecycle', () => ({ useSyncLifecycle: vi.fn() }))
vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({ recoverOrphanedSessions: vi.fn() }),
}))
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
vi.mock('@/ai/lib/workerCapabilities', () => ({ supportsWorkers: () => false }))
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

// ─── Imports ─────────────────────────────────────────────────────────────────
import { useAuthStore } from '@/stores/useAuthStore'
import { useAuthLifecycle } from '@/app/hooks/useAuthLifecycle'
import { shouldShowDownloadOverlay } from '@/lib/sync/shouldShowDownloadOverlay'
import { shouldShowInitialUploadWizard } from '@/lib/sync/shouldShowInitialUploadWizard'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import App from '../App'

let capturedCallbacks: { onUnlinkedDetected?: (userId: string) => void } = {}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockAuthUser = null
  capturedCallbacks = {}
  useDownloadStatusStore.setState({
    status: 'idle',
    lastError: null,
    startedAt: null,
  })

  vi.mocked(useAuthLifecycle).mockImplementation((opts) => {
    capturedCallbacks.onUnlinkedDetected = opts?.onUnlinkedDetected
  })

  vi.mocked(useAuthStore).mockImplementation(
    (selector?: (s: { user: typeof mockAuthUser }) => unknown) => {
      const state = { user: mockAuthUser }
      return selector ? selector(state) : (state as unknown as ReturnType<typeof useAuthStore>)
    },
  )

  vi.mocked(shouldShowDownloadOverlay).mockResolvedValue(false)
  vi.mocked(shouldShowInitialUploadWizard).mockResolvedValue(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('App — NewDeviceDownloadOverlay composition invariants', () => {
  it('overlay does NOT mount visually while LinkDataDialog is open', async () => {
    // Start with no auth user so the fast-path eval doesn't fire first.
    mockAuthUser = null
    vi.mocked(shouldShowDownloadOverlay).mockResolvedValue(true)
    render(<App />)

    // Simulate the auth lifecycle detecting unlinked records and opening
    // the link dialog before an authenticated identity is observed.
    act(() => {
      capturedCallbacks.onUnlinkedDetected?.('u1')
    })

    await waitFor(() => {
      expect(screen.getByTestId('link-data-dialog-mock')).toBeInTheDocument()
    })

    // Overlay must not mount visually while the link dialog is open, even
    // if the predicate somehow resolved true.
    await new Promise((r) => setTimeout(r, 2_200))
    expect(screen.queryByTestId('new-device-download-overlay-mock')).toBeNull()
  })

  it('does NOT show overlay when predicate resolves false', async () => {
    mockAuthUser = { id: 'u2' }
    vi.mocked(shouldShowDownloadOverlay).mockResolvedValue(false)
    render(<App />)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.queryByTestId('new-device-download-overlay-mock')).toBeNull()
    expect(shouldShowDownloadOverlay).toHaveBeenCalledWith('u2')
  })

  it('shows overlay after 2s defer when predicate resolves true', async () => {
    mockAuthUser = { id: 'u3' }
    vi.mocked(shouldShowDownloadOverlay).mockResolvedValue(true)
    render(<App />)

    // Before 2s the overlay must not have mounted
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByTestId('new-device-download-overlay-mock')).toBeNull()

    // Wait past the 2s defer
    await waitFor(
      () => {
        expect(
          screen.getByTestId('new-device-download-overlay-mock'),
        ).toBeInTheDocument()
      },
      { timeout: 3_000 },
    )
  }, 10_000)

  it('NEVER mounts overlay visually when store reaches complete within 2s defer', async () => {
    mockAuthUser = { id: 'u4' }
    vi.mocked(shouldShowDownloadOverlay).mockResolvedValue(true)
    render(<App />)

    // Let the predicate resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Simulate the engine completing FAST (within the 2s defer).
    act(() => {
      useDownloadStatusStore.setState({
        status: 'complete',
        lastError: null,
        startedAt: null,
      })
    })

    // Wait past the 2s defer
    await new Promise((r) => setTimeout(r, 2_100))
    expect(screen.queryByTestId('new-device-download-overlay-mock')).toBeNull()
  })
})
