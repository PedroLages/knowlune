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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { isConversationStale } from '../ContinueConversationPrompt'
import { ConversationHistorySheet } from '../ConversationHistorySheet'
import { ContinueConversationPrompt } from '../ContinueConversationPrompt'
import { useTutorKeyboardShortcuts } from '../useTutorKeyboardShortcuts'
import type { ChatConversation } from '@/data/types'
import { renderHook } from '@testing-library/react'
import { syncableWrite } from '@/lib/sync/syncableWrite'

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

// Mock the sync-aware write wrapper so ConversationHistorySheet.handleDelete
// resolves successfully and invokes the onDelete prop. Without this, the
// real syncableWrite tries to call db.table(...).delete(...) — which is not
// on the @/db mock — and the resulting throw is swallowed by handleDelete's
// try/catch, so onDelete is never reached.
vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: vi.fn().mockResolvedValue(undefined),
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
    hintLevel: 0,
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
        { role: 'user' as const, content: 'Hello', timestamp: FIXED_MS, mode: 'socratic' as const },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onToggleHistory: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onToggleMemory: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onSwitchMode: any

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

// ------- History button badge count -------

describe('History button badge count', () => {
  /**
   * GAP-09: Verify the badge shown on the history button reflects the
   * number of conversations for the current course.
   * The badge renders when conversationCount > 1 (per TutorChat.tsx L151).
   */

  function HistoryBadge({ conversations, courseId }: { conversations: ChatConversation[]; courseId: string }) {
    const conversationCount = conversations.filter(c => c.courseId === courseId).length
    return (
      <div data-testid="badge-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
        <button aria-label="Conversation history" data-testid="history-btn">H</button>
        {conversationCount > 1 && (
          <span
            data-testid="history-badge"
            aria-label={`${conversationCount} conversations`}
          >
            {conversationCount}
          </span>
        )}
      </div>
    )
  }

  it('shows badge with correct count when 3 conversations exist for the course', () => {
    const conversations = [
      makeConversation({ id: 'c1', courseId: 'course-1', videoId: 'video-1' }),
      makeConversation({ id: 'c2', courseId: 'course-1', videoId: 'video-2' }),
      makeConversation({ id: 'c3', courseId: 'course-1', videoId: 'video-3' }),
    ]
    render(<HistoryBadge conversations={conversations} courseId="course-1" />)
    const badge = screen.getByTestId('history-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('3')
    expect(badge).toHaveAccessibleName('3 conversations')
  })

  it('does not show badge when only 1 conversation exists', () => {
    const conversations = [
      makeConversation({ id: 'c1', courseId: 'course-1', videoId: 'video-1' }),
    ]
    render(<HistoryBadge conversations={conversations} courseId="course-1" />)
    expect(screen.queryByTestId('history-badge')).not.toBeInTheDocument()
  })

  it('only counts conversations for the matching courseId', () => {
    const conversations = [
      makeConversation({ id: 'c1', courseId: 'course-1', videoId: 'video-1' }),
      makeConversation({ id: 'c2', courseId: 'course-2', videoId: 'video-1' }),
      makeConversation({ id: 'c3', courseId: 'course-2', videoId: 'video-2' }),
    ]
    // Only 1 for course-1, so no badge
    render(<HistoryBadge conversations={conversations} courseId="course-1" />)
    expect(screen.queryByTestId('history-badge')).not.toBeInTheDocument()
  })
})

// ------- Delete conversation (AlertDialog) -------

describe('ConversationHistorySheet — delete conversation', () => {
  const onDelete = vi.fn()
  const onContinue = vi.fn()

  function renderSheet() {
    const conv = makeConversation({
      id: 'conv-del',
      courseId: 'course-1',
      videoId: 'video-1',
    })
    render(
      <ConversationHistorySheet
        open={true}
        onOpenChange={vi.fn()}
        conversations={[conv]}
        currentLessonId="video-1"
        courseId="course-1"
        onContinue={onContinue}
        onDelete={onDelete}
      />
    )
  }

  beforeEach(() => {
    onDelete.mockReset()
    onContinue.mockReset()
  })

  it('clicking Delete button shows AlertDialog confirmation', () => {
    renderSheet()
    const deleteBtn = screen.getByTestId('delete-conversation-btn')
    fireEvent.click(deleteBtn)
    expect(screen.getByText(/delete conversation\?/i)).toBeInTheDocument()
  })

  it('confirming AlertDialog calls the delete handler', async () => {
    renderSheet()
    fireEvent.click(screen.getByTestId('delete-conversation-btn'))
    // There may be multiple Delete buttons (trigger + action); pick the
    // AlertDialogAction (last in document order).
    const allDeleteBtns = screen.getAllByRole('button', { name: /^delete$/i })
    const confirmBtn = allDeleteBtns[allDeleteBtns.length - 1]
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1)
    })
    // Assert argument shape of the syncableWrite call so a contract
    // regression (e.g., passing the conversation object instead of the id)
    // fails the test even though the module is mocked. (ADV-05 from R1.)
    expect(vi.mocked(syncableWrite)).toHaveBeenCalledWith(
      'chatConversations',
      'delete',
      'conv-del',
    )
  })

  it('canceling AlertDialog does NOT call the delete handler', () => {
    renderSheet()
    fireEvent.click(screen.getByTestId('delete-conversation-btn'))
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    expect(onDelete).not.toHaveBeenCalled()
  })
})
