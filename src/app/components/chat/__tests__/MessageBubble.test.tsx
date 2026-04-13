/**
 * Tests for MessageBubble (E72-S02, AC9)
 *
 * Coverage:
 * - Renders user messages right-aligned
 * - Renders assistant messages left-aligned
 * - Mode badge shown on assistant messages when showModeBadge=true and mode is set
 * - Mode badge not shown for user messages
 * - Mode badge not shown when showModeBadge=false
 * - Mode badge not shown when message has no mode field
 * - All mode labels render correctly
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ChatMessage } from '@/ai/rag/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = new Date('2026-04-13T12:00:00.000Z').getTime()

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello, how can I help you?',
    timestamp: FIXED_TIMESTAMP,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageBubble', () => {
  describe('role-based rendering', () => {
    it('renders user messages with user avatar', () => {
      render(<MessageBubble message={makeMessage({ role: 'user', content: 'Hello' })} />)
      expect(screen.getByRole('img', { name: 'You' })).toBeInTheDocument()
    })

    it('renders assistant messages with AI avatar', () => {
      render(<MessageBubble message={makeMessage({ role: 'assistant', content: 'Hi there' })} />)
      expect(screen.getByRole('img', { name: 'AI Assistant' })).toBeInTheDocument()
    })
  })

  describe('mode badge (E72-S02, AC9)', () => {
    it('shows mode label badge for assistant messages when showModeBadge=true and mode is set', () => {
      const message = makeMessage({ role: 'assistant', mode: 'quiz' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      // Mode label "Quiz" should appear in the timestamp area
      expect(screen.getByText(/Quiz/)).toBeInTheDocument()
    })

    it('shows socratic mode label when mode is socratic', () => {
      const message = makeMessage({ role: 'assistant', mode: 'socratic' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      expect(screen.getByText(/Socratic/)).toBeInTheDocument()
    })

    it('shows explain mode label when mode is explain', () => {
      const message = makeMessage({ role: 'assistant', mode: 'explain' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      expect(screen.getByText(/Explain/)).toBeInTheDocument()
    })

    it('shows eli5 mode label when mode is eli5', () => {
      const message = makeMessage({ role: 'assistant', mode: 'eli5' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      expect(screen.getByText(/ELI5/)).toBeInTheDocument()
    })

    it('shows debug mode label when mode is debug', () => {
      const message = makeMessage({ role: 'assistant', mode: 'debug' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      expect(screen.getByText(/Debug/)).toBeInTheDocument()
    })

    it('does not show mode badge when showModeBadge=false (default)', () => {
      const message = makeMessage({ role: 'assistant', mode: 'quiz' })
      render(<MessageBubble message={message} />)

      // Should show timestamp but not mode label in the badge area
      // Mode label "Quiz" should not appear since showModeBadge defaults to false
      expect(screen.queryByText(/Quiz/)).not.toBeInTheDocument()
    })

    it('does not show mode badge for user messages even when showModeBadge=true', () => {
      const message = makeMessage({ role: 'user', mode: 'quiz', content: 'My answer' })
      render(<MessageBubble message={message} showModeBadge={true} />)

      // The mode badge conditional only applies to assistant messages
      expect(screen.queryByText(/Quiz/)).not.toBeInTheDocument()
    })

    it('does not show mode badge when assistant message has no mode field', () => {
      const message = makeMessage({ role: 'assistant' }) // no mode
      render(<MessageBubble message={message} showModeBadge={true} />)

      // Without a mode field, the badge area should not contain mode labels
      expect(screen.queryByText(/Socratic|Explain|Quiz|ELI5|Debug/)).not.toBeInTheDocument()
    })
  })

  describe('streaming state', () => {
    it('renders content without spinner when not streaming', () => {
      render(<MessageBubble message={makeMessage()} />)
      expect(screen.queryByRole('img', { name: /loading/i })).not.toBeInTheDocument()
    })
  })

  describe('error rendering', () => {
    it('shows error message when message has error field', () => {
      const message = makeMessage({ error: 'Something went wrong' })
      render(<MessageBubble message={message} />)

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })
})
