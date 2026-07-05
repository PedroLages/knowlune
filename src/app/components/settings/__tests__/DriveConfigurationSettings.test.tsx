import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DriveConfigurationSettings } from '@/app/components/settings/DriveConfigurationSettings'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Hoisted mutable state for mock factories
// ---------------------------------------------------------------------------

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    user: null as Record<string, unknown> | null,
    session: null as Record<string, unknown> | null,
    signOut: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHasDriveReadScope = vi.fn()
const mockRequestDriveReadScope = vi.fn()

vi.mock('@/lib/googleDriveToken', () => ({
  hasDriveReadScope: (...args: unknown[]) => mockHasDriveReadScope(...args),
  requestDriveReadScope: (...args: unknown[]) => mockRequestDriveReadScope(...args),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mockAuthState as unknown as Record<string, unknown>),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthState.user = null
  mockAuthState.session = null
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DriveConfigurationSettings', () => {
  it('renders the card with title and description', () => {
    render(<DriveConfigurationSettings />)

    expect(screen.getByText('Google Drive')).toBeInTheDocument()
    expect(screen.getByText(/Manage your Google Drive connection/)).toBeInTheDocument()
  })

  it('shows "Not connected" when no provider token', () => {
    render(<DriveConfigurationSettings />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeDisabled()
  })

  it('shows connected Google email when session has provider_token and user has Google identity', async () => {
    mockAuthState.user = {
      email: 'test@example.com',
      identities: [{ provider: 'google', identity_data: { email: 'google-user@gmail.com' } }],
    }
    mockAuthState.session = { provider_token: 'google-token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)

    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByText('google-user@gmail.com')).toBeInTheDocument()
    })

    expect(screen.getByText('Google account connected')).toBeInTheDocument()
  })

  it('shows disconnect button when Drive is connected', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)

    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })
  })

  it('disconnect button is disabled when no Drive token exists', () => {
    render(<DriveConfigurationSettings />)

    expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeDisabled()
  })

  it('opens disconnect confirmation dialog when Disconnect is clicked', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Disconnect Google Drive/i }))

    expect(screen.getByText('Disconnect Google Drive?')).toBeInTheDocument()
    expect(screen.getByText(/This will sign you out of your current session/)).toBeInTheDocument()
  })

  it('closes disconnect dialog when Cancel is clicked', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Disconnect Google Drive/i }))
    expect(screen.getByText('Disconnect Google Drive?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByText('Disconnect Google Drive?')).not.toBeInTheDocument()
  })

  it('calls signOut and shows success toast on disconnect confirm', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)
    mockAuthState.signOut.mockResolvedValue({})

    const user = userEvent.setup()
    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Disconnect Google Drive/i }))
    await user.click(screen.getByRole('button', { name: /Disconnect/i }))

    await waitFor(() => {
      expect(mockAuthState.signOut).toHaveBeenCalledTimes(1)
    })

    expect(toast.success).toHaveBeenCalledWith('Google Drive disconnected')
  })

  it('shows error toast when signOut fails with an error', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)
    mockAuthState.signOut.mockResolvedValue({ error: 'Sign out failed' })

    const user = userEvent.setup()
    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Disconnect Google Drive/i }))
    await user.click(screen.getByRole('button', { name: /Disconnect/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to disconnect Drive')
      )
    })
  })

  it('shows error toast when signOut throws', async () => {
    mockAuthState.user = { email: 'test@example.com', identities: [] }
    mockAuthState.session = { provider_token: 'token-123' }
    mockHasDriveReadScope.mockResolvedValue(true)
    mockAuthState.signOut.mockRejectedValue(new Error('Network error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<DriveConfigurationSettings />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect Google Drive/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Disconnect Google Drive/i }))
    await user.click(screen.getByRole('button', { name: /Disconnect/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to disconnect Drive')
    })

    consoleSpy.mockRestore()
  })
})
