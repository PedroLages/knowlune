import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { VideoReorderList } from '../VideoReorderList'
import type { ImportedVideo } from '@/data/types'
import type { DragEndEvent } from '@dnd-kit/core'

// Hoisted mocks — safe to reference inside vi.mock factories
const { mockDbUpdate, mockTransaction, mockPersistWithRetry, mockToastError } = vi.hoisted(() => ({
  mockDbUpdate: vi.fn().mockResolvedValue(1),
  mockTransaction: vi.fn((_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
  mockPersistWithRetry: vi.fn((fn: () => Promise<void>) => fn()),
  mockToastError: vi.fn(),
}))

// Capture the onDragEnd callback passed to DndContext so we can invoke it in tests
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode
      onDragEnd?: (event: DragEndEvent) => void
    }) => {
      capturedOnDragEnd = onDragEnd ?? null
      return <div data-testid="dnd-context">{children}</div>
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useSensor: actual.useSensor,
    useSensors: actual.useSensors,
    PointerSensor: actual.PointerSensor,
    KeyboardSensor: actual.KeyboardSensor,
    closestCenter: actual.closestCenter,
  }
})

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable')
  return {
    ...actual,
    useSortable: ({ id }: { id: string }) => ({
      attributes: { role: 'button', tabIndex: 0, 'aria-roledescription': 'sortable' },
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
      id,
    }),
  }
})

vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      update: mockDbUpdate,
    },
    transaction: mockTransaction,
  },
}))

vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (fn: () => Promise<void>) => mockPersistWithRetry(fn),
}))

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}))

let videoCounter = 0

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  videoCounter += 1
  return {
    id: `video-${videoCounter}`,
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

beforeEach(() => {
  videoCounter = 0
  capturedOnDragEnd = null
  mockDbUpdate.mockClear().mockResolvedValue(1)
  mockTransaction
    .mockClear()
    .mockImplementation((_mode: string, _table: unknown, fn: () => Promise<void>) => fn())
  mockPersistWithRetry.mockClear().mockImplementation((fn: () => Promise<void>) => fn())
  mockToastError.mockClear()
})

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

  it('renders listitem role on each video row', () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1 }),
    ]

    render(<VideoReorderList videos={videos} onReorder={vi.fn()} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
  })

  it('calls onReorder with new order when drag completes', async () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1 }),
      makeVideo({ id: 'v3', filename: 'lesson-3.mp4', order: 2 }),
    ]
    const onReorder = vi.fn()

    render(<VideoReorderList videos={videos} onReorder={onReorder} />)

    expect(capturedOnDragEnd).not.toBeNull()

    // Simulate dragging v1 to v3's position
    await act(async () => {
      capturedOnDragEnd!({
        active: { id: 'v1' },
        over: { id: 'v3' },
      } as unknown as DragEndEvent)
    })

    // onReorder should be called with reordered array (v1 moved after v3)
    expect(onReorder).toHaveBeenCalledTimes(1)
    const reordered = onReorder.mock.calls[0][0]
    expect(reordered[0].id).toBe('v2')
    expect(reordered[1].id).toBe('v3')
    expect(reordered[2].id).toBe('v1')
    // Order properties should be updated
    expect(reordered[0].order).toBe(0)
    expect(reordered[1].order).toBe(1)
    expect(reordered[2].order).toBe(2)
  })

  it('does not call onReorder when dragged to same position', async () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1 }),
    ]
    const onReorder = vi.fn()

    render(<VideoReorderList videos={videos} onReorder={onReorder} />)

    await act(async () => {
      capturedOnDragEnd!({
        active: { id: 'v1' },
        over: { id: 'v1' },
      } as unknown as DragEndEvent)
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('rolls back and shows toast on persist failure', async () => {
    const videos = [
      makeVideo({ id: 'v1', filename: 'lesson-1.mp4', order: 0 }),
      makeVideo({ id: 'v2', filename: 'lesson-2.mp4', order: 1 }),
    ]
    const onReorder = vi.fn()

    // Make persist fail
    mockPersistWithRetry.mockRejectedValueOnce(new Error('IndexedDB write failed'))

    render(<VideoReorderList videos={videos} onReorder={onReorder} />)

    await act(async () => {
      capturedOnDragEnd!({
        active: { id: 'v1' },
        over: { id: 'v2' },
      } as unknown as DragEndEvent)
    })

    // First call: optimistic update with new order
    expect(onReorder).toHaveBeenCalledTimes(2)
    const optimisticUpdate = onReorder.mock.calls[0][0]
    expect(optimisticUpdate[0].id).toBe('v2')
    expect(optimisticUpdate[1].id).toBe('v1')

    // Second call: rollback to original order
    const rollback = onReorder.mock.calls[1][0]
    expect(rollback[0].id).toBe('v1')
    expect(rollback[1].id).toBe('v2')

    // Toast error should be shown
    expect(mockToastError).toHaveBeenCalledWith('Failed to save video order. Please try again.')
  })
})
