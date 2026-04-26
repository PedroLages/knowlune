import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookDetailsForm } from '../BookDetailsForm'

const noop = vi.fn()

function renderForm(fileName = 'book.epub') {
  const file = new File(['epub'], fileName, { type: 'application/epub+zip' })

  return render(
    <BookDetailsForm
      file={file}
      title="Business Brilliant"
      author="Lewis Schiff"
      genre="Other"
      status="unread"
      coverPreviewUrl={null}
      phase="idle"
      isImporting={false}
      onTitleChange={noop}
      onAuthorChange={noop}
      onGenreChange={noop}
      onStatusChange={noop}
      onReset={noop}
      onCancel={noop}
      onImport={noop}
    />
  )
}

describe('BookDetailsForm', () => {
  it('keeps long selected filenames constrained inside the file info row', () => {
    const longFileName =
      'Business brilliant_ surprising lessons from the greatest self-made business icons -- Schiff, Lewis -- Open Road Integrated Media.epub'

    renderForm(longFileName)

    expect(screen.getByTestId('book-details-form')).toHaveClass(
      'min-w-0',
      'max-w-full',
      'overflow-hidden'
    )

    const filename = screen.getByText(longFileName)
    expect(filename).toHaveClass('block', 'min-w-0', 'flex-1', 'truncate')
    expect(filename).toHaveAttribute('title', longFileName)
    expect(filename.parentElement).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden')
  })
})
