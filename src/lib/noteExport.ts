import TurndownService from 'turndown'
import JSZip from 'jszip'
import type { Note } from '@/data/types'

/**
 * Sanitizes a filename by removing or replacing special characters.
 * - Replaces slashes, colons, and other filesystem-unsafe chars with hyphens
 * - Collapses multiple spaces/hyphens into single hyphen
 * - Trims hyphens from start/end
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, '-') // Replace filesystem-unsafe chars
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
 * Preserves newlines between block-level elements.
 */
export function extractTextFromHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Get all text nodes, adding newlines after block elements
  const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE']
  const parts: string[] = []

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) parts.push(text)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of Array.from(node.childNodes)) {
        walk(child)
      }
      // Add newline after block elements
      if (blockElements.includes((node as Element).tagName)) {
        parts.push('\n')
      }
    }
  }

  walk(doc.body)
  return parts
    .join(' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/**
 * Converts HTML note content to Markdown using Turndown.
 */
export function htmlToMarkdown(html: string): string {
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
 *
 * Public API since 2026-05-04 — used by bulk export functions and available
 * for external callers that need frontmatter without the full export pipeline.
 * The function expects a valid Note object with non-empty content.
 */
export function generateFrontmatter(note: Note, courseName: string, lessonName: string): string {
  // Extract title from first line of content (plain text) or use fallback
  const plainText = extractTextFromHtml(note.content)
  const firstLine = plainText.split('\n')[0]?.trim() || 'Untitled Note'
  const title = firstLine.slice(0, 100) // Limit to 100 chars

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `tags: [${note.tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(', ')}]`,
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
 * Converts a single note's HTML content to Markdown and returns a download-ready payload.
 * Does NOT trigger a download — the caller is responsible for that (via downloadAsFile).
 */
export function exportSingleNoteAsMarkdown(
  html: string,
  title?: string
): { content: string; filename: string } {
  const markdown = htmlToMarkdown(html)

  // Derive title from first line of markdown, or use provided title, or fallback
  const derivedTitle =
    title ||
    markdown
      .split('\n')[0]
      ?.replace(/^#+\s*/, '')
      .trim() ||
    'untitled-note'
  const sanitized = sanitizeFilename(derivedTitle.slice(0, 50))
  const filename = `${sanitized || 'note'}.md`

  return { content: markdown, filename }
}

/**
 * Exports a note as a Markdown file with YAML frontmatter.
 * Triggers a browser download.
 */
export function exportNoteAsMarkdown(note: Note, courseName: string, lessonName: string): void {
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

/** Map from videoId to module and lesson names for bulk export grouping. */
export interface ModuleLessonMapEntry {
  moduleName: string
  moduleOrder: number
  lessonName: string
  lessonOrder: number
}

/**
 * Filters notes to those with non-empty, non-whitespace content.
 * Caller is responsible for soft-deleted filtering per R9.
 */
function filterExportableNotes(notes: Note[]): Note[] {
  return notes.filter(n => n.content?.trim().length > 0)
}

/**
 * Exports all exportable notes for a course as a single Combined Markdown file.
 *
 * Groups notes by module and lesson, each note with YAML frontmatter,
 * separated by `---` dividers. For >50 notes, prepends a warning comment.
 *
 * Uses requestAnimationFrame chunking to avoid main-thread blocking for
 * courses with many notes.
 *
 * @returns A download-ready payload with markdown content and filename.
 */
export function exportCombinedMarkdown(
  notes: Note[],
  courseName: string,
  courseSlug: string,
  moduleLessonMap: Map<string, ModuleLessonMapEntry>
): { content: string; filename: string } {
  const exportable = filterExportableNotes(notes)
  const parts: string[] = []

  // Warning header for large exports
  if (exportable.length > 50) {
    parts.push(
      '<!-- WARNING: This file contains ' +
        exportable.length +
        ' notes from "' +
        courseName +
        '". Consider exporting as ZIP for better organization. -->\n'
    )
  }

  // Group notes by module, then lesson
  type LessonGroup = { lessonName: string; lessonOrder: number; notes: Note[] }
  type ModuleGroup = { moduleName: string; moduleOrder: number; lessons: Map<string, LessonGroup> }

  const moduleMap = new Map<string, ModuleGroup>()

  for (const note of exportable) {
    const info = moduleLessonMap.get(note.videoId) ?? {
      moduleName: '',
      moduleOrder: 999,
      lessonName: 'Unknown Lesson',
      lessonOrder: 999,
    }

    if (!moduleMap.has(info.moduleName)) {
      moduleMap.set(info.moduleName, {
        moduleName: info.moduleName,
        moduleOrder: info.moduleOrder,
        lessons: new Map(),
      })
    }
    const mod = moduleMap.get(info.moduleName)!

    if (!mod.lessons.has(note.videoId)) {
      mod.lessons.set(note.videoId, {
        lessonName: info.lessonName,
        lessonOrder: info.lessonOrder,
        notes: [],
      })
    }
    mod.lessons.get(note.videoId)!.notes.push(note)
  }

  // Sort modules by order, then lessons by order
  const sortedModules = Array.from(moduleMap.values()).sort((a, b) => a.moduleOrder - b.moduleOrder)

  for (const mod of sortedModules) {
    // Module header (skip for courses without modules)
    if (mod.moduleName) {
      parts.push(`## ${mod.moduleName}\n`)
    }

    const sortedLessons = Array.from(mod.lessons.values()).sort(
      (a, b) => a.lessonOrder - b.lessonOrder
    )

    for (const lesson of sortedLessons) {
      if (mod.moduleName) {
        parts.push(`### ${lesson.lessonName}\n`)
      } else {
        // Flat structure for courses without modules
        parts.push(`## ${lesson.lessonName}\n`)
      }

      for (const note of lesson.notes) {
        const frontmatter = generateFrontmatter(note, courseName, lesson.lessonName)
        const markdown = htmlToMarkdown(note.content)
        parts.push(frontmatter + markdown)
        parts.push('\n---\n')
      }
    }
  }

  const filename = `${sanitizeFilename(courseSlug || courseName) || 'course'}-notes.md`
  return { content: parts.join('\n'), filename }
}

/**
 * Exports all exportable notes for a course as a ZIP archive.
 *
 * Folder structure: `{course-slug}/{module-name}/{lesson-name}/{note-title}.md`
 * Courses without modules: flat under course folder.
 * Each .md file includes YAML frontmatter.
 *
 * Uses requestAnimationFrame chunking to yield the main thread periodically
 * when iterating large note collections, before the async JSZip generation.
 *
 * @returns A promise resolving to a Blob (the ZIP file) and suggested filename.
 */
export async function exportNotesZip(
  notes: Note[],
  courseName: string,
  courseSlug: string,
  moduleLessonMap: Map<string, ModuleLessonMapEntry>
): Promise<{ blob: Blob; filename: string }> {
  const exportable = filterExportableNotes(notes)
  const zip = new JSZip()
  const courseFolder = sanitizeFilename(courseSlug || courseName) || 'course'

  // Track used note filenames per lesson folder to prevent silent overwrites
  // when two notes in the same lesson produce the same sanitized filename.
  const usedFilenames = new Map<string, Set<string>>()

  // Yield main thread every chunkSize notes to keep UI responsive for large exports
  const CHUNK_SIZE = 20
  let processed = 0

  for (const note of exportable) {
    // Yield periodically
    if (processed > 0 && processed % CHUNK_SIZE === 0) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    processed++

    const info = moduleLessonMap.get(note.videoId)
    const moduleName = info?.moduleName || ''
    const lessonName = info?.lessonName || 'Unknown Lesson'

    // Build folder path per R11
    const moduleFolder = moduleName ? sanitizeFilename(moduleName) : ''
    const lessonFolder = sanitizeFilename(lessonName)

    // Determine the folder prefix for dedup scope
    const folderPrefix = moduleFolder
      ? `${courseFolder}/${moduleFolder}/${lessonFolder}/`
      : `${courseFolder}/${lessonFolder}/`

    // Derive note filename from content
    const plainText = extractTextFromHtml(note.content)
    const firstLine = plainText.split('\n')[0]?.trim() || 'note'
    let noteFilename = sanitizeFilename(firstLine.slice(0, 50)) || 'note'

    // Deduplicate filenames within the same lesson folder
    if (!usedFilenames.has(folderPrefix)) {
      usedFilenames.set(folderPrefix, new Set())
    }
    const folderFiles = usedFilenames.get(folderPrefix)!

    if (folderFiles.has(noteFilename)) {
      // Find next available suffix
      let suffix = 2
      while (folderFiles.has(`${noteFilename}-${suffix}`)) {
        suffix++
      }
      noteFilename = `${noteFilename}-${suffix}`
    }
    folderFiles.add(noteFilename)

    const frontmatter = generateFrontmatter(note, courseName, lessonName)
    const markdown = htmlToMarkdown(note.content)
    const fileContent = frontmatter + markdown

    const filePath = `${folderPrefix}${noteFilename}.md`

    zip.file(filePath, fileContent)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `${courseFolder}-notes.zip`
  return { blob, filename }
}
