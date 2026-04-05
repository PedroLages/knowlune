/**
 * PKM (Personal Knowledge Management) batch export orchestrator.
 *
 * Combines notes, flashcards, bookmarks, and book highlights into a single
 * ZIP-ready file array with folder structure compatible with Obsidian and
 * other PKM tools:
 *   notes/                — Individual note Markdown files
 *   flashcards/           — Flashcard Markdown files grouped by course
 *   bookmarks/            — Bookmark Markdown files grouped by course
 *   book-highlights/      — One Markdown file per book with highlights
 *   README.md             — Export metadata with file counts and folder docs
 */
import type { ExportProgressCallback } from './exportService'
import { exportNotesAsMarkdown } from './exportService'
import { exportFlashcardsAsMarkdown } from './flashcardExport'
import { exportBookmarksAsMarkdown } from './bookmarkExport'
import { exportHighlightsAsObsidian } from './highlightExport'

/** Options for PKM bundle export */
export interface PkmExportOptions {
  /** Include book highlights in the bundle (default: true) */
  includeHighlights?: boolean
}

/** Summary counts returned alongside PKM bundle files */
export interface PkmExportSummary {
  files: Array<{ name: string; content: string }>
  /** "Exported {n} highlights from {m} books" — empty string if no highlights */
  highlightSummary: string
}

/**
 * Exports a complete PKM bundle combining notes, flashcards, bookmarks, and
 * book highlights (optional).
 *
 * Progress is weighted: notes 30%, flashcards 30%, bookmarks 20%, highlights 20%.
 * Returns an empty file array if no data exists across all sources.
 *
 * @param onProgress - Optional callback for weighted progress updates
 * @param options - Export options (e.g. includeHighlights)
 * @returns PkmExportSummary with files array and highlight count string
 */
export async function exportPkmBundle(
  onProgress?: ExportProgressCallback,
  options: PkmExportOptions = {}
): Promise<PkmExportSummary> {
  const { includeHighlights = true } = options
  const allFiles: Array<{ name: string; content: string }> = []
  const errors: string[] = []

  // Phase 1: Notes (0-30%)
  let noteFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(0, 'Exporting notes...')
    noteFiles = await exportNotesAsMarkdown((percent, phase) => {
      onProgress?.(Math.round(percent * 0.3), phase)
    })
    // Prefix note filenames with notes/ (notes don't already have folder prefix)
    for (const file of noteFiles) {
      allFiles.push({ name: `notes/${file.name}`, content: file.content })
    }
  } catch (err) {
    errors.push(`Notes export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Notes sub-exporter failed:', err)
  }

  // Phase 2: Flashcards (30-60%)
  let flashcardFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(30, 'Exporting flashcards...')
    flashcardFiles = await exportFlashcardsAsMarkdown((percent, phase) => {
      onProgress?.(30 + Math.round(percent * 0.3), phase)
    })
    // Flashcard files already have flashcards/ prefix from flashcardExport.ts
    for (const file of flashcardFiles) {
      allFiles.push(file)
    }
  } catch (err) {
    errors.push(`Flashcards export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Flashcards sub-exporter failed:', err)
  }

  // Phase 3: Bookmarks (60-80%)
  let bookmarkFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(60, 'Exporting bookmarks...')
    bookmarkFiles = await exportBookmarksAsMarkdown((percent, phase) => {
      onProgress?.(60 + Math.round(percent * 0.2), phase)
    })
    // Bookmark files already have bookmarks/ prefix from bookmarkExport.ts
    for (const file of bookmarkFiles) {
      allFiles.push(file)
    }
  } catch (err) {
    errors.push(`Bookmarks export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Bookmarks sub-exporter failed:', err)
  }

  // Phase 4: Book highlights (80-100%) — optional
  let highlightCount = 0
  let highlightBookCount = 0
  if (includeHighlights) {
    try {
      onProgress?.(80, 'Exporting book highlights...')
      const result = await exportHighlightsAsObsidian((percent, phase) => {
        onProgress?.(80 + Math.round(percent * 0.2), phase)
      })
      for (const file of result.files) {
        allFiles.push(file)
      }
      highlightCount = result.highlightCount
      highlightBookCount = result.bookCount
    } catch (err) {
      errors.push(`Highlights export failed: ${err instanceof Error ? err.message : String(err)}`)
      console.error('[PKM Export] Highlights sub-exporter failed:', err)
    }
  }

  // Add root README.md with export metadata
  if (allFiles.length > 0) {
    const exportDate = new Date().toLocaleDateString('sv-SE')
    const readme = generateReadme(
      exportDate,
      noteFiles.length,
      flashcardFiles.length,
      bookmarkFiles.length,
      highlightCount,
      errors
    )
    allFiles.push({ name: 'README.md', content: readme })
  }

  onProgress?.(100, 'Complete')

  const highlightSummary =
    highlightCount > 0
      ? `Exported ${highlightCount} highlight${highlightCount !== 1 ? 's' : ''} from ${highlightBookCount} book${highlightBookCount !== 1 ? 's' : ''}`
      : ''

  return { files: allFiles, highlightSummary }
}

/**
 * Generates a root README.md with export date, file count table, and folder structure docs.
 */
function generateReadme(
  exportDate: string,
  noteCount: number,
  flashcardCount: number,
  bookmarkCount: number,
  highlightCount: number,
  errors: string[] = []
): string {
  const totalCount = noteCount + flashcardCount + bookmarkCount + highlightCount
  const lines = ['# Knowlune PKM Export', '', `Exported on **${exportDate}**`, '']

  if (errors.length > 0) {
    lines.push(
      '## Export Warnings',
      '',
      'Some sections failed to export:',
      '',
      ...errors.map(e => `- ${e}`),
      ''
    )
  }

  lines.push(
    '## File Counts',
    '',
    '| Folder | Files |',
    '|--------|-------|',
    `| notes/ | ${noteCount} |`,
    `| flashcards/ | ${flashcardCount} |`,
    `| bookmarks/ | ${bookmarkCount} |`,
    `| book-highlights/ | ${highlightCount} |`,
    `| **Total** | **${totalCount}** |`,
    '',
    '## Folder Structure',
    '',
    '```',
    'notes/',
    '  {note-title}.md          — Notes with YAML frontmatter',
    'flashcards/',
    '  {course-name}/',
    '    {question}.md           — Flashcards with FSRS scheduling data',
    'bookmarks/',
    '  {course-name}/',
    '    bookmarks.md            — Video bookmarks grouped by lesson',
    'book-highlights/',
    '  {book-title}.md          — Highlights grouped by chapter',
    'README.md                   — This file',
    '```',
    '',
    '## Compatibility',
    '',
    'All Markdown files include YAML frontmatter and are compatible with:',
    '- [Obsidian](https://obsidian.md/)',
    '- [Logseq](https://logseq.com/)',
    '- Any Markdown-based PKM tool',
    ''
  )
  return lines.join('\n')
}
