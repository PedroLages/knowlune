import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportProgressOverlay } from '@/app/components/figma/ImportProgressOverlay'
import { useImportProgressStore } from '@/stores/useImportProgressStore'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

beforeEach(() => {
  useImportProgressStore.getState().reset()
})

describe('ImportProgressOverlay scan progress', () => {
  it('shows a discovered-file count while the scan total is unknown', () => {
    useImportProgressStore.getState().startImport('course-1', 'Server Course')
    useImportProgressStore.getState().updateScanProgress('course-1', 12, null)

    render(<ImportProgressOverlay />)

    expect(screen.getByText('Scanning folder… 12 files found')).toBeInTheDocument()
    expect(screen.queryByText(/12 of .* files processed/)).not.toBeInTheDocument()
  })

  it('never renders a percentage above 100%', () => {
    useImportProgressStore.getState().startImport('course-1', 'Server Course')
    useImportProgressStore.getState().updateProcessingProgress('course-1', 124, 59)

    render(<ImportProgressOverlay />)

    expect(screen.getByText('124 of 59 files processed (100%)')).toBeInTheDocument()
    expect(screen.queryByText(/\(2\d\d%\)/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Import progress for Server Course' })
    ).toHaveAttribute('aria-valuenow', '100')
  })
})
