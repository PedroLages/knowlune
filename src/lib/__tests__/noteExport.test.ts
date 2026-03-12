import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportNoteAsMarkdown } from '../noteExport'
import type { Note } from '@/data/types'

describe('noteExport', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let mockLink: {
    href: string
    download: string
    click: ReturnType<typeof vi.fn>
  }
  let capturedBlobContent: string | null = null
  let originalBlob: typeof Blob

  beforeEach(() => {
    capturedBlobContent = null

    // Mock DOM APIs
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    }

    createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockLink as unknown as HTMLElement
      }
      // For DOMParser usage (div elements)
      return document.createElement(tagName)
    })

    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL')
    createObjectURLSpy.mockReturnValue('blob:mock-url')

    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')
    revokeObjectURLSpy.mockImplementation(() => {})

    // Mock Blob to capture content
    originalBlob = global.Blob
    global.Blob = class MockBlob extends originalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options)
        // Capture content for testing
        if (Array.isArray(parts) && typeof parts[0] === 'string') {
          capturedBlobContent = parts[0]
        }
      }
    } as typeof Blob

    // Mock appendChild/removeChild
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node)
  })

  afterEach(() => {
    global.Blob = originalBlob
    vi.restoreAllMocks()
  })

  describe('HTML to Markdown conversion', () => {
    it('converts headings correctly', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<h1>Main Heading</h1><h2>Subheading</h2><p>Paragraph text</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(capturedBlobContent).toBeDefined()
      expect(capturedBlobContent).toContain('# Main Heading')
      expect(capturedBlobContent).toContain('## Subheading')
      expect(capturedBlobContent).toContain('Paragraph text')
    })

    it('converts lists correctly', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<ul><li>Item 1</li><li>Item 2</li></ul>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      // Turndown may add extra spaces, so use regex to match
      expect(capturedBlobContent).toMatch(/\*\s+Item 1/)
      expect(capturedBlobContent).toMatch(/\*\s+Item 2/)
    })

    it('converts bold and italic correctly', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p><strong>Bold text</strong> and <em>italic text</em></p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(capturedBlobContent).toContain('**Bold text**')
      expect(capturedBlobContent).toContain('_italic text_')
    })

    it('strips TipTap attributes', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content:
          '<div data-frame-capture="true" contenteditable="true" data-custom="value">Content</div>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      // Attributes should not appear in markdown
      expect(capturedBlobContent).not.toContain('data-frame-capture')
      expect(capturedBlobContent).not.toContain('contenteditable')
      expect(capturedBlobContent).not.toContain('data-custom')
      expect(capturedBlobContent).toContain('Content')
    })
  })

  describe('filename sanitization', () => {
    it('replaces slashes with hyphens', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>My/Note:Test</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(mockLink.download).toBe('My-Note-Test.md')
    })

    it('replaces special characters with hyphens', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>File*Name?With|Invalid:Chars</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(mockLink.download).toBe('File-Name-With-Invalid-Chars.md')
    })

    it('collapses multiple spaces/hyphens', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Multiple   Spaces   Here</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(mockLink.download).toBe('Multiple-Spaces-Here.md')
    })

    it('uses fallback for empty content', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(mockLink.download).toBe('note.md')
    })

    it('limits filename length', () => {
      const longTitle = 'A'.repeat(100)
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: `<p>${longTitle}</p>`,
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      // Should be truncated to 50 chars + .md extension
      expect(mockLink.download.length).toBeLessThanOrEqual(53)
    })
  })

  describe('YAML frontmatter', () => {
    it('includes all required fields', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Note content</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
        tags: ['tag1', 'tag2'],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(capturedBlobContent).toContain('---')
      expect(capturedBlobContent).toContain('title: "Note content"')
      expect(capturedBlobContent).toContain('tags: ["tag1", "tag2"]')
      expect(capturedBlobContent).toContain('course: "Test Course"')
      expect(capturedBlobContent).toContain('lesson: "Test Lesson"')
      expect(capturedBlobContent).toContain('created: "2025-01-15T10:00:00.000Z"')
      expect(capturedBlobContent).toContain('updated: "2025-01-15T12:00:00.000Z"')
    })

    it('handles empty tags array', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Note content</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(capturedBlobContent).toContain('tags: []')
    })

    it('escapes quotes in strings', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Note with "quotes"</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Course "Advanced"', 'Lesson "1"')

      expect(capturedBlobContent).toContain('title: "Note with \\"quotes\\""')
      expect(capturedBlobContent).toContain('course: "Course \\"Advanced\\""')
      expect(capturedBlobContent).toContain('lesson: "Lesson \\"1\\""')
    })
  })

  describe('browser download', () => {
    it('triggers download with correct filename', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Test Note</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(mockLink.download).toBe('Test-Note.md')
      expect(mockLink.click).toHaveBeenCalledTimes(1)
    })

    it('creates and revokes object URL', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Test Note</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
      expect(mockLink.href).toBe('blob:mock-url')
    })

    it('creates markdown file with frontmatter and content', () => {
      const note: Note = {
        id: 'note-1',
        courseId: 'course-1',
        videoId: 'video-1',
        content: '<p>Test Note</p>',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
        tags: [],
      }

      exportNoteAsMarkdown(note, 'Test Course', 'Test Lesson')

      expect(capturedBlobContent).toBeDefined()
      expect(capturedBlobContent).toContain('---')
      expect(capturedBlobContent).toContain('Test Note')
    })
  })
})
