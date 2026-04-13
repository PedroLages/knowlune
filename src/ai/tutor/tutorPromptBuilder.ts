/**
 * Tutor System Prompt Builder (E57-S01)
 *
 * 6-slot priority-based prompt builder that assembles the system prompt
 * for the tutor chat. Slots are filled in priority order and lower-priority
 * optional slots are omitted if the token budget is exceeded.
 *
 * Required slots (never omitted): base, mode, course
 * Optional slots (budget-dependent): transcript, learner, resume
 */

import type { TutorContext, TutorMode, PromptSlot } from './types'
import { estimateTokens } from './transcriptContext'

/** Default token budget for system prompt (conservative for small Ollama models) */
const DEFAULT_TOKEN_BUDGET = 2048

// ---------------------------------------------------------------------------
// Slot content generators
// ---------------------------------------------------------------------------

function buildBaseSlot(): string {
  return `You are a knowledgeable tutor helping a learner understand their course material. You provide clear, accurate, and encouraging explanations. When answering questions:
- Ground your answers in the provided transcript/context when available
- Be concise but thorough
- Use examples when helpful
- If you're unsure about something, say so rather than guessing
- Reference specific parts of the transcript when relevant`
}

function buildModeSlot(mode: TutorMode): string {
  switch (mode) {
    case 'socratic':
      return `Teaching mode: Socratic. Guide the learner to discover answers through thoughtful questions. Don't give answers directly — ask leading questions that help them reason through the problem. When they get stuck, provide hints rather than solutions.`
    case 'explain':
      return `Teaching mode: Direct explanation. Provide clear, thorough explanations. Break complex topics into understandable parts. Use analogies and examples to make concepts accessible.`
    case 'quiz':
      return `Teaching mode: Quiz. Test the learner's understanding by asking questions about the material. After they answer, provide feedback on what they got right and wrong, with explanations.`
  }
}

function buildCourseSlot(context: TutorContext): string {
  let slot = `Course: ${context.courseName}\nLesson: ${context.lessonTitle}`
  if (context.lessonPosition) {
    slot += `\nLesson position: ${context.lessonPosition}`
  }
  if (context.videoPositionSeconds !== undefined) {
    const mins = Math.floor(context.videoPositionSeconds / 60)
    const secs = Math.floor(context.videoPositionSeconds % 60)
    slot += `\nCurrent video position: ${mins}:${String(secs).padStart(2, '0')}`
  }
  return slot
}

function buildTranscriptSlot(context: TutorContext): string {
  if (!context.transcriptExcerpt) return ''

  let header = 'Lesson transcript'
  if (context.transcriptStrategy === 'chapter' && context.chapterTitle) {
    header = `Chapter: ${context.chapterTitle}`
  } else if (context.transcriptStrategy === 'window' && context.timeRange) {
    header = `Transcript excerpt ${context.timeRange}`
  }

  return `${header}:\n"""\n${context.transcriptExcerpt}\n"""`
}

function buildLearnerSlot(): string {
  // Placeholder for learner profile injection (future stories)
  return ''
}

function buildResumeSlot(): string {
  // Placeholder for conversation resume context (future stories)
  return ''
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the tutor system prompt from context with token budget enforcement.
 *
 * @param context - Tutor context with course/lesson/transcript info
 * @param mode - Tutor interaction mode (default: socratic)
 * @param tokenBudget - Maximum tokens for the system prompt
 * @returns Assembled system prompt string
 */
export function buildTutorSystemPrompt(
  context: TutorContext,
  mode: TutorMode = 'socratic',
  tokenBudget: number = DEFAULT_TOKEN_BUDGET
): string {
  // Build all slots
  const slots: PromptSlot[] = [
    { id: 'base', required: true, priority: 1, content: buildBaseSlot() },
    { id: 'mode', required: true, priority: 2, content: buildModeSlot(mode) },
    { id: 'course', required: true, priority: 3, content: buildCourseSlot(context) },
    { id: 'transcript', required: false, priority: 4, content: buildTranscriptSlot(context) },
    { id: 'learner', required: false, priority: 5, content: buildLearnerSlot() },
    { id: 'resume', required: false, priority: 6, content: buildResumeSlot() },
  ]

  // Sort by priority (already sorted, but be explicit)
  slots.sort((a, b) => a.priority - b.priority)

  // Fill slots in priority order, respecting token budget
  const included: string[] = []
  let usedTokens = 0

  for (const slot of slots) {
    if (!slot.content) continue

    const slotTokens = estimateTokens(slot.content)

    if (slot.required) {
      // Required slots are always included
      included.push(slot.content)
      usedTokens += slotTokens
    } else if (usedTokens + slotTokens <= tokenBudget) {
      // Optional slots included only if within budget
      included.push(slot.content)
      usedTokens += slotTokens
    }
    // else: skip this optional slot (budget exceeded)
  }

  return included.join('\n\n')
}
