import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { LibraryMediaShelfRow } from '@/app/components/library/LibraryMediaShelfRow'

describe('LibraryMediaShelfRow', () => {
  it('does not violate hooks rules when children transition empty -> non-empty', () => {
    const { rerender } = render(
      <LibraryMediaShelfRow icon={BookOpen} label="Test shelf">
        {null}
      </LibraryMediaShelfRow>
    )

    // Empty children renders nothing.
    rerender(
      <LibraryMediaShelfRow icon={BookOpen} label="Test shelf">
        <div>Item</div>
      </LibraryMediaShelfRow>
    )

    // If hooks ordering were broken, React would throw during rerender.
    expect(true).toBe(true)
  })
})

