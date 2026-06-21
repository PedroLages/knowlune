import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PathCardHeader } from '../PathCardHeader'

describe('PathCardHeader', () => {
  it('uses preset gradient when coverPreset is set and there is no cover image', () => {
    const { container } = render(
      <PathCardHeader pathName="Any Name" completionPct={50} coverPreset="purple-indigo" />
    )

    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('from-purple-500')
    expect(header.className).toContain('to-indigo-700')
  })

  it('prefers preset over muted treatment when path is not started', () => {
    const { container } = render(
      <PathCardHeader pathName="New Path" completionPct={0} coverPreset="cyan-blue" />
    )

    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('from-cyan-400')
    expect(header.className).toContain('to-blue-600')
  })

  it('uses hash-based gradient when no preset and path has progress', () => {
    const { container } = render(<PathCardHeader pathName="Stable Name" completionPct={40} />)

    const header = container.firstChild as HTMLElement
    expect(header.className).toMatch(/bg-gradient-to-br/)
    expect(header.className).not.toContain('from-muted-foreground')
  })

  it('uses muted gradient when not started and no preset', () => {
    const { container } = render(<PathCardHeader pathName="Fresh" completionPct={0} />)

    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('from-muted-foreground')
  })

  it('ignores invalid preset keys and falls back to hash or muted', () => {
    const { container } = render(
      <PathCardHeader pathName="X" completionPct={10} coverPreset="not-a-real-preset" />
    )

    const header = container.firstChild as HTMLElement
    expect(header.className).toMatch(/bg-gradient-to-br/)
    expect(header.className).not.toContain('not-a-real-preset')
  })

  it('renders cover image when coverImageUrl is set (preset ignored)', () => {
    const { container } = render(
      <PathCardHeader
        pathName="X"
        completionPct={50}
        coverImageUrl="https://cdn.example/cover.jpg"
        coverPreset="purple-indigo"
      />
    )

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example/cover.jpg')
  })

  it('shows completed overlay at 100%', () => {
    render(<PathCardHeader pathName="Done" completionPct={100} />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
})
