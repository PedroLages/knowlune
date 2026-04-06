import { describe, it, expect, vi } from 'vitest'

const { mockShouldReduceMotion } = vi.hoisted(() => ({
  mockShouldReduceMotion: vi.fn(() => false),
}))

vi.mock('@/lib/settings', () => ({
  shouldReduceMotion: () => mockShouldReduceMotion(),
}))

import { scrollIntoViewReducedMotion } from '../scroll'

describe('scrollIntoViewReducedMotion', () => {
  function createElWithScrollIntoView() {
    const el = document.createElement('div')
    el.scrollIntoView = vi.fn()
    return el
  }

  it('uses smooth behavior by default when motion is not reduced', () => {
    mockShouldReduceMotion.mockReturnValue(false)
    const el = createElWithScrollIntoView()

    scrollIntoViewReducedMotion(el)

    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('uses auto behavior when motion is reduced', () => {
    mockShouldReduceMotion.mockReturnValue(true)
    const el = createElWithScrollIntoView()

    scrollIntoViewReducedMotion(el)

    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' })
  })

  it('preserves other options when motion is not reduced', () => {
    mockShouldReduceMotion.mockReturnValue(false)
    const el = createElWithScrollIntoView()

    scrollIntoViewReducedMotion(el, { block: 'start', behavior: 'smooth' })

    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('overrides behavior to auto when motion is reduced, keeping other options', () => {
    mockShouldReduceMotion.mockReturnValue(true)
    const el = createElWithScrollIntoView()

    scrollIntoViewReducedMotion(el, { block: 'center', behavior: 'smooth' })

    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
  })
})
