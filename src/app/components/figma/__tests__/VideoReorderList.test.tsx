import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoReorderList } from '../VideoReorderList'
import type { ImportedVideo } from '@/data/types'

vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      update: vi.fn().mockResolvedValue(1),
    },
    transaction: vi.fn((_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
  },
}))

vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (fn: () => Promise<void>) => fn(),
}))

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: `video-${Math.random().toString(36).slice(2, 6)}`,
    courseId: 'course-1',
    filename: 'video.mp4',
    path: '/videos/video.mp4',
    duration: 120,
    format: 'mp4',
    order: 0,
    fileHandle: {} as FileSystemFileHandle,
    ...overrides,
  }
}

describe('VideoReorderList', () => {
  it('renders empty state when no videos', () => {
    render(<VideoReorderList videos={[]} onReorder={vi.fn()} />)
    expect(screen.getByText('No videos in this course.')).toBeInTheDocument()
  })

  it('renders videos with order numbers and filenames', () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0, duration: 90 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1, duration: 180 }),
      makeVideo({ id: 'v3', filename: 'lesson-3.mp4', order: 2, duration: 0 }),
    ]

    render(<VideoReorderList videos={videos} onReorder={vi.fn()} />)

    expect(screen.getByTestId('video-reorder-list')).toBeInTheDocument()
    expect(screen.getByTestId('video-reorder-item-v1')).toBeInTheDocument()
    expect(screen.getByTestId('video-reorder-item-v2')).toBeInTheDocument()
    expect(screen.getByTestId('video-reorder-item-v3')).toBeInTheDocument()

    // Check filenames
    expect(screen.getByText('lesson-1.mp4')).toBeInTheDocument()
    expect(screen.getByText('lesson-2.mp4')).toBeInTheDocument()
    expect(screen.getByText('lesson-3.mp4')).toBeInTheDocument()

    // Check order numbers
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Check duration formatting (90s = 1:30, 180s = 3:00)
    expect(screen.getByText('1:30')).toBeInTheDocument()
    expect(screen.getByText('3:00')).toBeInTheDocument()
  })

  it('renders drag handles for each video', () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1 }),
    ]

    render(<VideoReorderList videos={videos} onReorder={vi.fn()} />)

    expect(screen.getByTestId('drag-handle-v1')).toBeInTheDocument()
    expect(screen.getByTestId('drag-handle-v2')).toBeInTheDocument()
    expect(screen.getByLabelText('Drag to reorder lesson-1.mp4')).toBeInTheDocument()
    expect(screen.getByLabelText('Drag to reorder lesson-2.mp4')).toBeInTheDocument()
  })
})
