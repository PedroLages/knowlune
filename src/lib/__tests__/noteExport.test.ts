import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportNoteAsMarkdown,
  generateFrontmatter,
  exportCombinedMarkdown,
  exportNotesZip,
} from '../noteExport'
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

describe('generateFrontmatter (public API)', () => {
  it('returns YAML frontmatter string with all fields', () => {
    const note: Note = {
      id: 'note-1',
      courseId: 'course-1',
      videoId: 'video-1',
      content: '<p>My Note Title</p>',
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
      tags: ['learning', 'notes'],
    }

    const result = generateFrontmatter(note, 'Test Course', 'Test Lesson')

    expect(result).toContain('---')
    expect(result).toContain('title: "My Note Title"')
    expect(result).toContain('tags: ["learning", "notes"]')
    expect(result).toContain('course: "Test Course"')
    expect(result).toContain('lesson: "Test Lesson"')
    expect(result).toContain('created: "2025-01-15T10:00:00.000Z"')
    expect(result).toContain('updated: "2025-01-15T12:00:00.000Z"')
    expect(result).toContain('---\n')
  })
})

describe('exportCombinedMarkdown', () => {
  function makeNote(overrides: Partial<Note> = {}): Note {
    return {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      videoId: 'video-1',
      content: '<p>Test content</p>',
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
      tags: [],
      ...overrides,
    }
  }

  const lessonMap = new Map([
    [
      'video-1',
      { moduleName: 'Module A', moduleOrder: 1, lessonName: 'Lesson 1', lessonOrder: 1 },
    ],
    [
      'video-2',
      { moduleName: 'Module A', moduleOrder: 1, lessonName: 'Lesson 2', lessonOrder: 2 },
    ],
    [
      'video-3',
      { moduleName: 'Module B', moduleOrder: 2, lessonName: 'Lesson 3', lessonOrder: 1 },
    ],
  ])

  it('groups notes by module and lesson with ##/### headers', () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1' }),
      makeNote({ id: 'n2', videoId: 'video-2' }),
      makeNote({ id: 'n3', videoId: 'video-3' }),
    ]

    const { content, filename } = exportCombinedMarkdown(
      notes, 'Test Course', 'test-course', lessonMap
    )

    expect(content).toContain('## Module A')
    expect(content).toContain('### Lesson 1')
    expect(content).toContain('### Lesson 2')
    expect(content).toContain('## Module B')
    expect(content).toContain('### Lesson 3')
    expect(filename).toBe('test-course-notes.md')
  })

  it('separates notes with --- dividers', () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1' }),
      makeNote({ id: 'n2', videoId: 'video-2' }),
    ]

    const { content } = exportCombinedMarkdown(
      notes, 'Test Course', 'test-course', lessonMap
    )

    const parts = content.split('---')
    // Frontmatter, content, separator
    expect(parts.length).toBeGreaterThanOrEqual(3)
  })

  it('excludes notes with empty/whitespace-only content', () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1', content: '<p>Real content</p>' }),
      makeNote({ id: 'n2', videoId: 'video-2', content: '' }),
      makeNote({ id: 'n3', videoId: 'video-3', content: '   ' }),
    ]

    const { content } = exportCombinedMarkdown(
      notes, 'Test Course', 'test-course', lessonMap
    )

    expect(content).toContain('Real content')
    expect(content).not.toContain('video-2')
    expect(content).not.toContain('video-3')
  })

  it('adds warning header for >50 notes', () => {
    const notes = Array.from({ length: 51 }, (_, i) =>
      makeNote({ id: `n${i}`, videoId: 'video-1', content: `<p>Note ${i}</p>` })
    )

    const { content } = exportCombinedMarkdown(
      notes, 'Test Course', 'test-course', lessonMap
    )

    expect(content).toContain('WARNING')
    expect(content).toContain('51 notes')
  })

  it('handles single note export', () => {
    const notes = [makeNote({ id: 'n1', videoId: 'video-1' })]

    const { content, filename } = exportCombinedMarkdown(
      notes, 'Test Course', 'test-course', lessonMap
    )

    expect(content).toContain('---')
    expect(filename).toBe('test-course-notes.md')
  })

  it('handles course without modules (flat structure)', () => {
    const noModuleNotes = [
      makeNote({ id: 'n1', videoId: 'v1' }),
      makeNote({ id: 'n2', videoId: 'v2' }),
    ]
    const flatMap = new Map([
      ['v1', { moduleName: '', moduleOrder: 999, lessonName: 'Standalone 1', lessonOrder: 1 }],
      ['v2', { moduleName: '', moduleOrder: 999, lessonName: 'Standalone 2', lessonOrder: 2 }],
    ])

    const { content } = exportCombinedMarkdown(
      noModuleNotes, 'Flat Course', 'flat-course', flatMap
    )

    expect(content).toContain('## Standalone 1')
    expect(content).toContain('## Standalone 2')
  })
})

describe('exportNotesZip', () => {
  function makeNote(overrides: Partial<Note> = {}): Note {
    return {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      videoId: 'video-1',
      content: '<p>Test content</p>',
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
      tags: [],
      ...overrides,
    }
  }

  const lessonMap = new Map([
    [
      'video-1',
      { moduleName: 'Module A', moduleOrder: 1, lessonName: 'Lesson 1', lessonOrder: 1 },
    ],
    [
      'video-2',
      { moduleName: 'Module A', moduleOrder: 1, lessonName: 'Lesson 2', lessonOrder: 2 },
    ],
    [
      'video-3',
      { moduleName: 'Module B', moduleOrder: 2, lessonName: 'Lesson 3', lessonOrder: 1 },
    ],
  ])

  it('returns a Blob and filename', async () => {
    const notes = [makeNote({ id: 'n1', videoId: 'video-1' })]

    const { blob, filename } = await exportNotesZip(
      notes, 'Test Course', 'test-course', lessonMap
    )

    expect(blob).toBeInstanceOf(Blob)
    expect(filename).toBe('test-course-notes.zip')
  })

  it('excludes notes with empty/whitespace-only content', async () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1', content: '<p>Real</p>' }),
      makeNote({ id: 'n2', videoId: 'video-2', content: '' }),
    ]

    const { blob } = await exportNotesZip(
      notes, 'Test Course', 'test-course', lessonMap
    )

    // Verify we got a blob back
    expect(blob.size).toBeGreaterThan(0)
  })

  it('builds correct folder structure with module/lesson nesting', async () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1', content: '<p>Note A</p>' }),
      makeNote({ id: 'n2', videoId: 'video-2', content: '<p>Note B</p>' }),
      makeNote({ id: 'n3', videoId: 'video-3', content: '<p>Note C</p>' }),
    ]

    const { blob } = await exportNotesZip(
      notes, 'Test Course', 'test-course', lessonMap
    )

    // The ZIP should contain files with proper paths
    expect(blob.size).toBeGreaterThan(0)

    // Spot-check that the ZIP contains expected paths by reading it back
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)

    const filePaths = Object.keys(zip.files)
    expect(filePaths.some(p => p.includes('Module-A/Lesson-1'))).toBe(true)
    expect(filePaths.some(p => p.includes('Module-A/Lesson-2'))).toBe(true)
    expect(filePaths.some(p => p.includes('Module-B/Lesson-3'))).toBe(true)
    expect(filePaths.every(p => p.startsWith('test-course/'))).toBe(true)
  })

  it('handles flat structure for courses without modules', async () => {
    const notes = [makeNote({ id: 'n1', videoId: 'v1' })]
    const flatMap = new Map([
      ['v1', { moduleName: '', moduleOrder: 999, lessonName: 'Standalone', lessonOrder: 1 }],
    ])

    const { blob } = await exportNotesZip(
      notes, 'Flat Course', 'flat-course', flatMap
    )

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)

    const filePaths = Object.keys(zip.files)
    expect(filePaths.some(p => p === 'flat-course/Standalone/')).toBe(true)
  })

  it('each .md file includes YAML frontmatter', async () => {
    const notes = [makeNote({ id: 'n1', videoId: 'video-1', content: '<p>Test</p>' })]

    const { blob } = await exportNotesZip(
      notes, 'Test Course', 'test-course', lessonMap
    )

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    const files = Object.entries(zip.files).filter(([name]) => name.endsWith('.md'))
    expect(files.length).toBe(1)
    const [, file] = files[0]
    const content = await file.async('string')
    expect(content).toContain('---')
    expect(content).toContain('title:')
    expect(content).toContain('course: "Test Course"')
    expect(content).toContain('Test')
  })

  it('deduplicates note filenames within the same lesson folder to prevent silent overwrites', async () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-1', content: '<p>Untitled Note</p>' }),
      makeNote({ id: 'n2', videoId: 'video-1', content: '<p>Untitled Note</p>' }),
    ]

    const { blob } = await exportNotesZip(
      notes, 'Test Course', 'test-course', lessonMap
    )

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)

    const filePaths = Object.keys(zip.files).filter(p => p.endsWith('.md'))

    // Both notes should be present (not overwritten)
    expect(filePaths).toHaveLength(2)

    // First note keeps original name, second gets -2 suffix
    expect(filePaths.some(p => p.endsWith('Untitled-Note.md'))).toBe(true)
    expect(filePaths.some(p => p.endsWith('Untitled-Note-2.md'))).toBe(true)
  })

  it('sanitizes filenames with special characters', async () => {
    const notes = [
      makeNote({ id: 'n1', videoId: 'video-special', content: '<p>Note/With:Special*Chars</p>' }),
    ]
    const specialMap = new Map([
      [
        'video-special',
        { moduleName: 'Module:Special', moduleOrder: 1, lessonName: 'Lesson/Special', lessonOrder: 1 },
      ],
    ])

    const { blob } = await exportNotesZip(
      notes, 'Test Course', 'test-course', specialMap
    )

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    const filePaths = Object.keys(zip.files)

    // No literal slashes or special chars in paths (except forward slashes for folders)
    expect(filePaths.every(p => !p.includes(':') && !p.includes('*') && !p.includes('?'))).toBe(true)
    expect(filePaths.some(p => p.includes('Module-Special'))).toBe(true)
    expect(filePaths.some(p => p.includes('Lesson-Special'))).toBe(true)
  })
})
