import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the three sub-exporters before importing
const mockExportNotesAsMarkdown = vi.fn().mockResolvedValue([])
const mockExportFlashcardsAsMarkdown = vi.fn().mockResolvedValue([])
const mockExportBookmarksAsMarkdown = vi.fn().mockResolvedValue([])

vi.mock('../exportService', () => ({
  exportNotesAsMarkdown: mockExportNotesAsMarkdown,
}))

vi.mock('../flashcardExport', () => ({
  exportFlashcardsAsMarkdown: mockExportFlashcardsAsMarkdown,
}))

vi.mock('../bookmarkExport', () => ({
  exportBookmarksAsMarkdown: mockExportBookmarksAsMarkdown,
}))

const { exportPkmBundle } = await import('../pkmExport')

describe('pkmExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportNotesAsMarkdown.mockResolvedValue([])
    mockExportFlashcardsAsMarkdown.mockResolvedValue([])
    mockExportBookmarksAsMarkdown.mockResolvedValue([])
  })

  it('returns empty array when no data exists across all sources', async () => {
    const result = await exportPkmBundle()
    expect(result).toEqual([])
  })

  it('does not include README.md when no data exists', async () => {
    const result = await exportPkmBundle()
    const readmeFile = result.find(f => f.name === 'README.md')
    expect(readmeFile).toBeUndefined()
  })

  it('prefixes note files with notes/ folder', async () => {
    mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'my-note.md', content: '# Note' }])

    const result = await exportPkmBundle()
    const noteFile = result.find(f => f.name === 'notes/my-note.md')
    expect(noteFile).toBeDefined()
    expect(noteFile!.content).toBe('# Note')
  })

  it('preserves flashcard folder paths (already prefixed)', async () => {
    mockExportFlashcardsAsMarkdown.mockResolvedValue([
      { name: 'flashcards/React/what-is-react.md', content: '# Q' },
    ])

    const result = await exportPkmBundle()
    const fcFile = result.find(f => f.name === 'flashcards/React/what-is-react.md')
    expect(fcFile).toBeDefined()
  })

  it('preserves bookmark folder paths (already prefixed)', async () => {
    mockExportBookmarksAsMarkdown.mockResolvedValue([
      { name: 'bookmarks/Course/bookmarks.md', content: '# Bookmarks' },
    ])

    const result = await exportPkmBundle()
    const bmFile = result.find(f => f.name === 'bookmarks/Course/bookmarks.md')
    expect(bmFile).toBeDefined()
  })

  it('produces correct folder structure with all three sources', async () => {
    mockExportNotesAsMarkdown.mockResolvedValue([
      { name: 'note-1.md', content: '# N1' },
      { name: 'note-2.md', content: '# N2' },
    ])
    mockExportFlashcardsAsMarkdown.mockResolvedValue([
      { name: 'flashcards/Course/fc.md', content: '# FC' },
    ])
    mockExportBookmarksAsMarkdown.mockResolvedValue([
      { name: 'bookmarks/Course/bookmarks.md', content: '# BM' },
    ])

    const result = await exportPkmBundle()

    // notes/ folder files
    expect(result.find(f => f.name === 'notes/note-1.md')).toBeDefined()
    expect(result.find(f => f.name === 'notes/note-2.md')).toBeDefined()
    // flashcards/ folder
    expect(result.find(f => f.name === 'flashcards/Course/fc.md')).toBeDefined()
    // bookmarks/ folder
    expect(result.find(f => f.name === 'bookmarks/Course/bookmarks.md')).toBeDefined()
    // README at root
    expect(result.find(f => f.name === 'README.md')).toBeDefined()
  })

  it('includes README.md in ZIP when data exists', async () => {
    mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'note.md', content: '# Note' }])

    const result = await exportPkmBundle()
    const readme = result.find(f => f.name === 'README.md')
    expect(readme).toBeDefined()
    expect(readme!.content).toContain('# Knowlune PKM Export')
    expect(readme!.content).toContain('notes/')
    expect(readme!.content).toContain('flashcards/')
    expect(readme!.content).toContain('bookmarks/')
  })

  it('README reports correct file counts', async () => {
    mockExportNotesAsMarkdown.mockResolvedValue([
      { name: 'n1.md', content: '' },
      { name: 'n2.md', content: '' },
      { name: 'n3.md', content: '' },
    ])
    mockExportFlashcardsAsMarkdown.mockResolvedValue([
      { name: 'flashcards/C/fc1.md', content: '' },
      { name: 'flashcards/C/fc2.md', content: '' },
    ])
    mockExportBookmarksAsMarkdown.mockResolvedValue([{ name: 'bookmarks/C/bm.md', content: '' }])

    const result = await exportPkmBundle()
    const readme = result.find(f => f.name === 'README.md')!

    expect(readme.content).toContain('| notes/ | 3 |')
    expect(readme.content).toContain('| flashcards/ | 2 |')
    expect(readme.content).toContain('| bookmarks/ | 1 |')
    expect(readme.content).toContain('| **Total** | **6** |')
  })

  it('reports total file count correctly (data files + README)', async () => {
    mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'n1.md', content: '' }])
    mockExportFlashcardsAsMarkdown.mockResolvedValue([{ name: 'flashcards/C/fc.md', content: '' }])
    mockExportBookmarksAsMarkdown.mockResolvedValue([])

    const result = await exportPkmBundle()
    // 2 data files + 1 README
    expect(result).toHaveLength(3)
  })

  describe('partial export resilience (C4 hotfix)', () => {
    it('continues exporting when notes sub-exporter fails', async () => {
      mockExportNotesAsMarkdown.mockRejectedValue(new Error('Notes DB corrupted'))
      mockExportFlashcardsAsMarkdown.mockResolvedValue([
        { name: 'flashcards/C/fc.md', content: '# FC' },
      ])
      mockExportBookmarksAsMarkdown.mockResolvedValue([
        { name: 'bookmarks/C/bm.md', content: '# BM' },
      ])

      const result = await exportPkmBundle()

      // Should still have flashcard and bookmark files + README
      expect(result.find(f => f.name === 'flashcards/C/fc.md')).toBeDefined()
      expect(result.find(f => f.name === 'bookmarks/C/bm.md')).toBeDefined()
      expect(result.find(f => f.name === 'README.md')).toBeDefined()
      // No note files
      expect(result.find(f => f.name.startsWith('notes/'))).toBeUndefined()
    })

    it('continues exporting when flashcards sub-exporter fails', async () => {
      mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'note.md', content: '# Note' }])
      mockExportFlashcardsAsMarkdown.mockRejectedValue(new Error('Flashcard error'))
      mockExportBookmarksAsMarkdown.mockResolvedValue([
        { name: 'bookmarks/C/bm.md', content: '# BM' },
      ])

      const result = await exportPkmBundle()

      expect(result.find(f => f.name === 'notes/note.md')).toBeDefined()
      expect(result.find(f => f.name === 'bookmarks/C/bm.md')).toBeDefined()
      expect(result.find(f => f.name.startsWith('flashcards/'))).toBeUndefined()
    })

    it('continues exporting when bookmarks sub-exporter fails', async () => {
      mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'note.md', content: '# Note' }])
      mockExportFlashcardsAsMarkdown.mockResolvedValue([
        { name: 'flashcards/C/fc.md', content: '# FC' },
      ])
      mockExportBookmarksAsMarkdown.mockRejectedValue(new Error('Bookmark error'))

      const result = await exportPkmBundle()

      expect(result.find(f => f.name === 'notes/note.md')).toBeDefined()
      expect(result.find(f => f.name === 'flashcards/C/fc.md')).toBeDefined()
      expect(result.find(f => f.name.startsWith('bookmarks/'))).toBeUndefined()
    })

    it('includes error warnings in README when sub-exporter fails', async () => {
      mockExportNotesAsMarkdown.mockRejectedValue(new Error('Notes DB corrupted'))
      mockExportFlashcardsAsMarkdown.mockResolvedValue([
        { name: 'flashcards/C/fc.md', content: '# FC' },
      ])
      mockExportBookmarksAsMarkdown.mockResolvedValue([])

      const result = await exportPkmBundle()
      const readme = result.find(f => f.name === 'README.md')

      expect(readme).toBeDefined()
      expect(readme!.content).toContain('Export Warnings')
      expect(readme!.content).toContain('Notes export failed')
    })

    it('returns empty array when all sub-exporters fail', async () => {
      mockExportNotesAsMarkdown.mockRejectedValue(new Error('fail'))
      mockExportFlashcardsAsMarkdown.mockRejectedValue(new Error('fail'))
      mockExportBookmarksAsMarkdown.mockRejectedValue(new Error('fail'))

      const result = await exportPkmBundle()
      expect(result).toEqual([])
    })
  })

  describe('progress callback', () => {
    it('fires progress callback with weighted values', async () => {
      mockExportNotesAsMarkdown.mockResolvedValue([])
      mockExportFlashcardsAsMarkdown.mockResolvedValue([])
      mockExportBookmarksAsMarkdown.mockResolvedValue([])

      const onProgress = vi.fn()
      await exportPkmBundle(onProgress)

      // Should start at 0
      expect(onProgress).toHaveBeenCalledWith(0, 'Exporting notes...')
      // Phase transitions at weighted boundaries
      expect(onProgress).toHaveBeenCalledWith(40, 'Exporting flashcards...')
      expect(onProgress).toHaveBeenCalledWith(80, 'Exporting bookmarks...')
      // Ends at 100
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
    })

    it('passes weighted sub-progress to notes exporter (0-40%)', async () => {
      mockExportNotesAsMarkdown.mockImplementation(async cb => {
        // Simulate sub-exporter reporting 50% progress
        cb?.(50, 'Processing notes...')
        return [{ name: 'n.md', content: '' }]
      })

      const onProgress = vi.fn()
      await exportPkmBundle(onProgress)

      // 50% of notes phase (40% weight) = 20%
      expect(onProgress).toHaveBeenCalledWith(20, 'Processing notes...')
    })

    it('passes weighted sub-progress to flashcards exporter (40-80%)', async () => {
      mockExportFlashcardsAsMarkdown.mockImplementation(async cb => {
        cb?.(50, 'Processing flashcards...')
        return [{ name: 'flashcards/C/fc.md', content: '' }]
      })

      const onProgress = vi.fn()
      await exportPkmBundle(onProgress)

      // 40 + (50% of 40% weight) = 40 + 20 = 60
      expect(onProgress).toHaveBeenCalledWith(60, 'Processing flashcards...')
    })

    it('passes weighted sub-progress to bookmarks exporter (80-100%)', async () => {
      mockExportBookmarksAsMarkdown.mockImplementation(async cb => {
        cb?.(50, 'Processing bookmarks...')
        return [{ name: 'bookmarks/C/bm.md', content: '' }]
      })

      const onProgress = vi.fn()
      await exportPkmBundle(onProgress)

      // 80 + (50% of 20% weight) = 80 + 10 = 90
      expect(onProgress).toHaveBeenCalledWith(90, 'Processing bookmarks...')
    })

    it('works without progress callback (no errors)', async () => {
      mockExportNotesAsMarkdown.mockResolvedValue([{ name: 'n.md', content: '' }])

      await expect(exportPkmBundle()).resolves.toBeDefined()
    })
  })
})
