import { describe, it, expect } from 'vitest'
import { getIsActive } from '@/app/config/navigation'

describe('getIsActive', () => {
  it('activates study tab when pathname is /reports and search is ?tab=study', () => {
    expect(getIsActive({ path: '/reports', tab: 'study' }, '/reports', '?tab=study')).toBe(true)
  })

  it('does not activate quiz tab when on study tab', () => {
    expect(getIsActive({ path: '/reports', tab: 'quizzes' }, '/reports', '?tab=study')).toBe(false)
  })

  it('activates study tab when on bare /reports (default tab)', () => {
    expect(getIsActive({ path: '/reports', tab: 'study' }, '/reports', '')).toBe(true)
  })

  it('does not activate quiz tab on bare /reports', () => {
    expect(getIsActive({ path: '/reports', tab: 'quizzes' }, '/reports', '')).toBe(false)
  })

  it('activates AI tab when on /reports?tab=ai', () => {
    expect(getIsActive({ path: '/reports', tab: 'ai' }, '/reports', '?tab=ai')).toBe(true)
  })

  it('activates Overview on exact root match', () => {
    expect(getIsActive({ path: '/' }, '/', '')).toBe(true)
  })

  it('activates Courses on /courses path (startsWith match)', () => {
    expect(getIsActive({ path: '/courses' }, '/courses/123', '')).toBe(true)
  })

  it('does not activate Challenges when on /reports', () => {
    expect(getIsActive({ path: '/challenges' }, '/reports', '?tab=study')).toBe(false)
  })
})
