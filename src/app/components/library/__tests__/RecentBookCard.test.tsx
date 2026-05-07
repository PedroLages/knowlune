import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import { RecentBookCard } from '@/app/components/library/RecentBookCard'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'rb-1',
    title: 'Sample',
    author: 'Author',
    format: 'audiobook',
    status: 'finished',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book' },
    progress: 100,
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

describe('RecentBookCard', () => {
  it('defaults to default tone', () => {
    render(
      <MemoryRouter>
        <RecentBookCard book={makeBook()} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('recent-book-card-rb-1')).toHaveAttribute('data-tone', 'default')
  })

  it('applies muted tone for Listen Again styling', () => {
    render(
      <MemoryRouter>
        <RecentBookCard book={makeBook()} tone="muted" />
      </MemoryRouter>
    )
    const root = screen.getByTestId('recent-book-card-rb-1')
    expect(root).toHaveAttribute('data-tone', 'muted')
    const cover = root.querySelector('.aspect-square') as HTMLElement | null
    expect(cover).not.toBeNull()
    expect(cover!.className).toMatch(/opacity-\[0\.88\]/)
    expect(cover!.className).toContain('grayscale')
  })
})
