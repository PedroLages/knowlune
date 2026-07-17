import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoBookmark } from '@/data/types'

const {
  mockGetLessonBookmarks,
  mockDeleteBookmark,
  mockAddBookmark,
  mockRestoreBookmark,
  mockToastWithUndo,
} = vi.hoisted(() => ({
  mockGetLessonBookmarks: vi.fn(),
  mockDeleteBookmark: vi.fn(),
  mockAddBookmark: vi.fn(),
  mockRestoreBookmark: vi.fn(),
  mockToastWithUndo: vi.fn(),
}))

vi.mock('@/lib/bookmarks', () => ({
  getLessonBookmarks: mockGetLessonBookmarks,
  deleteBookmark: mockDeleteBookmark,
  addBookmark: mockAddBookmark,
  restoreBookmark: mockRestoreBookmark,
  formatBookmarkTimestamp: (seconds: number) => `0:${seconds.toString().padStart(2, '0')}`,
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastWithUndo: mockToastWithUndo,
  toastError: { deleteFailed: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { LessonBookmarksTab } from '@/app/components/course/tabs/LessonBookmarksTab'

const BOOKMARK: VideoBookmark = {
  id: 'bookmark-1',
  courseId: 'course-1',
  lessonId: 'lesson-1',
  timestamp: 42,
  label: 'Important point',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetLessonBookmarks.mockResolvedValue([BOOKMARK])
  mockDeleteBookmark.mockResolvedValue(undefined)
  mockRestoreBookmark.mockResolvedValue(BOOKMARK)
})

describe('LessonBookmarksTab', () => {
  it('restores the original ID and can delete the restored bookmark again', async () => {
    render(<LessonBookmarksTab courseId="course-1" lessonId="lesson-1" />)
    await screen.findByText('Important point')

    fireEvent.click(screen.getByRole('button', { name: 'Delete bookmark' }))
    await waitFor(() => expect(mockDeleteBookmark).toHaveBeenCalledWith('bookmark-1'))

    const undo = mockToastWithUndo.mock.calls[0][0].onUndo as () => Promise<void>
    await act(async () => undo())

    expect(mockRestoreBookmark).toHaveBeenCalledWith(BOOKMARK)
    expect(await screen.findByText('Important point')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete bookmark' }))
    await waitFor(() => expect(mockDeleteBookmark).toHaveBeenCalledTimes(2))
    expect(mockDeleteBookmark).toHaveBeenLastCalledWith('bookmark-1')
  })

  it('clears a previous error when another lesson loads successfully', async () => {
    mockGetLessonBookmarks.mockRejectedValueOnce(new Error('load failed'))
    const { rerender } = render(<LessonBookmarksTab courseId="course-1" lessonId="lesson-1" />)
    expect(await screen.findByText('Failed to load bookmarks')).toBeInTheDocument()

    mockGetLessonBookmarks.mockResolvedValueOnce([])
    rerender(<LessonBookmarksTab courseId="course-1" lessonId="lesson-2" />)

    expect(await screen.findByText('No bookmarks yet')).toBeInTheDocument()
    expect(screen.queryByText('Failed to load bookmarks')).not.toBeInTheDocument()
  })
})
