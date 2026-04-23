/**
 * Tests for LegalUpdateBanner re-ack mode — E119-S02 (AC-5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// Mock writeNoticeAck
const mockWriteNoticeAck = vi.fn()
vi.mock('@/lib/compliance/noticeAck', () => ({
  writeNoticeAck: (...args: unknown[]) => mockWriteNoticeAck(...args),
}))

vi.mock('@/lib/compliance/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2026-04-23.1',
  NOTICE_DOCUMENT_ID: 'privacy',
  parseNoticeVersion: (v: string) => {
    const m = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(v)
    if (!m) throw new Error('Invalid')
    return { isoDate: m[1], revision: parseInt(m[2]) }
  },
  formatNoticeEffectiveDate: () => 'Effective 2026-04-23 (rev 1)',
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import { LegalUpdateBanner } from '../LegalUpdateBanner'
import { toast } from 'sonner'

function renderBanner(props: Partial<Parameters<typeof LegalUpdateBanner>[0]> = {}) {
  return render(
    <MemoryRouter>
      <LegalUpdateBanner
        documentId="privacy"
        effectiveDate="Effective 2026-04-23 (rev 1)"
        documentName="Privacy Notice"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('LegalUpdateBanner — mode="info" (regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows banner when effectiveDate differs from localStorage', () => {
    renderBanner({ mode: 'info' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Privacy Notice/)).toBeInTheDocument()
  })

  it('does not show banner when effectiveDate matches localStorage', () => {
    localStorage.setItem(
      'knowlune-legal-effective-date-privacy',
      'Effective 2026-04-23 (rev 1)',
    )
    renderBanner({ mode: 'info' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismiss button hides the banner and stores effectiveDate', () => {
    renderBanner({ mode: 'info' })
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissBtn)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(localStorage.getItem('knowlune-legal-effective-date-privacy')).toBe(
      'Effective 2026-04-23 (rev 1)',
    )
  })
})

describe('LegalUpdateBanner — mode="reack"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders Acknowledge button in reack mode', () => {
    renderBanner({ mode: 'reack' })
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
  })

  it('renders View Privacy Notice link in reack mode', () => {
    renderBanner({ mode: 'reack' })
    expect(screen.getByRole('link', { name: /view privacy notice/i })).toBeInTheDocument()
  })

  it('does not render a dismiss button in reack mode', () => {
    renderBanner({ mode: 'reack' })
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it('clicking Acknowledge calls writeNoticeAck and onAcknowledged on success', async () => {
    mockWriteNoticeAck.mockResolvedValue(undefined)
    const onAcknowledged = vi.fn()
    renderBanner({ mode: 'reack', onAcknowledged })

    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }))

    await waitFor(() => {
      expect(mockWriteNoticeAck).toHaveBeenCalledWith('2026-04-23.1')
      expect(onAcknowledged).toHaveBeenCalled()
    })
  })

  it('hides banner after successful acknowledgement', async () => {
    mockWriteNoticeAck.mockResolvedValue(undefined)
    renderBanner({ mode: 'reack', onAcknowledged: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('error path: writeNoticeAck throws => toast.error shown, banner stays', async () => {
    mockWriteNoticeAck.mockRejectedValue(new Error('network error'))
    const onAcknowledged = vi.fn()
    renderBanner({ mode: 'reack', onAcknowledged })

    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not record your acknowledgement'),
      )
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onAcknowledged).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /acknowledge/i })).not.toBeDisabled()
    })
  })
})
