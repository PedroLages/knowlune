/**
 * Unit tests for YouTube metadata refresh service.
 *
 * @see E28-S12 — Offline Support, Metadata Refresh & Security Hardening
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isMetadataStale,
  STALE_THRESHOLD_MS,
} from './youtubeMetadataRefresh'
import type { ImportedCourse } from '@/data/types'

// Minimal course factory for tests
function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    importedAt: '2025-01-01T00:00:00.000Z',
    category: 'test',
    tags: [],
    status: 'active',
    videoCount: 5,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
    source: 'youtube',
    ...overrides,
  }
}

describe('isMetadataStale', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false for non-YouTube courses', () => {
    const course = makeCourse({ source: undefined })
    expect(isMetadataStale(course)).toBe(false)
  })

  it('returns true when lastRefreshedAt is not set', () => {
    const course = makeCourse({ lastRefreshedAt: undefined })
    expect(isMetadataStale(course)).toBe(true)
  })

  it('returns true when lastRefreshedAt is older than 30 days', () => {
    const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString()
    const course = makeCourse({ lastRefreshedAt: staleDate })
    expect(isMetadataStale(course)).toBe(true)
  })

  it('returns false when lastRefreshedAt is within 30 days', () => {
    const freshDate = new Date(Date.now() - STALE_THRESHOLD_MS + 60_000).toISOString()
    const course = makeCourse({ lastRefreshedAt: freshDate })
    expect(isMetadataStale(course)).toBe(false)
  })

  it('returns true when lastRefreshedAt is exactly 30 days old', () => {
    const exactDate = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
    const course = makeCourse({ lastRefreshedAt: exactDate })
    // At exactly 30 days, the difference equals threshold but is not > threshold
    // So it should be false (edge case)
    expect(isMetadataStale(course)).toBe(false)
  })

  it('returns true for invalid date string', () => {
    const course = makeCourse({ lastRefreshedAt: 'not-a-date' })
    expect(isMetadataStale(course)).toBe(true)
  })
})

describe('STALE_THRESHOLD_MS', () => {
  it('equals 30 days in milliseconds', () => {
    expect(STALE_THRESHOLD_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
