import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadAsFile } from '../download'

describe('downloadAsFile', () => {
  let mockClick: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockClick = vi.fn()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    globalThis.URL.revokeObjectURL = vi.fn()

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      style: {},
    } as unknown as HTMLAnchorElement)

    vi.spyOn(document.body, 'appendChild').mockImplementation(
      (node) => node as HTMLAnchorElement
    )
    vi.spyOn(document.body, 'removeChild').mockImplementation(
      (node) => node as HTMLAnchorElement
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('creates a blob with correct MIME type and triggers download', () => {
    downloadAsFile('content', 'file.csv', 'text/csv')

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(document.body.appendChild).toHaveBeenCalled()
  })

  it('cleans up after a short delay', () => {
    downloadAsFile('content', 'file.csv', 'text/csv')

    expect(document.body.removeChild).not.toHaveBeenCalled()
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(document.body.removeChild).toHaveBeenCalled()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
  })
})
