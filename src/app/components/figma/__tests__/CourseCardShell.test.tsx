import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardCover, CoverProgressBar, PlayOverlay, CompletionOverlay } from '../CourseCardShell'

// ── CoverProgressBar ─────────────────────────────────────────────────

describe('CoverProgressBar', () => {
  it('renders a bar at the given width', () => {
    const { container } = render(<CoverProgressBar progress={60} />)
    const bar = container.querySelector('.bg-brand')
    expect(bar).not.toBeNull()
    expect((bar as HTMLElement).style.width).toBe('60%')
  })

  it('renders at 0% without being absent (keeps layout stable)', () => {
    const { container } = render(<CoverProgressBar progress={0} />)
    const bar = container.querySelector('.bg-brand')
    expect(bar).not.toBeNull()
    expect((bar as HTMLElement).style.width).toBe('0%')
  })

  it('clamps progress above 100 to 100%', () => {
    const { container } = render(<CoverProgressBar progress={150} />)
    const bar = container.querySelector('.bg-brand')
    expect(bar).not.toBeNull()
    expect((bar as HTMLElement).style.width).toBe('100%')
  })

  it('clamps progress below 0 to 0%', () => {
    const { container } = render(<CoverProgressBar progress={-10} />)
    const bar = container.querySelector('.bg-brand')
    expect(bar).not.toBeNull()
    expect((bar as HTMLElement).style.width).toBe('0%')
  })
})

// ── PlayOverlay ───────────────────────────────────────────────────────

describe('PlayOverlay', () => {
  it('is not rendered when show=false', () => {
    const { container } = render(
      <PlayOverlay show={false} onClick={vi.fn()} aria-label="Start studying" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders button with aria-label when show=true', () => {
    render(<PlayOverlay show={true} onClick={vi.fn()} aria-label='Start studying "My Course"' />)
    expect(screen.getByRole('button', { name: /Start studying/i })).toBeInTheDocument()
  })

  it('renders button with explicit type="button" to prevent form submission', () => {
    render(<PlayOverlay show={true} onClick={vi.fn()} aria-label="Start" />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls onClick and stops propagation when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const parentClick = vi.fn()

    render(
      <div onClick={parentClick}>
        <PlayOverlay show={true} onClick={onClick} aria-label="Start" />
      </div>
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('passes data-testid to the button', () => {
    render(
      <PlayOverlay
        show={true}
        onClick={vi.fn()}
        data-testid="start-course-btn"
        aria-label="Start"
      />
    )
    expect(screen.getByTestId('start-course-btn')).toBeInTheDocument()
  })
})

// ── CompletionOverlay ─────────────────────────────────────────────────

describe('CompletionOverlay', () => {
  it('is not rendered when show=false', () => {
    const { container } = render(<CompletionOverlay show={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders decorative overlay with aria-hidden when show=true', () => {
    const { container } = render(<CompletionOverlay show={true} />)
    const overlay = container.firstChild
    expect(overlay).not.toBeNull()
    expect((overlay as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  it('is pointer-events-none so card click passes through', () => {
    const { container } = render(<CompletionOverlay show={true} />)
    const overlay = container.firstChild
    expect(overlay).not.toBeNull()
    expect((overlay as HTMLElement).className).toContain('pointer-events-none')
  })
})

// ── CardCover ─────────────────────────────────────────────────────────

describe('CardCover', () => {
  it('renders children', () => {
    render(
      <CardCover heightClass="h-44">
        <img alt="thumbnail" src="/test.jpg" />
        <CoverProgressBar progress={50} />
      </CardCover>
    )
    expect(screen.getByAltText('thumbnail')).toBeInTheDocument()
  })

  it('has overflow-hidden to contain absolute children within rounded corners', () => {
    const { container } = render(
      <CardCover heightClass="h-44">
        <span>child</span>
      </CardCover>
    )
    const root = container.firstChild
    expect(root).not.toBeNull()
    expect((root as HTMLElement).className).toContain('overflow-hidden')
  })

  it('has rounded-2xl for frameless card aesthetic', () => {
    const { container } = render(
      <CardCover heightClass="h-44">
        <span />
      </CardCover>
    )
    const root = container.firstChild
    expect(root).not.toBeNull()
    expect((root as HTMLElement).className).toContain('rounded-2xl')
  })

  it('applies the provided heightClass', () => {
    const { container } = render(
      <CardCover heightClass="h-44">
        <span />
      </CardCover>
    )
    const root = container.firstChild
    expect(root).not.toBeNull()
    expect((root as HTMLElement).className).toContain('h-44')
  })
})
