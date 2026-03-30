/**
 * PKM (Personal Knowledge Management) batch export orchestrator.
 *
 * Combines notes, flashcards, and bookmarks into a single ZIP-ready file array
 * with folder structure compatible with Obsidian and other PKM tools:
 *   notes/           — Individual note Markdown files
 *   flashcards/      — Flashcard Markdown files grouped by course
 *   bookmarks/       — Bookmark Markdown files grouped by course
 *   README.md        — Export metadata with file counts and folder docs
 */
import type { ExportProgressCallback } from './exportService'
import { exportNotesAsMarkdown } from './exportService'
import { exportFlashcardsAsMarkdown } from './flashcardExport'
import { exportBookmarksAsMarkdown } from './bookmarkExport'

/**
 * Exports a complete PKM bundle combining notes, flashcards, and bookmarks.
 *
 * Progress is weighted: notes 40%, flashcards 40%, bookmarks 20%.
 * Returns an empty array if no data exists across all three sources.
 *
 * @param onProgress - Optional callback for weighted progress updates
 * @returns Array of { name, content } files ready for downloadZip()
 */
export async function exportPkmBundle(
  onProgress?: ExportProgressCallback
): Promise<Array<{ name: string; content: string }>> {
  const allFiles: Array<{ name: string; content: string }> = []
  const errors: string[] = []

  // Phase 1: Notes (0-40%)
  let noteFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(0, 'Exporting notes...')
    noteFiles = await exportNotesAsMarkdown((percent, phase) => {
      onProgress?.(Math.round(percent * 0.4), phase)
    })
    // Prefix note filenames with notes/ (notes don't already have folder prefix)
    for (const file of noteFiles) {
      allFiles.push({ name: `notes/${file.name}`, content: file.content })
    }
  } catch (err) {
    errors.push(`Notes export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Notes sub-exporter failed:', err)
  }

  // Phase 2: Flashcards (40-80%)
  let flashcardFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(40, 'Exporting flashcards...')
    flashcardFiles = await exportFlashcardsAsMarkdown((percent, phase) => {
      onProgress?.(40 + Math.round(percent * 0.4), phase)
    })
    // Flashcard files already have flashcards/ prefix from flashcardExport.ts
    for (const file of flashcardFiles) {
      allFiles.push(file)
    }
  } catch (err) {
    errors.push(`Flashcards export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Flashcards sub-exporter failed:', err)
  }

  // Phase 3: Bookmarks (80-100%)
  let bookmarkFiles: Array<{ name: string; content: string }> = []
  try {
    onProgress?.(80, 'Exporting bookmarks...')
    bookmarkFiles = await exportBookmarksAsMarkdown((percent, phase) => {
      onProgress?.(80 + Math.round(percent * 0.2), phase)
    })
    // Bookmark files already have bookmarks/ prefix from bookmarkExport.ts
    for (const file of bookmarkFiles) {
      allFiles.push(file)
    }
  } catch (err) {
    errors.push(`Bookmarks export failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[PKM Export] Bookmarks sub-exporter failed:', err)
  }

  // Add root README.md with export metadata
  if (allFiles.length > 0) {
    const exportDate = new Date().toLocaleDateString('sv-SE')
    const readme = generateReadme(
      exportDate,
      noteFiles.length,
      flashcardFiles.length,
      bookmarkFiles.length,
      errors
    )
    allFiles.push({ name: 'README.md', content: readme })
  }

  onProgress?.(100, 'Complete')
  return allFiles
}

/**
 * Generates a root README.md with export date, file count table, and folder structure docs.
 */
function generateReadme(
  exportDate: string,
  noteCount: number,
  flashcardCount: number,
  bookmarkCount: number,
  errors: string[] = []
): string {
  const totalCount = noteCount + flashcardCount + bookmarkCount
  const lines = [
    '# Knowlune PKM Export',
    '',
    `Exported on **${exportDate}**`,
    '',
  ]

  if (errors.length > 0) {
    lines.push(
      '## Export Warnings',
      '',
      'Some sections failed to export:',
      '',
      ...errors.map(e => `- ${e}`),
      '',
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
    'README.md                   — This file',
    '```',
    '',
    '## Compatibility',
    '',
    'All Markdown files include YAML frontmatter and are compatible with:',
    '- [Obsidian](https://obsidian.md/)',
    '- [Logseq](https://logseq.com/)',
    '- Any Markdown-based PKM tool',
    '',
  )
  return lines.join('\n')
}
