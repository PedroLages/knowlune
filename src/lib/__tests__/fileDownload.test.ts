import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadJson, downloadText, downloadBlob } from '../fileDownload'

describe('fileDownload', () => {
  let mockClick: ReturnType<typeof vi.fn>
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockClick = vi.fn()
    mockCreateObjectURL = vi.fn(() => 'blob:test-url')
    mockRevokeObjectURL = vi.fn()

    // Mock URL methods
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL

    // Mock createElement to return a clickable element
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

  describe('downloadJson', () => {
    it('creates a blob from JSON data and triggers download', () => {
      const data = { key: 'value' }
      downloadJson(data, 'test.json')

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    })
  })

  describe('downloadText', () => {
    it('creates a blob from text and triggers download', () => {
      downloadText('hello world', 'test.txt')

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    })
  })

  describe('downloadBlob', () => {
    it('creates object URL and clicks anchor', () => {
      const blob = new Blob(['data'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
      expect(mockClick).toHaveBeenCalled()
      expect(document.body.appendChild).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalled()
    })

    it('revokes object URL after delay', () => {
      const blob = new Blob(['data'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()

      vi.advanceTimersByTime(10_000)

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    })
  })
})
