/**
 * Flashcard Markdown export for PKM integration.
 *
 * Exports flashcards as individual Markdown files with YAML frontmatter,
 * organized under `flashcards/{course-name}/` folder paths.
 *
 * FSRS scheduling fields (stability, difficulty, reps, lapses, state, due, last_review)
 * are included in frontmatter when defined; undefined optional fields are omitted entirely.
 */
import { db } from '@/db/schema'
import type { Flashcard, Note } from '@/data/types'
import type { ExportProgressCallback } from './exportService'
import { sanitizeFilename } from './noteExport'

/** Yield to the UI thread between heavy operations */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Converts a course name to kebab-case tag.
 * e.g., "React Mastery" → "react-mastery"
 */
function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Derives tags for a flashcard by combining:
 * 1. Course name (kebab-cased)
 * 2. Tags from the linked note (if noteId is present)
 * Deduplicates the result.
 */
export function deriveFlashcardTags(
  flashcard: Flashcard,
  courseMap: Map<string, string>,
  noteTagMap: Map<string, string[]>
): string[] {
  const tags: string[] = []

  // Add course name as kebab-case tag
  const courseName = courseMap.get(flashcard.courseId)
  if (courseName) {
    tags.push(toKebabCase(courseName))
  }

  // Add linked note tags
  if (flashcard.noteId) {
    const noteTags = noteTagMap.get(flashcard.noteId)
    if (noteTags) {
      tags.push(...noteTags)
    }
  }

  // Deduplicate while preserving order
  return [...new Set(tags)]
}

/**
 * Escapes a string for safe YAML output.
 * Wraps in quotes and escapes internal quotes.
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Generates YAML frontmatter for a flashcard.
 * Omits undefined optional fields entirely (AC4).
 */
function generateFlashcardFrontmatter(
  flashcard: Flashcard,
  tags: string[],
  deckName: string
): string {
  const lines = [
    '---',
    `type: "flashcard"`,
    `deck: ${yamlString(deckName)}`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    // FSRS scheduling fields
    `stability: ${flashcard.stability}`,
    `difficulty: ${flashcard.difficulty}`,
    `reps: ${flashcard.reps}`,
    `lapses: ${flashcard.lapses}`,
    `state: ${flashcard.state}`,
    `elapsed_days: ${flashcard.elapsed_days}`,
    `scheduled_days: ${flashcard.scheduled_days}`,
    `due: "${flashcard.due}"`,
  ]

  // Optional fields — omit when undefined (AC4)
  if (flashcard.last_review !== undefined) {
    lines.push(`last_review: "${flashcard.last_review}"`)
  }
  if (flashcard.lastRating !== undefined) {
    lines.push(`last_rating: "${flashcard.lastRating}"`)
  }

  lines.push(`created: "${flashcard.createdAt}"`, '---', '')
  return lines.join('\n')
}

/**
 * Exports all flashcards as Markdown files with YAML frontmatter.
 *
 * Each flashcard becomes a `.md` file organized under `flashcards/{course-name}/`.
 * Returns an empty array without error if no flashcards exist (AC7).
 */
export async function exportFlashcardsAsMarkdown(
  onProgress?: ExportProgressCallback
): Promise<Array<{ name: string; content: string }>> {
  onProgress?.(0, 'Loading flashcards...')
  const flashcards = await db.flashcards.toArray()

  if (flashcards.length === 0) {
    onProgress?.(100, 'Complete')
    return []
  }

  await yieldToUI()

  // Load courses for name lookup
  onProgress?.(10, 'Loading courses...')
  const courses = await db.importedCourses.toArray()
  const courseMap = new Map(courses.map(c => [c.id, c.name]))
  await yieldToUI()

  // Load notes for tag lookup
  onProgress?.(20, 'Loading notes...')
  const notes: Note[] = await db.notes.toArray()
  const noteTagMap = new Map(notes.map(n => [n.id, n.tags]))
  await yieldToUI()

  // Group flashcards by courseId
  const byCourse = new Map<string, Flashcard[]>()
  for (const fc of flashcards) {
    const group = byCourse.get(fc.courseId) || []
    group.push(fc)
    byCourse.set(fc.courseId, group)
  }

  onProgress?.(30, 'Generating Markdown files...')
  const files: Array<{ name: string; content: string }> = []
  const usedFilenames = new Set<string>()
  let processed = 0

  for (const [courseId, courseFlashcards] of byCourse) {
    const courseName = courseMap.get(courseId) || 'Unknown Course'
    const sanitizedCourseName = sanitizeFilename(courseName) || 'unknown-course'

    for (const fc of courseFlashcards) {
      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      const frontmatter = generateFlashcardFrontmatter(fc, tags, courseName)

      // Build Q/A body
      const body = `# Q: ${fc.front}\n\n${fc.back}\n`
      const fullContent = frontmatter + body

      // Generate unique filename
      let baseName = sanitizeFilename(fc.front.slice(0, 50))
      if (!baseName) baseName = `flashcard-${fc.id.slice(0, 8)}`

      const folderPath = `flashcards/${sanitizedCourseName}`
      let filename = `${folderPath}/${baseName}.md`
      let counter = 1
      while (usedFilenames.has(filename)) {
        filename = `${folderPath}/${baseName}-${counter}.md`
        counter++
      }
      usedFilenames.add(filename)

      files.push({ name: filename, content: fullContent })

      processed++
      // Yield every 20 items
      if (processed % 20 === 0) {
        const percent = 30 + Math.round((processed / flashcards.length) * 70)
        onProgress?.(percent, `Converting flashcard ${processed}/${flashcards.length}...`)
        await yieldToUI()
      }
    }
  }

  onProgress?.(100, 'Complete')
  return files
}
