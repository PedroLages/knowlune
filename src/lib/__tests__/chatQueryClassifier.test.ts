/**
 * Tests for Chat Query Classifier
 *
 * Covers all routing categories and edge cases as specified in the plan.
 * The classifier is a pure function with no dependencies, making it
 * straightforward to test in isolation.
 */

import { describe, it, expect } from 'vitest'
import { classifyQuery, buildMetaResponse } from '@/lib/chatQueryClassifier'

describe('classifyQuery', () => {
  describe('greetings', () => {
    it('classifies "Hi" as greeting', () => {
      expect(classifyQuery('Hi')).toBe('greeting')
    })

    it('classifies "Hello there!" as greeting', () => {
      expect(classifyQuery('Hello there!')).toBe('greeting')
    })

    it('classifies "Hey" as greeting', () => {
      expect(classifyQuery('Hey')).toBe('greeting')
    })

    it('classifies "Good morning" as greeting', () => {
      expect(classifyQuery('Good morning')).toBe('greeting')
    })

    it('classifies "Good afternoon" as greeting', () => {
      expect(classifyQuery('Good afternoon')).toBe('greeting')
    })

    it('classifies "Good evening" as greeting', () => {
      expect(classifyQuery('Good evening')).toBe('greeting')
    })

    it('classifies "Thanks" as greeting', () => {
      expect(classifyQuery('Thanks')).toBe('greeting')
    })

    it('classifies "Thank you" as greeting', () => {
      expect(classifyQuery('Thank you')).toBe('greeting')
    })

    it('classifies "Bye" as greeting', () => {
      expect(classifyQuery('Bye')).toBe('greeting')
    })

    it('classifies "see you" as greeting', () => {
      expect(classifyQuery('see you')).toBe('greeting')
    })
  })

  describe('meta questions', () => {
    it('classifies "Do I have any notes?" as meta', () => {
      expect(classifyQuery('Do I have any notes?')).toBe('meta')
    })

    it('classifies "What can I ask you about?" as meta', () => {
      expect(classifyQuery('What can I ask you about?')).toBe('meta')
    })

    it('classifies "How many notes do I have?" as meta', () => {
      expect(classifyQuery('How many notes do I have?')).toBe('meta')
    })

    it('classifies "what topics have I studied" as meta', () => {
      expect(classifyQuery('what topics have I studied')).toBe('meta')
    })

    it('classifies "Show me my notes" as meta', () => {
      expect(classifyQuery('Show me my notes')).toBe('meta')
    })

    it('classifies "What does this do?" as meta', () => {
      expect(classifyQuery('What does this do?')).toBe('meta')
    })

    it('classifies "How does this work?" as meta', () => {
      expect(classifyQuery('How does this work?')).toBe('meta')
    })

    it('classifies "list all notes" as meta', () => {
      expect(classifyQuery('list all notes')).toBe('meta')
    })

    it('classifies "Do I have notes" (without "any") as meta', () => {
      expect(classifyQuery('Do I have notes')).toBe('meta')
    })

    it('classifies "What can I ask" as meta', () => {
      expect(classifyQuery('What can I ask')).toBe('meta')
    })
  })

  describe('search queries', () => {
    it('classifies "Explain React hooks" as search', () => {
      expect(classifyQuery('Explain React hooks')).toBe('search')
    })

    it('classifies "What did I write about closures?" as search', () => {
      expect(classifyQuery('What did I write about closures?')).toBe('search')
    })

    it('classifies empty string as search', () => {
      expect(classifyQuery('')).toBe('search')
    })

    it('classifies whitespace-only as search', () => {
      expect(classifyQuery('   ')).toBe('search')
    })

    it('classifies "Hi, what do I know about JavaScript?" as search (search terms dominate)', () => {
      expect(classifyQuery('Hi, what do I know about JavaScript?')).toBe('search')
    })

    it('classifies a specific question as search', () => {
      expect(classifyQuery('What is the difference between let and const?')).toBe('search')
    })

    it('classifies a complex topic question as search', () => {
      expect(classifyQuery('Can you explain how closures work in JavaScript?')).toBe('search')
    })
  })
})

describe('buildMetaResponse', () => {
  it('builds correct response with notes and courses', () => {
    const result = buildMetaResponse(15, 3, ['React Basics', 'JavaScript Fundamentals', 'CSS Grid'])
    expect(result).toContain('15 notes')
    expect(result).toContain('3 courses')
    expect(result).toContain('React Basics')
    expect(result).toContain('JavaScript Fundamentals')
    expect(result).toContain('CSS Grid')
  })

  it('handles singular note count', () => {
    const result = buildMetaResponse(1, 1, ['React Basics'])
    expect(result).toContain('1 note')
  })

  it('truncates course list at 5 with "and N more"', () => {
    const courses = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const result = buildMetaResponse(20, 7, courses)
    expect(result).toContain('and 2 more')
  })

  it('handles empty course names gracefully', () => {
    const result = buildMetaResponse(0, 0, [])
    expect(result).toContain('0 notes')
    expect(result).toContain('various courses')
  })
})
