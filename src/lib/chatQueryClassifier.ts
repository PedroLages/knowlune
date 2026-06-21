/**
 * Chat Query Classifier
 *
 * Lightweight heuristic-based classifier for routing user messages in the
 * QAChatPanel. Runs before the RAG pipeline to handle greetings and
 * meta-questions without triggering embedding generation or LLM calls.
 *
 * Classification categories:
 * - 'greeting' – social/chitchat messages that should get a canned reply
 * - 'meta' – questions about note inventory, capabilities, available courses
 * - 'search' – actual knowledge-seeking queries that should go through RAG
 *
 * Design decision (AC8): Heuristics only – no LLM call for classification.
 * Greetings and meta-questions have clear lexical patterns that are cheap
 * and fast to match. LLM-based classification would add ~1-2s latency.
 */

export type QueryCategory = 'greeting' | 'meta' | 'search'

const greetingPattern =
  /^(hi|hello( there)?|hey|greetings|good (morning|afternoon|evening)|thanks|thank you|bye|see you)[!.\s]*$/i

const metaPatterns = [
  /do i have (any )?notes/i,
  /what (can|should) i ask/i,
  /how many notes/i,
  /what notes do i have/i,
  /what (can|does) this (do|help with)/i,
  /how (does|can) this work/i,
  /what (topics|subjects|courses) (do|have) i/i,
  /show me (my |all )?notes/i,
  /list (my |all )?notes/i,
]

/**
 * Classify a user query into a routing category.
 *
 * @param query - Raw user input (may include leading/trailing whitespace)
 * @returns The classified category
 *
 * Classification rules:
 * 1. Empty/whitespace-only → 'search' (handled by existing empty check)
 * 2. Pure greeting/social → 'greeting' (canned reply, no RAG)
 * 3. Meta question → 'meta' (note inventory, no RAG)
 * 4. Everything else → 'search' (full RAG pipeline)
 *
 * Edge cases:
 * - "Hi, what do I know about JavaScript?" → 'search' (search terms dominate)
 * - "Hello" → 'greeting'
 * - "thanks" → 'greeting'
 * - "" → 'search'
 */
export function classifyQuery(query: string): QueryCategory {
  const trimmed = query.trim()

  if (!trimmed) {
    return 'search'
  }

  // Check for meta patterns first — they're more specific
  for (const pattern of metaPatterns) {
    if (pattern.test(trimmed)) {
      return 'meta'
    }
  }

  // Check for pure greetings (only when the entire message is a greeting)
  if (greetingPattern.test(trimmed)) {
    return 'greeting'
  }

  return 'search'
}

/**
 * Canned greeting response shown when the user sends a greeting.
 * This avoids triggering RAG retrieval for social messages.
 */
export const GREETING_RESPONSE =
  "Hello! I can help you search through your notes. Ask me about any topic you've taken notes on, and I'll find relevant information with citations."

/**
 * Build a meta response showing the user their note inventory.
 *
 * @param noteCount - Total number of notes the user has
 * @param courseCount - Number of unique courses with notes
 * @param courseNames - Human-readable names of those courses
 * @returns A short readable summary
 */
export function buildMetaResponse(
  noteCount: number,
  courseCount: number,
  courseNames: string[]
): string {
  const courseList =
    courseNames.length > 0
      ? courseNames
          .slice(0, 5)
          .map(n => `"${n}"`)
          .join(', ') + (courseNames.length > 5 ? ` and ${courseNames.length - 5} more` : '')
      : 'various courses'

  return `You have ${noteCount} note${noteCount === 1 ? '' : 's'} across ${courseCount} course${courseCount === 1 ? '' : 's'}: ${courseList}. Ask me about any topic you've studied!`
}
