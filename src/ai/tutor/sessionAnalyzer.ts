/**
 * Session Boundary Analyzer (E72-S03)
 *
 * Analyzes completed tutor sessions to extract insights for learner model updates.
 * Runs at session boundaries (navigation away, tab switch, idle timeout).
 *
 * @see src/data/types.ts — TutorMessage, LearnerModel, ConceptAssessment
 */

import { z } from 'zod'
import type { TutorMessage, LearnerModel, ConceptAssessment } from '@/data/types'
import type { TutorMode } from '@/ai/tutor/types'
import { getLLMClient } from '@/ai/llm/factory'
import type { LLMMessage } from '@/ai/llm/types'
import { updateLearnerModel } from '@/ai/tutor/learnerModelService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionInsights {
  /** Number of assessment exchanges (quiz + debug user messages) */
  assessmentExchangeCount: number
  /** Quiz stats extracted from the session */
  quizStats: { totalQuestions: number; correctAnswers: number; weakTopics: string[] } | null
  /** Concepts identified as strengths */
  strengths: ConceptAssessment[]
  /** Concepts identified as misconceptions */
  misconceptions: ConceptAssessment[]
  /** Topics explored during the session */
  topicsExplored: string[]
  /** Most used mode during the session */
  preferredMode: TutorMode
  /** Brief summary of the session */
  sessionSummary: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum assessment exchanges required to trigger a model update */
export const MIN_ASSESSMENT_EXCHANGES = 3

// ---------------------------------------------------------------------------
// Zod Schemas for LLM Response Validation
// ---------------------------------------------------------------------------

const ConceptAssessmentSchema = z.object({
  concept: z.string(),
  confidence: z.number().min(0).max(1),
})

export const LearnerModelUpdateSchema = z.object({
  vocabularyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  strengths: z.array(ConceptAssessmentSchema).optional(),
  misconceptions: z.array(ConceptAssessmentSchema).optional(),
  topicsExplored: z.array(z.string()).optional(),
  lastSessionSummary: z.string().optional(),
  preferredMode: z.enum(['socratic', 'explain', 'quiz', 'eli5', 'debug']).optional(),
  quizStats: z.object({
    totalQuestions: z.number(),
    correctAnswers: z.number(),
    weakTopics: z.array(z.string()),
  }).optional(),
})

export type LearnerModelUpdate = z.infer<typeof LearnerModelUpdateSchema>

// ---------------------------------------------------------------------------
// Session Analysis (local extraction — no LLM needed)
// ---------------------------------------------------------------------------

/**
 * Count assessment exchanges: user messages in quiz or debug modes.
 */
export function countAssessmentExchanges(messages: TutorMessage[]): number {
  return messages.filter(
    (m) => m.role === 'user' && (m.mode === 'quiz' || m.mode === 'debug')
  ).length
}

/**
 * Determine the most-used mode in the session.
 */
function getMostUsedMode(messages: TutorMessage[]): TutorMode {
  const counts = new Map<TutorMode, number>()
  for (const m of messages) {
    if (m.mode) {
      counts.set(m.mode, (counts.get(m.mode) ?? 0) + 1)
    }
  }
  let maxMode: TutorMode = 'socratic'
  let maxCount = 0
  for (const [mode, count] of counts) {
    if (count > maxCount) {
      maxMode = mode
      maxCount = count
    }
  }
  return maxMode
}

/**
 * Extract quiz stats from messages with quizScore fields.
 */
function extractQuizStats(messages: TutorMessage[]): SessionInsights['quizStats'] {
  const quizMessages = messages.filter((m) => m.quizScore != null)
  if (quizMessages.length === 0) return null

  let totalQuestions = 0
  let correctAnswers = 0
  const incorrectTopics: string[] = []

  for (const m of quizMessages) {
    if (m.quizScore) {
      totalQuestions++
      if (m.quizScore.correct) {
        correctAnswers++
      } else {
        // Use the message content snippet as a topic hint for weak topics
        const hint = m.content.trim().split(/\s+/).slice(0, 5).join(' ')
        if (hint) incorrectTopics.push(hint)
      }
    }
  }

  return {
    totalQuestions,
    correctAnswers,
    weakTopics: incorrectTopics,
  }
}

/**
 * Extract concept assessments from quiz messages.
 * Correct answers → strengths, incorrect → misconceptions.
 */
function extractQuizConcepts(messages: TutorMessage[]): {
  strengths: ConceptAssessment[]
  misconceptions: ConceptAssessment[]
} {
  const now = new Date().toISOString()
  const strengths: ConceptAssessment[] = []
  const misconceptions: ConceptAssessment[] = []

  for (const m of messages) {
    if (m.quizScore && m.role === 'user') {
      const concept = m.content.trim().split(/\s+/).slice(0, 6).join(' ')
      const assessment: ConceptAssessment = {
        concept,
        confidence: m.quizScore.correct ? 0.8 : 0.3,
        lastAssessed: now,
        assessedBy: 'quiz',
      }
      if (m.quizScore.correct) {
        strengths.push(assessment)
      } else {
        misconceptions.push(assessment)
      }
    }
  }

  return { strengths, misconceptions }
}

/**
 * Extract concept assessments from debug messages.
 * Green → strengths, red → misconceptions, yellow → reduced confidence.
 */
function extractDebugConcepts(messages: TutorMessage[]): {
  strengths: ConceptAssessment[]
  misconceptions: ConceptAssessment[]
} {
  const now = new Date().toISOString()
  const strengths: ConceptAssessment[] = []
  const misconceptions: ConceptAssessment[] = []

  for (const m of messages) {
    if (m.debugAssessment && m.role === 'assistant') {
      const concept = m.content.trim().split(/\s+/).slice(0, 6).join(' ')
      const assessment: ConceptAssessment = {
        concept,
        confidence:
          m.debugAssessment === 'green' ? 0.9
          : m.debugAssessment === 'yellow' ? 0.5
          : 0.2,
        lastAssessed: now,
        assessedBy: 'debug',
      }
      if (m.debugAssessment === 'green') {
        strengths.push(assessment)
      } else {
        // Both yellow and red go to misconceptions; yellow with moderate confidence
        misconceptions.push(assessment)
      }
    }
  }

  return { strengths, misconceptions }
}

/**
 * Analyze a completed tutor session and extract insights.
 * Pure function — no side effects, no LLM calls.
 */
export function analyzeSession(messages: TutorMessage[]): SessionInsights {
  const quizStats = extractQuizStats(messages)
  const quizConcepts = extractQuizConcepts(messages)
  const debugConcepts = extractDebugConcepts(messages)

  const strengths = [...quizConcepts.strengths, ...debugConcepts.strengths]
  const misconceptions = [...quizConcepts.misconceptions, ...debugConcepts.misconceptions]

  // Extract explored topics from all messages
  const topicsExplored = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim().split(/\s+/).slice(0, 4).join(' '))
    .filter(Boolean)
    .slice(0, 10) // Cap to prevent unbounded growth

  return {
    assessmentExchangeCount: countAssessmentExchanges(messages),
    quizStats,
    strengths,
    misconceptions,
    topicsExplored: [...new Set(topicsExplored)],
    preferredMode: getMostUsedMode(messages),
    sessionSummary: '',
  }
}

// ---------------------------------------------------------------------------
// LLM-Based Session Update
// ---------------------------------------------------------------------------

/**
 * Build the LLM prompt for session analysis.
 */
function buildSessionUpdatePrompt(
  currentModel: LearnerModel,
  messages: TutorMessage[]
): string {
  const assessmentMessages = messages
    .filter((m) => m.mode === 'quiz' || m.mode === 'debug')
    .slice(-20) // Cap to prevent token overflow
    .map((m) => `[${m.role}/${m.mode}]: ${m.content.slice(0, 200)}`)
    .join('\n')

  return `You are analyzing a tutor session to update a learner model. Given the current model and session transcript, produce a JSON object with updated fields.

Current learner model:
- Vocabulary level: ${currentModel.vocabularyLevel}
- Strengths: ${currentModel.strengths.map((s) => s.concept).join(', ') || 'none'}
- Misconceptions: ${currentModel.misconceptions.map((m) => m.concept).join(', ') || 'none'}
- Topics explored: ${currentModel.topicsExplored.join(', ') || 'none'}

Session assessment exchanges:
${assessmentMessages || '(no assessment exchanges)'}

Return a JSON object with ONLY the fields that should be updated:
{
  "vocabularyLevel": "beginner" | "intermediate" | "advanced",
  "strengths": [{"concept": "...", "confidence": 0.0-1.0}],
  "misconceptions": [{"concept": "...", "confidence": 0.0-1.0}],
  "topicsExplored": ["..."],
  "lastSessionSummary": "Brief 1-sentence summary",
  "quizStats": {"totalQuestions": N, "correctAnswers": N, "weakTopics": ["..."]}
}

Only include fields where the session provides evidence for an update. Be concise.`
}

/**
 * Collect full response from streaming LLM client.
 */
async function collectStreamResponse(messages: LLMMessage[]): Promise<string> {
  const client = await getLLMClient('tutor')
  let fullResponse = ''
  for await (const chunk of client.streamCompletion(messages)) {
    if (chunk.content) {
      fullResponse += chunk.content
    }
    if (chunk.finishReason) break
  }
  return fullResponse
}

/**
 * Update learner model from a completed session.
 * Fire-and-forget — errors are logged, never thrown to callers.
 *
 * @param courseId - Course ID for the learner model
 * @param messages - Session messages (TutorMessage format)
 * @param currentModel - Current learner model state
 */
export async function updateFromSession(
  courseId: string,
  messages: TutorMessage[],
  currentModel: LearnerModel
): Promise<void> {
  // Check minimum threshold
  const exchangeCount = countAssessmentExchanges(messages)
  if (exchangeCount < MIN_ASSESSMENT_EXCHANGES) {
    return // Insufficient data — skip silently
  }

  // Extract local insights first (no LLM needed)
  const insights = analyzeSession(messages)

  // Merge local insights as baseline update
  const now = new Date().toISOString()
  const localUpdate: Partial<LearnerModel> = {
    preferredMode: insights.preferredMode,
    ...(insights.strengths.length > 0 && { strengths: insights.strengths }),
    ...(insights.misconceptions.length > 0 && { misconceptions: insights.misconceptions }),
    ...(insights.topicsExplored.length > 0 && { topicsExplored: insights.topicsExplored }),
    ...(insights.quizStats && { quizStats: insights.quizStats }),
  }

  // Try LLM-based update for richer analysis
  try {
    const prompt = buildSessionUpdatePrompt(currentModel, messages)
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Analyze the session and return the JSON update.' },
    ]

    const responseText = await collectStreamResponse(llmMessages)

    // Extract JSON from response: try markdown code block first, then non-greedy bare JSON
    let jsonCandidate: string | null = null
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      jsonCandidate = codeBlockMatch[1]
    } else {
      const bareMatch = responseText.match(/\{[\s\S]*?\}/)
      if (bareMatch) jsonCandidate = bareMatch[0]
    }

    let parsed: unknown
    try {
      if (!jsonCandidate) throw new Error('no JSON found')
      parsed = JSON.parse(jsonCandidate)
    } catch {
      console.warn('[sessionAnalyzer] LLM returned no valid JSON, using local insights only')
      await updateLearnerModel(courseId, localUpdate)
      return
    }
    const validated = LearnerModelUpdateSchema.parse(parsed)

    // Augment LLM response with timestamps for concept assessments.
    // Destructure strengths/misconceptions out so we can replace them with
    // fully-typed ConceptAssessment objects (adding lastAssessed + assessedBy).
    const { strengths: rawStrengths, misconceptions: rawMisconceptions, ...rest } = validated
    const enrichedUpdate: Partial<LearnerModel> = {
      ...rest,
      ...(rawStrengths && {
        strengths: rawStrengths.map((s) => ({
          ...s,
          lastAssessed: now,
          assessedBy: insights.preferredMode as TutorMode,
        })),
      }),
      ...(rawMisconceptions && {
        misconceptions: rawMisconceptions.map((m) => ({
          ...m,
          lastAssessed: now,
          assessedBy: insights.preferredMode as TutorMode,
        })),
      }),
    }

    await updateLearnerModel(courseId, enrichedUpdate)
  } catch (error) {
    // LLM failed — fall back to local insights
    console.warn('[sessionAnalyzer] LLM update failed, using local insights:', error)
    try {
      await updateLearnerModel(courseId, localUpdate)
    } catch (mergeError) {
      console.warn('[sessionAnalyzer] Local insights merge also failed:', mergeError)
    }
  }
}

// ---------------------------------------------------------------------------
// Learner Model Serialization for Prompt Injection
// ---------------------------------------------------------------------------

/**
 * Serialize a LearnerModel into a compact natural-language string
 * suitable for injection into the tutor system prompt (~50-80 tokens).
 */
export function serializeLearnerModelForPrompt(model: LearnerModel): string {
  const parts: string[] = []

  parts.push(`${capitalize(model.vocabularyLevel)} vocabulary.`)

  if (model.strengths.length > 0) {
    const top = model.strengths
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4)
      .map((s) => s.concept)
      .join(', ')
    parts.push(`Strengths: ${top}.`)
  }

  if (model.misconceptions.length > 0) {
    const top = model.misconceptions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((m) => m.concept)
      .join(', ')
    parts.push(`Misconceptions: ${top}.`)
  }

  if (model.preferredMode && model.preferredMode !== 'socratic') {
    const modeLabels: Record<TutorMode, string> = {
      socratic: 'Socratic',
      explain: 'Explain',
      quiz: 'Quiz Me',
      eli5: 'ELI5',
      debug: 'Debug',
    }
    parts.push(`Preferred mode: ${modeLabels[model.preferredMode]}.`)
  }

  if (model.lastSessionSummary) {
    // Truncate to keep within token budget
    const summary = model.lastSessionSummary.slice(0, 120)
    parts.push(`Last session: ${summary}.`)
  }

  return parts.join(' ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
