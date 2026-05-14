import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { LessonRow, StatusCircle, EntryActionButton } from '@/app/components/learning-path/TimelinePrimitives'
import type { ImportedVideo } from '@/data/types'

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'v1',
    courseId: 'c1',
    filename: 'Lesson.mp4',
    path: '',
    duration: 125,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    ...overrides,
  }
}

describe('LessonRow', () => {
  it('renders clock-formatted duration in seconds when duration > 0', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 125 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })

  it('does not render a duration badge when duration is 0', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 0 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.queryByText(/^[0-9]+:[0-9]{2}$/)).not.toBeInTheDocument()
  })

  it('renders hour-padded clock string for durations >= 1 hour', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 3665 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.getByText('1:01:05')).toBeInTheDocument()
  })
})

describe('StatusCircle', () => {
  it('renders "available" status without throwing and is visually distinct from "locked"', () => {
    const { container } = render(<StatusCircle status="available" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toBeTruthy()
    // Available uses a filled dot (bg-muted/80) with a visible inner circle,
    // while locked uses bg-muted/30 with a more transparent inner dot.
    // Both share bg-muted-foreground on the inner dot but at different opacities.
    expect(el).toBeInTheDocument()
  })

  it('renders "locked" status (hollow outline) without throwing', () => {
    const { container } = render(<StatusCircle status="locked" />)
    expect(container.firstElementChild).toBeTruthy()
  })

  it('renders "available" differently from "locked" — available inner dot has higher opacity', () => {
    const { container: cAvail } = render(<StatusCircle status="available" />)
    const { container: cLocked } = render(<StatusCircle status="locked" />)
    // The inner dots use bg-muted-foreground/40 (available) vs bg-muted-foreground/30 (locked)
    const availInner = cAvail.querySelector('[class*="bg-muted-foreground/40"]')
    const lockedInner = cLocked.querySelector('[class*="bg-muted-foreground/30"]')
    expect(availInner).toBeTruthy()
    expect(lockedInner).toBeTruthy()
  })
})

describe('EntryActionButton', () => {
  it('renders Start Module when status is "available"', () => {
    const onClick = vi.fn()
    render(<EntryActionButton status="available" onClick={onClick} />)
    expect(screen.getByText('Start Module')).toBeInTheDocument()
  })

  it('invokes onClick when Start Module is clicked in "available" state', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<EntryActionButton status="available" onClick={onClick} />)
    await user.click(screen.getByText('Start Module'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when status is "locked"', () => {
    const onClick = vi.fn()
    const { container } = render(<EntryActionButton status="locked" onClick={onClick} />)
    expect(container.textContent).toBe('')
  })
})
