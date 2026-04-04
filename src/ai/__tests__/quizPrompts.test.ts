/**
 * Unit Tests: quizPrompts.ts
 *
 * Tests Bloom's Taxonomy prompt construction and schema validation.
 */

import { describe, it, expect } from 'vitest'
import {
  buildQuizPrompt,
  QuizResponseSchema,
  GeneratedQuestionSchema,
  QUIZ_RESPONSE_SCHEMA,
  type BloomsLevel,
} from '../quizPrompts'

describe('buildQuizPrompt', () => {
  const chunk = { text: 'React uses a virtual DOM for efficient rendering.', topic: 'React Basics' }

  it('returns systemPrompt and userPrompt', () => {
    const result = buildQuizPrompt(chunk, 'remember')
    expect(result.systemPrompt).toContain('quiz question generator')
    expect(result.userPrompt).toContain('React uses a virtual DOM')
    expect(result.userPrompt).toContain('React Basics')
  })

  it.each<BloomsLevel>(['remember', 'understand', 'apply'])(
    'includes level-specific instructions for %s',
    level => {
      const result = buildQuizPrompt(chunk, level)
      expect(result.systemPrompt).toContain(`"${level}"`)
    }
  )

  it('includes few-shot examples in system prompt', () => {
    const result = buildQuizPrompt(chunk, 'remember')
    expect(result.systemPrompt).toContain('Example 1')
    expect(result.systemPrompt).toContain('Example 2')
  })

  it('clamps question count to 3-5', () => {
    const low = buildQuizPrompt(chunk, 'remember', 1)
    expect(low.userPrompt).toContain('exactly 3')

    const high = buildQuizPrompt(chunk, 'remember', 10)
    expect(high.userPrompt).toContain('exactly 5')

    const normal = buildQuizPrompt(chunk, 'remember', 4)
    expect(normal.userPrompt).toContain('exactly 4')
  })

  it('omits topic line when no topic provided', () => {
    const result = buildQuizPrompt({ text: 'Some content' }, 'remember')
    expect(result.userPrompt).not.toContain('Topic:')
  })
})

describe('QuizResponseSchema', () => {
  it('validates a correct quiz response', () => {
    const valid = {
      questions: [
        {
          text: 'What is React?',
          type: 'multiple-choice',
          options: ['A library', 'A framework', 'A language', 'A database'],
          correctAnswer: 'A library',
          explanation: 'React is a JavaScript library for building UIs.',
          bloomsLevel: 'remember',
        },
      ],
    }
    const result = QuizResponseSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects empty questions array', () => {
    const result = QuizResponseSchema.safeParse({ questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = QuizResponseSchema.safeParse({
      questions: [{ text: 'Q?' }],
    })
    expect(result.success).toBe(false)
  })

  it('validates fill-in-blank without options', () => {
    const valid = {
      questions: [
        {
          text: 'The ___ pattern is used in React.',
          type: 'fill-in-blank',
          correctAnswer: 'component',
          explanation: 'React uses a component-based architecture.',
          bloomsLevel: 'understand',
        },
      ],
    }
    const result = QuizResponseSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})

describe('GeneratedQuestionSchema', () => {
  it('validates a true-false question', () => {
    const result = GeneratedQuestionSchema.safeParse({
      text: 'React is a framework.',
      type: 'true-false',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'React is a library, not a framework.',
      bloomsLevel: 'remember',
    })
    expect(result.success).toBe(true)
  })
})

describe('QUIZ_RESPONSE_SCHEMA', () => {
  it('has the expected structure for Ollama format parameter', () => {
    expect(QUIZ_RESPONSE_SCHEMA.type).toBe('object')
    expect(QUIZ_RESPONSE_SCHEMA.required).toContain('questions')
    expect(QUIZ_RESPONSE_SCHEMA.properties.questions.type).toBe('array')
  })
})
