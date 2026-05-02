/**
 * AI Note Organization Service
 *
 * Analyzes user notes and generates proposals for tags, categories,
 * and cross-course links. Uses the non-streaming /api/ai/generate endpoint
 * (same pattern as generateLearningPath).
 *
 * Privacy (AC7): Only note content (truncated), existing tags, and course names
 * are transmitted. Internal indices replace real noteIds in the prompt.
 */

import { getAIConfiguration, getDecryptedApiKey, isFeatureEnabled } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'
import { stripHtml } from '@/lib/textUtils'
import './noteOrganizer.types'

/** A single proposal for organizing one note */
export interface NoteOrganizationProposal {
  /** Real noteId (mapped back from internal index after LLM response) */
  noteId: string
  /** New tags to add (lowercase, no duplicates with existing) */
  suggestedTags: string[]
  /** Category tags in "category:xyz" format */
  suggestedCategories: string[]
  /** NoteIds of related notes from other courses */
  crossCourseLinks: string[]
  /** AI explanation for proposed changes */
  rationale: string
}

/** Input note shape (subset of Note — only what we need) */
interface OrganizableNote {
  id: string
  courseId: string
  content: string
  tags: string[]
}

interface OrganizeNotesOptions {
  timeout?: number
  signal?: AbortSignal
}

/** Maximum notes per LLM batch (token limit protection) */
const BATCH_SIZE = 20
/** Maximum content length per note in prompt (chars) */
const MAX_CONTENT_LENGTH = 200
/** Request timeout */
const DEFAULT_TIMEOUT = 30000

/**
 * Organize notes using AI: generate proposed tags, categories, and cross-course links.
 *
 * @param notes - Notes to analyze (must have at least 1)
 * @param courseNames - Map of courseId → course display name
 * @param options - Timeout and abort signal
 * @returns Array of proposals (one per note)
 *
 * @throws {Error} If AI not configured, consent disabled, or request fails
 */
export async function organizeNotes(
  notes: OrganizableNote[],
  courseNames: Map<string, string>,
  options: OrganizeNotesOptions = {}
): Promise<NoteOrganizationProposal[]> {
  const { timeout = DEFAULT_TIMEOUT, signal } = options

  if (notes.length === 0) {
    throw new Error('At least 1 note is required for AI organization')
  }

  // Check for test mock (E2E tests inject deterministic responses via window object)
  if (typeof window !== 'undefined' && window.__mockNoteOrganizationResponse) {
    return window.__mockNoteOrganizationResponse.proposals
  }

  // Gate checks
  const config = getAIConfiguration()
  const apiKey = await getDecryptedApiKey()

  if (!apiKey) {
    throw new Error('AI features are not configured. Please set up your API key in Settings.')
  }

  if (!isFeatureEnabled('noteOrganization')) {
    throw new Error('Note Organization AI feature is disabled. Please enable it in Settings.')
  }

  // Batch notes if needed
  if (notes.length <= BATCH_SIZE) {
    return fetchOrganizationProposals(notes, courseNames, config.provider, apiKey, timeout, signal)
  }

  // Process in batches and merge results
  const allProposals: NoteOrganizationProposal[] = []
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE)
    const batchProposals = await fetchOrganizationProposals(
      batch,
      courseNames,
      config.provider,
      apiKey,
      timeout,
      signal
    )
    allProposals.push(...batchProposals)
  }
  return allProposals
}

/**
 * Send a batch of notes to the AI and parse the structured response.
 */
async function fetchOrganizationProposals(
  notes: OrganizableNote[],
  courseNames: Map<string, string>,
  provider: string,
  apiKey: string,
  timeout: number,
  signal?: AbortSignal
): Promise<NoteOrganizationProposal[]> {
  // Build index map: internal index → real noteId (privacy: no real IDs in prompt)
  const indexToNoteId = new Map<number, string>()
  const noteIdToIndex = new Map<string, number>()

  const sanitizedNotes = notes.map((note, index) => {
    indexToNoteId.set(index, note.id)
    noteIdToIndex.set(note.id, index)

    const plainContent = stripHtml(note.content)
    const truncated =
      plainContent.length > MAX_CONTENT_LENGTH
        ? plainContent.slice(0, MAX_CONTENT_LENGTH) + '...'
        : plainContent

    return {
      index,
      content: truncated,
      existingTags: note.tags,
      course: courseNames.get(note.courseId) ?? 'Unknown Course',
    }
  })

  const prompt = buildPrompt(sanitizedNotes)

  // Create timeout promise
  let timeoutId!: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('AI request timed out')), timeout)
  })

  const fetchPromise = fetch(apiUrl('ai-generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 4000,
    }),
    signal,
  })

  try {
    const response = await Promise.race([fetchPromise, timeoutPromise])
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `AI provider error (${response.status}): ${
          (errorData as { error?: { message?: string } }).error?.message || response.statusText
        }`
      )
    }

    const data = (await response.json()) as { text?: string }
    const content = data.text

    if (!content) {
      throw new Error('AI response is empty')
    }

    return parseResponse(content, indexToNoteId, notes)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Note organization was cancelled')
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Failed to organize notes. Please try again.')
  }
}

/**
 * Build the LLM prompt for note organization.
 * Privacy: uses internal indices, not real noteIds.
 */
function buildPrompt(
  notes: Array<{
    index: number
    content: string
    existingTags: string[]
    course: string
  }>
): string {
  return `You are a learning note organizer. Analyze these study notes and suggest tags, categories, and cross-course connections.

Notes:
${JSON.stringify(notes, null, 2)}

Instructions:
1. For each note, suggest 1-5 additional tags that capture key concepts (do NOT repeat existing tags)
2. Assign exactly one category per note (e.g., "programming", "algorithms", "data-structures", "design-patterns", "web-development", "databases", "testing", "devops", "machine-learning", etc.)
3. Identify cross-course connections — notes from DIFFERENT courses that share concepts (use the "index" field to reference notes)
4. Provide a brief rationale for each set of changes

Output ONLY valid JSON in this format:
{
  "proposals": [
    {
      "index": 0,
      "suggestedTags": ["iteration", "for-loop"],
      "category": "programming",
      "crossCourseLinks": [2],
      "rationale": "This note covers iteration concepts that connect to the algorithms course note on sorting loops"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code blocks, no extra text.
- Categories must use lowercase-hyphenated format.
- Tags must use lowercase format.
- crossCourseLinks must reference notes by their "index" field, and ONLY notes from different courses.
- Do NOT include the note's own index in crossCourseLinks.`
}

/**
 * Parse the LLM JSON response and map internal indices back to real noteIds.
 */
function parseResponse(
  content: string,
  indexToNoteId: Map<number, string>,
  notes: OrganizableNote[]
): NoteOrganizationProposal[] {
  let parsed: {
    proposals: Array<{
      index: number
      suggestedTags: string[]
      category: string
      crossCourseLinks: number[]
      rationale: string
    }>
  }

  try {
    // Handle markdown code block wrapping
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content
    parsed = JSON.parse(jsonStr.trim())
  } catch {
    console.error('[noteOrganizer] Failed to parse LLM response:', content)
    throw new Error('AI response is not valid JSON. Please try again.')
  }

  if (!Array.isArray(parsed.proposals)) {
    throw new Error('AI response format is invalid (missing proposals array)')
  }

  return parsed.proposals
    .map(proposal => {
      const noteId = indexToNoteId.get(proposal.index)
      if (!noteId) {
        console.warn('[noteOrganizer] AI returned unknown index:', proposal.index)
        return null
      }

      const note = notes.find(n => n.id === noteId)
      const existingTags = new Set(note?.tags ?? [])

      // Filter out tags that already exist on the note
      const newTags = (proposal.suggestedTags ?? [])
        .map(t => t.toLowerCase().trim())
        .filter(t => t.length > 0 && !existingTags.has(t))

      // Format category as namespaced tag
      const categories = proposal.category
        ? [`category:${proposal.category.toLowerCase().trim()}`]
        : []

      // Map cross-course link indices back to real noteIds
      const crossCourseLinks = (proposal.crossCourseLinks ?? [])
        .map(idx => indexToNoteId.get(idx))
        .filter((id): id is string => id != null)

      return {
        noteId,
        suggestedTags: newTags,
        suggestedCategories: categories,
        crossCourseLinks,
        rationale: proposal.rationale ?? 'No rationale provided',
      }
    })
    .filter((p): p is NoteOrganizationProposal => p != null)
}
