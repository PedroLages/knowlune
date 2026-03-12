import TurndownService from 'turndown'
import type { Note } from '@/data/types'

/**
 * Sanitizes a filename by removing or replacing special characters.
 * - Replaces slashes, colons, and other filesystem-unsafe chars with hyphens
 * - Collapses multiple spaces/hyphens into single hyphen
 * - Trims hyphens from start/end
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\/\\:*?"<>|]/g, '-') // Replace filesystem-unsafe chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim hyphens from start/end
    .trim()
}

/**
 * Strips TipTap-specific HTML attributes from content.
 * Removes: data-frame-capture, contenteditable, data-*
 */
function stripTipTapAttributes(html: string): string {
  return html
    .replace(/\s+data-frame-capture="[^"]*"/gi, '')
    .replace(/\s+contenteditable="[^"]*"/gi, '')
    .replace(/\s+data-[a-z-]+="[^"]*"/gi, '')
}

/**
 * Extracts plain text from HTML using DOMParser (safe from XSS).
 */
function extractTextFromHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

/**
 * Converts HTML note content to Markdown using Turndown.
 */
function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx', // Use # for headings
    codeBlockStyle: 'fenced', // Use ``` for code blocks
    emDelimiter: '_', // Use _ for emphasis
    strongDelimiter: '**', // Use ** for bold
  })

  // Strip TipTap attributes before conversion
  const cleanHtml = stripTipTapAttributes(html)
  return turndown.turndown(cleanHtml)
}

/**
 * Generates YAML frontmatter for a note.
 */
function generateFrontmatter(
  note: Note,
  courseName: string,
  lessonName: string
): string {
  // Extract title from first line of content (plain text) or use fallback
  const plainText = extractTextFromHtml(note.content)
  const firstLine = plainText.split('\n')[0]?.trim() || 'Untitled Note'
  const title = firstLine.slice(0, 100) // Limit to 100 chars

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `tags: [${note.tags.map(tag => `"${tag}"`).join(', ')}]`,
    `course: "${courseName.replace(/"/g, '\\"')}"`,
    `lesson: "${lessonName.replace(/"/g, '\\"')}"`,
    `created: "${note.createdAt}"`,
    `updated: "${note.updatedAt}"`,
    '---',
    '',
  ]

  return frontmatter.join('\n')
}

/**
 * Exports a note as a Markdown file with YAML frontmatter.
 * Triggers a browser download.
 */
export function exportNoteAsMarkdown(
  note: Note,
  courseName: string,
  lessonName: string
): void {
  // Generate frontmatter and convert content to Markdown
  const frontmatter = generateFrontmatter(note, courseName, lessonName)
  const markdown = htmlToMarkdown(note.content)
  const fullContent = frontmatter + markdown

  // Extract title for filename
  const plainText = extractTextFromHtml(note.content)
  const firstLine = plainText.split('\n')[0]?.trim() || 'note'
  const sanitizedTitle = sanitizeFilename(firstLine.slice(0, 50))
  const filename = `${sanitizedTitle}.md`

  // Create blob and trigger download
  const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
