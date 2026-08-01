import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CourseThumbnailMedia } from '../CourseThumbnailMedia'

describe('CourseThumbnailMedia', () => {
  it('keeps the fallback visible until the image loads', () => {
    render(
      <CourseThumbnailMedia
        candidates={[{ url: 'https://example.com/course.jpg', fit: 'contain' }]}
        fallbackLabel="No cover yet"
      />
    )

    const image = document.querySelector('img') as HTMLImageElement
    expect(image).toHaveClass('object-contain', 'opacity-0')
    expect(screen.getByTestId('course-thumbnail-placeholder')).toBeVisible()

    fireEvent.load(image)

    expect(image).toHaveClass('opacity-100')
  })

  it('moves to the next candidate after a failed image', () => {
    render(
      <CourseThumbnailMedia
        candidates={[
          { url: 'https://example.com/broken.jpg' },
          { url: 'https://example.com/good.jpg' },
        ]}
      />
    )

    const firstImage = document.querySelector('img') as HTMLImageElement
    fireEvent.error(firstImage)

    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.com/good.jpg')
  })

  it('offers a recovery action after all candidates fail', () => {
    const onAddCover = vi.fn()
    render(
      <CourseThumbnailMedia
        candidates={[{ url: 'https://example.com/broken.jpg' }]}
        onAddCover={onAddCover}
      />
    )

    fireEvent.error(document.querySelector('img') as HTMLImageElement)
    fireEvent.click(screen.getByTestId('course-thumbnail-add-cover'))

    expect(onAddCover).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('No cover available')).toBeInTheDocument()
  })
})
