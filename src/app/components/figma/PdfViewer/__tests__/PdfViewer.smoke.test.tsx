import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PdfViewer } from '../PdfViewer'

describe('PdfViewer smoke', () => {
  it('sets the pdf.js worker source from the bundled worker module', async () => {
    // Import triggers pdfWorker.ts side-effect: pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    await import('../../../../../lib/pdfWorker')
    const { pdfjs } = await import('react-pdf')
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBeTruthy()
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toMatch(/pdf\.worker/i)
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
