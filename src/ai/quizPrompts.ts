/**
 * Bloom's Taxonomy Prompt Templates for Quiz Generation
 *
 * Provides system prompts with level-specific instructions and few-shot examples
 * for generating quiz questions at different Bloom's taxonomy levels. Uses Ollama's
 * `format` parameter for schema-enforced structured output.
 *
 * Supported levels: Remember, Understand, Apply
 * Supported question types: multiple-choice, true-false, fill-in-blank
 *
 * @module
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported Bloom's Taxonomy levels for quiz generation */
export type BloomsLevel = 'remember' | 'understand' | 'apply'

/** A single generated question from the LLM */
export const GeneratedQuestionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['multiple-choice', 'true-false', 'fill-in-blank']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string(),
  bloomsLevel: z.enum(['remember', 'understand', 'apply']),
})
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>

/** Schema for the full LLM quiz response */
export const QuizResponseSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(1),
})
export type QuizResponse = z.infer<typeof QuizResponseSchema>

// ---------------------------------------------------------------------------
// JSON Schema for Ollama `format` parameter
// ---------------------------------------------------------------------------

/**
 * JSON schema for Ollama's `format` parameter.
 * Enforces structured output so the model returns valid JSON every time.
 */
export const QUIZ_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const },
          type: {
            type: 'string' as const,
            enum: ['multiple-choice', 'true-false', 'fill-in-blank'],
          },
          options: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          correctAnswer: { type: 'string' as const },
          explanation: { type: 'string' as const },
          bloomsLevel: {
            type: 'string' as const,
            enum: ['remember', 'understand', 'apply'],
          },
        },
        required: ['text', 'type', 'correctAnswer', 'explanation', 'bloomsLevel'],
      },
    },
  },
  required: ['questions'] as const,
}

// ---------------------------------------------------------------------------
// Few-Shot Examples
// ---------------------------------------------------------------------------

const REMEMBER_EXAMPLES = `Example 1 (multiple-choice):
{
  "text": "What is the default port number for HTTP?",
  "type": "multiple-choice",
  "options": ["80", "443", "8080", "3000"],
  "correctAnswer": "80",
  "explanation": "HTTP uses port 80 by default, while HTTPS uses port 443.",
  "bloomsLevel": "remember"
}

Example 2 (true-false):
{
  "text": "TCP is a connectionless protocol.",
  "type": "true-false",
  "options": ["True", "False"],
  "correctAnswer": "False",
  "explanation": "TCP is connection-oriented. UDP is the connectionless protocol.",
  "bloomsLevel": "remember"
}`

const UNDERSTAND_EXAMPLES = `Example 1 (multiple-choice):
{
  "text": "Why does a web browser send a SYN packet before transmitting data?",
  "type": "multiple-choice",
  "options": [
    "To establish a TCP connection via the three-way handshake",
    "To encrypt the data channel",
    "To verify the server's SSL certificate",
    "To request the server's IP address"
  ],
  "correctAnswer": "To establish a TCP connection via the three-way handshake",
  "explanation": "The SYN packet initiates TCP's three-way handshake, which must complete before data can flow.",
  "bloomsLevel": "understand"
}

Example 2 (fill-in-blank):
{
  "text": "The process of converting a domain name to an IP address is called ___.",
  "type": "fill-in-blank",
  "correctAnswer": "DNS resolution",
  "explanation": "DNS resolution translates human-readable domain names into machine-readable IP addresses.",
  "bloomsLevel": "understand"
}`

const APPLY_EXAMPLES = `Example 1 (multiple-choice):
{
  "text": "A developer needs to send real-time stock price updates to connected clients. Which protocol is most appropriate?",
  "type": "multiple-choice",
  "options": ["HTTP polling", "WebSocket", "FTP", "SMTP"],
  "correctAnswer": "WebSocket",
  "explanation": "WebSocket provides full-duplex communication, ideal for real-time data streaming without the overhead of repeated HTTP requests.",
  "bloomsLevel": "apply"
}

Example 2 (true-false):
{
  "text": "Using localStorage to store JWT tokens is a secure practice for production web applications.",
  "type": "true-false",
  "options": ["True", "False"],
  "correctAnswer": "False",
  "explanation": "localStorage is vulnerable to XSS attacks. HttpOnly cookies are more secure for storing authentication tokens.",
  "bloomsLevel": "apply"
}`

const LEVEL_EXAMPLES: Record<BloomsLevel, string> = {
  remember: REMEMBER_EXAMPLES,
  understand: UNDERSTAND_EXAMPLES,
  apply: APPLY_EXAMPLES,
}

const LEVEL_INSTRUCTIONS: Record<BloomsLevel, string> = {
  remember:
    'Generate RECALL questions that test factual knowledge. Ask "what is", "which", "name", "define", "list" style questions. Test whether the learner can retrieve specific facts from the content.',
  understand:
    'Generate COMPREHENSION questions that test understanding of concepts. Ask "why", "explain", "compare", "what happens when" style questions. Test whether the learner grasps the meaning behind the facts.',
  apply:
    'Generate APPLICATION questions that test ability to use knowledge in new situations. Present scenarios and ask the learner to choose the best approach, tool, or solution. Test whether the learner can transfer knowledge to practical problems.',
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for quiz generation.
 *
 * @param bloomsLevel - Target Bloom's taxonomy level
 * @returns System prompt string with level instructions and examples
 */
function buildSystemPrompt(bloomsLevel: BloomsLevel): string {
  return `You are a quiz question generator for an e-learning platform. Your job is to create high-quality quiz questions from lesson transcript content.

INSTRUCTIONS:
- ${LEVEL_INSTRUCTIONS[bloomsLevel]}
- Generate a mix of question types: multiple-choice, true-false, and fill-in-blank
- For multiple-choice: provide exactly 4 options, one correct answer
- For true-false: provide exactly ["True", "False"] as options
- For fill-in-blank: do NOT include options, only the correct answer
- Every question must have a clear, educational explanation
- Questions must be directly based on the provided transcript content
- Do not invent facts not present in the transcript
- Set bloomsLevel to "${bloomsLevel}" for all questions

${LEVEL_EXAMPLES[bloomsLevel]}

Return a JSON object with a "questions" array. Each question must have: text, type, options (except fill-in-blank), correctAnswer, explanation, bloomsLevel.`
}

/**
 * Build the complete prompt pair for quiz generation.
 *
 * @param chunk - Transcript text chunk to generate questions from
 * @param bloomsLevel - Target Bloom's taxonomy level
 * @param questionCount - Number of questions to generate (3-5)
 * @returns Object with systemPrompt and userPrompt
 */
export function buildQuizPrompt(
  chunk: { text: string; topic?: string },
  bloomsLevel: BloomsLevel,
  questionCount: number = 4
): { systemPrompt: string; userPrompt: string } {
  const clampedCount = Math.max(3, Math.min(5, questionCount))

  const topicLine = chunk.topic ? `\nTopic: ${chunk.topic}` : ''

  const userPrompt = `Generate exactly ${clampedCount} quiz questions from the following lesson transcript excerpt.${topicLine}

Transcript:
"""
${chunk.text}
"""`

  return {
    systemPrompt: buildSystemPrompt(bloomsLevel),
    userPrompt,
  }
}
