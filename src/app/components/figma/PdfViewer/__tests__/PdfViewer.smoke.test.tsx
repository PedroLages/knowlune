import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PdfViewer } from '../PdfViewer'

describe('PdfViewer smoke', () => {
  it('sets the pdf.js worker source from the bundled worker module', async () => {
    await import('@/lib/pdfWorker')
    const { pdfjs } = await import('react-pdf')
    // react-pdf 10.4.1 bundles pdfjs-dist 5.4.296 — top-level pin must match
    expect(pdfjs.version).toBe('5.4.296')
    // Must be a local bundled asset (starts with /), not pdfjs-dist's CDN fallback
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toMatch(/^\/.*pdf\.worker.*\.mjs/)
  })

  it('shows the error fallback when PDF fails to load', async () => {
    // Use an obviously invalid blob URL — react-pdf will fire onDocumentLoadError
    render(<PdfViewer src="blob:invalid-url" title="Test PDF" />)

    await waitFor(() => {
      expect(screen.getByText(/unable to preview this document inline/i)).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /open in new tab/i })
    ).toBeInTheDocument()
  })
})
