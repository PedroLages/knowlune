/**
 * E97-S03: App-level composition tests for the InitialUploadWizard / LinkDataDialog
 * ordering invariant.
 *
 * Verifies:
 *   1. InitialUploadWizard is NOT shown when LinkDataDialog is open (wizard
 *      deferred until onResolved).
 *   2. InitialUploadWizard IS shown after LinkDataDialog resolves (when local
 *      data exists).
 *   3. InitialUploadWizard is NOT shown when no local data exists (AC5 silent
 *      close — shouldShowInitialUploadWizard returns false).
 *
 * All routing, Dexie, and sync engine I/O is mocked. We render App directly
 * so we exercise the real state machine in App.tsx rather than only the child
 * components in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, waitFor } from '@testing-library/react'

// ─── Module mocks (must be hoisted before imports) ───────────────────────────

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn((selector?: (s: { user: { id: string } | null }) => unknown) => {
    const state = { user: mockAuthUser }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/lib/sync/shouldShowInitialUploadWizard', () => ({
  shouldShowInitialUploadWizard: vi.fn(),
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
        // Expose onResolved so tests can trigger resolution
        onClick={props.onResolved}
      />
    ) : null,
}))

// Stub out heavy dependencies not under test
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    RouterProvider: () => <div data-testid="router-stub" />,
  }
})

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/app/components/WelcomeWizard', () => ({
  WelcomeWizard: () => null,
}))

vi.mock('@/app/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/components/PWAUpdatePrompt', () => ({
  PWAUpdatePrompt: () => null,
}))

vi.mock('@/app/components/PWAInstallBanner', () => ({
  PWAInstallBanner: () => null,
}))

vi.mock('@/app/hooks/useAuthLifecycle', () => ({
  useAuthLifecycle: vi.fn(),
}))

vi.mock('@/app/hooks/useSyncLifecycle', () => ({
  useSyncLifecycle: vi.fn(),
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({ recoverOrphanedSessions: vi.fn() }),
}))

vi.mock('@/stores/useWelcomeWizardStore', () => ({
  useWelcomeWizardStore: () => ({ initialize: vi.fn() }),
}))

vi.mock('@/stores/useNotificationPrefsStore', () => ({
  useNotificationPrefsStore: {
    getState: () => ({ init: vi.fn() }),
  },
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
vi.mock('agentation', () => ({
  Agentation: () => null,
}))

// ─── Shared mutable state ─────────────────────────────────────────────────────

let mockAuthUser: { id: string } | null = null

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuthStore } from '@/stores/useAuthStore'
import { useAuthLifecycle } from '@/app/hooks/useAuthLifecycle'
import { shouldShowInitialUploadWizard } from '@/lib/sync/shouldShowInitialUploadWizard'
import App from '../App'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulate the useAuthLifecycle calling onUnlinkedDetected to open the
 * LinkDataDialog. The mock captures the callback in `capturedCallbacks`.
 */
let capturedCallbacks: { onUnlinkedDetected?: (userId: string) => void } = {}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockAuthUser = null
  capturedCallbacks = {}

  vi.mocked(useAuthLifecycle).mockImplementation((opts) => {
    capturedCallbacks.onUnlinkedDetected = opts?.onUnlinkedDetected
  })

  // Re-wire the useAuthStore mock each test because mockAuthUser is reassigned
  vi.mocked(useAuthStore).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((selector?: (s: unknown) => unknown) => {
      const state = { user: mockAuthUser, session: null, initialized: true, sessionExpired: false, _userInitiatedSignOut: false }
      return selector ? selector(state) : state
    }) as unknown as typeof useAuthStore,
  )
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App — InitialUploadWizard / LinkDataDialog composition invariant', () => {
  it('does NOT show the wizard when LinkDataDialog is open (wizard deferred until onResolved)', async () => {
    // The wizard must never co-appear with the LinkDataDialog. App.tsx renders
    // InitialUploadWizard with `open={uploadWizardUserId !== null && linkDialogUserId === null}`,
    // guaranteeing mutual exclusion even if shouldShowInitialUploadWizard resolves true
    // before the link dialog opens.
    vi.mocked(shouldShowInitialUploadWizard).mockResolvedValue(true)

    // Start with NO auth user so the fast-path evaluateWizard effect doesn't fire.
    // This isolates the test to the onUnlinkedDetected → LinkDataDialog path.
    mockAuthUser = null

    render(<App />)

    // Now trigger LinkDataDialog by simulating unlinked data detected
    act(() => {
      capturedCallbacks.onUnlinkedDetected?.('user-test-01')
    })

    // LinkDataDialog should be visible
    await waitFor(() => {
      expect(screen.getByTestId('link-data-dialog-mock')).toBeInTheDocument()
    })

    // Wizard must NOT be visible while link dialog is open — the open prop
    // evaluates to `uploadWizardUserId !== null && linkDialogUserId === null`
    // which is false while linkDialogUserId is set.
    expect(screen.queryByTestId('initial-upload-wizard-mock')).toBeNull()
  })

  it('shows the wizard AFTER LinkDataDialog resolves when local data exists', async () => {
    vi.mocked(shouldShowInitialUploadWizard).mockResolvedValue(true)
    mockAuthUser = { id: 'user-test-02' }

    render(<App />)

    // Open LinkDataDialog
    act(() => {
      capturedCallbacks.onUnlinkedDetected?.('user-test-02')
    })

    await waitFor(() => {
      expect(screen.getByTestId('link-data-dialog-mock')).toBeInTheDocument()
    })

    // Resolve LinkDataDialog (simulates user clicking "Link my data" or "Start fresh")
    act(() => {
      screen.getByTestId('link-data-dialog-mock').click()
    })

    // After resolution the wizard should appear
    await waitFor(() => {
      expect(screen.queryByTestId('link-data-dialog-mock')).toBeNull()
      expect(screen.getByTestId('initial-upload-wizard-mock')).toBeInTheDocument()
    })

    expect(shouldShowInitialUploadWizard).toHaveBeenCalledWith('user-test-02')
  })

  it('does NOT show the wizard when no local data exists (AC5 silent close)', async () => {
    // shouldShowInitialUploadWizard returns false — no pending work
    vi.mocked(shouldShowInitialUploadWizard).mockResolvedValue(false)
    mockAuthUser = { id: 'user-test-03' }

    render(<App />)

    // Wait long enough for the effect + async evaluation to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.queryByTestId('initial-upload-wizard-mock')).toBeNull()
    expect(screen.queryByTestId('link-data-dialog-mock')).toBeNull()
  })
})
