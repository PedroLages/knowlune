/**
 * Unit tests for E73-S05 Conversation History components
 *
 * Coverage:
 * - isConversationStale: stale >5min, not stale <5min
 * - ConversationHistorySheet grouping: thisLesson vs otherLessons
 * - ConversationHistorySheet empty state
 * - ContinueConversationPrompt renders when stale conversation exists
 * - Keyboard shortcuts: Cmd+1 → socratic, Cmd+2 → explain, etc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { isConversationStale } from '../ContinueConversationPrompt'
import { ConversationHistorySheet } from '../ConversationHistorySheet'
import { ContinueConversationPrompt } from '../ContinueConversationPrompt'
import { useTutorKeyboardShortcuts } from '../useTutorKeyboardShortcuts'
import type { ChatConversation } from '@/data/types'
import { renderHook } from '@testing-library/react'

const FIXED_DATE = new Date('2026-01-15T12:00:00Z')
const FIXED_MS = FIXED_DATE.getTime()

// Mock Dexie/db
vi.mock('@/db', () => ({
  db: {
    chatConversations: {
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

function makeConversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: 'conv-1',
    courseId: 'course-1',
    videoId: 'video-1',
    mode: 'socratic',
    messages: [],
    createdAt: FIXED_MS - 10 * 60 * 1000, // 10 min ago
    updatedAt: FIXED_MS - 10 * 60 * 1000,
    ...overrides,
  }
}

// ------- isConversationStale -------

describe('isConversationStale', () => {
  it('returns true when conversation is older than 5 minutes', () => {
    const staleAt = FIXED_MS - 6 * 60 * 1000 // 6 minutes ago
    expect(isConversationStale(staleAt, FIXED_MS)).toBe(true)
  })

  it('returns false when conversation is less than 5 minutes old', () => {
    const recentAt = FIXED_MS - 2 * 60 * 1000 // 2 minutes ago
    expect(isConversationStale(recentAt, FIXED_MS)).toBe(false)
  })

  it('returns false when updatedAt equals now (0 seconds old)', () => {
    expect(isConversationStale(FIXED_MS, FIXED_MS)).toBe(false)
  })
})

// ------- ConversationHistorySheet -------

describe('ConversationHistorySheet', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    conversations: [],
    currentLessonId: 'video-1',
    courseId: 'course-1',
    onContinue: vi.fn(),
    onDelete: vi.fn(),
  }

  it('renders empty state when no conversations', () => {
    render(<ConversationHistorySheet {...defaultProps} />)
    expect(screen.getByText(/no past conversations yet/i)).toBeInTheDocument()
  })

  it('groups conversations for same lesson under "This Lesson"', () => {
    const conv = makeConversation({ id: 'conv-a', courseId: 'course-1', videoId: 'video-1' })
    render(<ConversationHistorySheet {...defaultProps} conversations={[conv]} />)
    expect(screen.getByText(/this lesson/i)).toBeInTheDocument()
    expect(screen.queryByText(/other lessons/i)).not.toBeInTheDocument()
  })

  it('groups conversations for different lesson under "Other Lessons in Course"', () => {
    const conv = makeConversation({ id: 'conv-b', courseId: 'course-1', videoId: 'video-2' })
    render(<ConversationHistorySheet {...defaultProps} conversations={[conv]} />)
    expect(screen.getByText(/other lessons in course/i)).toBeInTheDocument()
    expect(screen.queryByText(/this lesson/i)).not.toBeInTheDocument()
  })

  it('shows both sections when conversations span current and other lessons', () => {
    const thisConv = makeConversation({ id: 'conv-this', courseId: 'course-1', videoId: 'video-1' })
    const otherConv = makeConversation({ id: 'conv-other', courseId: 'course-1', videoId: 'video-2' })
    render(<ConversationHistorySheet {...defaultProps} conversations={[thisConv, otherConv]} />)
    expect(screen.getByText(/this lesson/i)).toBeInTheDocument()
    expect(screen.getByText(/other lessons in course/i)).toBeInTheDocument()
  })
})

// ------- ContinueConversationPrompt -------

describe('ContinueConversationPrompt', () => {
  const baseProps = {
    conversation: makeConversation({
      messages: [
        { id: 'm1', role: 'user' as const, content: 'Hello', timestamp: FIXED_MS, mode: 'socratic' as const },
      ],
    }),
    onContinue: vi.fn(),
    onStartFresh: vi.fn(),
  }

  it('renders the continue prompt with conversation details', () => {
    render(<ContinueConversationPrompt {...baseProps} />)
    expect(screen.getByTestId('continue-conversation-prompt')).toBeInTheDocument()
    expect(screen.getByTestId('continue-prev-btn')).toBeInTheDocument()
    expect(screen.getByTestId('start-fresh-btn')).toBeInTheDocument()
  })

  it('calls onContinue when Continue button is clicked', async () => {
    const onContinue = vi.fn()
    render(<ContinueConversationPrompt {...baseProps} onContinue={onContinue} />)
    fireEvent.click(screen.getByTestId('continue-prev-btn'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('calls onStartFresh when Start Fresh button is clicked', async () => {
    const onStartFresh = vi.fn()
    render(<ContinueConversationPrompt {...baseProps} onStartFresh={onStartFresh} />)
    fireEvent.click(screen.getByTestId('start-fresh-btn'))
    expect(onStartFresh).toHaveBeenCalledTimes(1)
  })
})

// ------- useTutorKeyboardShortcuts -------

describe('useTutorKeyboardShortcuts', () => {
  let onToggleHistory: ReturnType<typeof vi.fn>
  let onToggleMemory: ReturnType<typeof vi.fn>
  let onSwitchMode: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onToggleHistory = vi.fn()
    onToggleMemory = vi.fn()
    onSwitchMode = vi.fn()
    // Stub window.innerWidth to desktop so touch-device guard doesn't fire
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    Object.defineProperty(window, 'ontouchstart', { writable: true, configurable: true, value: undefined })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function setup() {
    return renderHook(() =>
      useTutorKeyboardShortcuts({ onToggleHistory, onToggleMemory, onSwitchMode })
    )
  }

  it('Cmd+H calls onToggleHistory', () => {
    setup()
    fireEvent.keyDown(document, { key: 'h', metaKey: true })
    expect(onToggleHistory).toHaveBeenCalledTimes(1)
  })

  it('Cmd+M calls onToggleMemory', () => {
    setup()
    fireEvent.keyDown(document, { key: 'm', metaKey: true })
    expect(onToggleMemory).toHaveBeenCalledTimes(1)
  })

  it('Cmd+1 calls onSwitchMode with "socratic"', () => {
    setup()
    fireEvent.keyDown(document, { key: '1', metaKey: true })
    expect(onSwitchMode).toHaveBeenCalledWith('socratic')
  })

  it('Cmd+2 calls onSwitchMode with "explain"', () => {
    setup()
    fireEvent.keyDown(document, { key: '2', metaKey: true })
    expect(onSwitchMode).toHaveBeenCalledWith('explain')
  })

  it('Cmd+3 calls onSwitchMode with "eli5"', () => {
    setup()
    fireEvent.keyDown(document, { key: '3', metaKey: true })
    expect(onSwitchMode).toHaveBeenCalledWith('eli5')
  })

  it('Cmd+4 calls onSwitchMode with "quiz"', () => {
    setup()
    fireEvent.keyDown(document, { key: '4', metaKey: true })
    expect(onSwitchMode).toHaveBeenCalledWith('quiz')
  })

  it('Cmd+5 calls onSwitchMode with "debug"', () => {
    setup()
    fireEvent.keyDown(document, { key: '5', metaKey: true })
    expect(onSwitchMode).toHaveBeenCalledWith('debug')
  })

  it('does not fire when disabled=true', () => {
    renderHook(() =>
      useTutorKeyboardShortcuts({ onToggleHistory, onToggleMemory, onSwitchMode, disabled: true })
    )
    fireEvent.keyDown(document, { key: '1', metaKey: true })
    expect(onSwitchMode).not.toHaveBeenCalled()
  })
})
