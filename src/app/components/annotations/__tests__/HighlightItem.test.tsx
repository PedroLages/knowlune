/**
 * HighlightItem — reader deep link uses sourceHighlightId
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HighlightItem } from '../HighlightItem'
import type { BookHighlight } from '@/data/types'

const highlight: BookHighlight = {
  id: 'hl-1',
  bookId: 'b1',
  textAnchor: 'Some quoted passage from the book',
  color: 'yellow',
  position: { type: 'cfi', value: 'epubcfi(/6/4)' },
  cfiRange: 'epubcfi(/6/4!/4/2/1:0,/6/4!/4/2/1:10)',
  createdAt: new Date().toISOString(),
}

describe('HighlightItem', () => {
  it('links to BookReader with sourceHighlightId', () => {
    render(
      <MemoryRouter>
        <HighlightItem highlight={highlight} bookId="b1" />
      </MemoryRouter>
    )

    const link = screen.getByTestId('annotation-goto-reader')
    expect(link).toHaveAttribute('href', '/library/b1/read?sourceHighlightId=hl-1')
  })
})
