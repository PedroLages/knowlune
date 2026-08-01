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

    const image = screen.getByTestId('course-thumbnail-image')
    expect(image).toHaveClass('object-contain', 'opacity-0')
    expect(screen.getByTestId('course-thumbnail-backdrop')).toHaveClass('object-cover', 'opacity-0')
    expect(screen.getByTestId('course-thumbnail-placeholder')).toBeVisible()

    fireEvent.load(image)

    expect(image).toHaveClass('opacity-100')
    expect(screen.getByTestId('course-thumbnail-backdrop')).toHaveClass('opacity-40')
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

    const firstImage = screen.getByTestId('course-thumbnail-image')
    fireEvent.error(firstImage)

    expect(screen.getByTestId('course-thumbnail-image')).toHaveAttribute(
      'src',
      'https://example.com/good.jpg'
    )
  })

  it('offers a recovery action after all candidates fail', () => {
    const onAddCover = vi.fn()
    render(
      <CourseThumbnailMedia
        candidates={[{ url: 'https://example.com/broken.jpg' }]}
        onAddCover={onAddCover}
      />
    )

    fireEvent.error(screen.getByTestId('course-thumbnail-image'))
    fireEvent.click(screen.getByTestId('course-thumbnail-add-cover'))

    expect(onAddCover).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('No cover available')).toBeInTheDocument()
  })
})
