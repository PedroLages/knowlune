/**
 * PromptBuilder unit tests
 */

import { describe, it, expect } from 'vitest'
import { PromptBuilder } from '../promptBuilder'
import type { RetrievedContext, ChatMessage } from '../types'

describe('PromptBuilder', () => {
  const builder = new PromptBuilder()

  const mockContext: RetrievedContext = {
    notes: [
      {
        noteId: 'note-1',
        content: 'React hooks are functions that let you use state.',
        videoId: 'video-1',
        videoFilename: 'intro-to-react.mp4',
        courseName: 'React Basics',
        score: 0.95,
      },
      {
        noteId: 'note-2',
        content: 'useState is the most commonly used hook.',
        videoId: 'video-2',
        videoFilename: 'hooks-deep-dive.mp4',
        courseName: 'Advanced React',
        score: 0.87,
      },
    ],
    query: 'What are React hooks?',
    embeddingTime: 10,
    searchTime: 50,
  }

  describe('build', () => {
    it('should build system prompt with context', () => {
      const prompt = builder.build('What are React hooks?', mockContext)

      expect(prompt).toContain('learning assistant')
      expect(prompt).toContain('[1] intro-to-react.mp4 — React Basics')
      expect(prompt).toContain('React hooks are functions')
      expect(prompt).toContain('[2] hooks-deep-dive.mp4 — Advanced React')
      expect(prompt).toContain('useState is the most commonly used')
    })

    it('should handle empty context', () => {
      const emptyContext: RetrievedContext = {
        ...mockContext,
        notes: [],
      }

      const prompt = builder.build('test query', emptyContext)

      expect(prompt).toContain('(No relevant notes found)')
    })

    it('should include citation instructions', () => {
      const prompt = builder.build('test query', mockContext)

      expect(prompt).toContain('Cite sources inline using [1], [2]')
      expect(prompt).toContain('Base your answer ONLY on these notes')
    })
  })

  describe('buildMessages', () => {
    it('should build messages array with system prompt', () => {
      const messages = builder.buildMessages('What are hooks?', mockContext)

      expect(messages).toHaveLength(2) // system + user
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toContain('learning assistant')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('What are hooks?')
    })

    it('should include conversation history', () => {
      const history: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is React?',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'React is a JavaScript library.',
          timestamp: Date.now(),
        },
      ]

      const messages = builder.buildMessages('Tell me more', mockContext, history)

      expect(messages).toHaveLength(4) // system + 2 history + user
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('What is React?')
      expect(messages[2].role).toBe('assistant')
      expect(messages[2].content).toBe('React is a JavaScript library.')
      expect(messages[3].role).toBe('user')
      expect(messages[3].content).toBe('Tell me more')
    })

    it('should filter out system messages from history', () => {
      const history: ChatMessage[] = [
        {
          id: '1',
          role: 'system',
          content: 'System message',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'user',
          content: 'User message',
          timestamp: Date.now(),
        },
      ]

      const messages = builder.buildMessages('New query', mockContext, history)

      expect(messages).toHaveLength(3) // system + 1 history (user only) + user
      expect(messages.every(m => m.content !== 'System message')).toBe(true)
    })
  })
})
