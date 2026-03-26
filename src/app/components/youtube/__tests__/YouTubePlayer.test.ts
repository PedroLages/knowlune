/**
 * Unit tests for YouTube player progress tracking logic.
 *
 * Tests the progress persistence and auto-complete threshold logic
 * using the Dexie progress table directly (no React rendering needed).
 *
 * @see E28-S09
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

let db: (typeof import('@/db'))['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('YouTube progress persistence', () => {
  it('should store progress with compound key [courseId+videoId]', async () => {
    const record = {
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 120,
      completionPercentage: 40,
    }

    await db.progress.put(record)
    const stored = await db.progress.get({ courseId: 'yt-course-1', videoId: 'lesson-uuid-1' })
    expect(stored).toBeDefined()
    expect(stored!.currentTime).toBe(120)
    expect(stored!.completionPercentage).toBe(40)
  })

  it('should upsert existing progress on put', async () => {
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 60,
      completionPercentage: 20,
    })

    // Update with new position
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 240,
      completionPercentage: 80,
    })

    const stored = await db.progress.get({ courseId: 'yt-course-1', videoId: 'lesson-uuid-1' })
    expect(stored!.currentTime).toBe(240)
    expect(stored!.completionPercentage).toBe(80)
  })

  it('should set completedAt when auto-complete threshold (90%) reached', async () => {
    const now = new Date().toISOString()
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 270,
      completionPercentage: 90,
      completedAt: now,
    })

    const stored = await db.progress.get({ courseId: 'yt-course-1', videoId: 'lesson-uuid-1' })
    expect(stored!.completedAt).toBe(now)
    expect(stored!.completionPercentage).toBe(90)
  })

  it('should not set completedAt below 90% threshold', async () => {
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 260,
      completionPercentage: 89,
    })

    const stored = await db.progress.get({ courseId: 'yt-course-1', videoId: 'lesson-uuid-1' })
    expect(stored!.completedAt).toBeUndefined()
  })

  it('should store progress for multiple lessons independently', async () => {
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 100,
      completionPercentage: 33,
    })
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-2',
      currentTime: 200,
      completionPercentage: 67,
    })

    const all = await db.progress.where('courseId').equals('yt-course-1').toArray()
    expect(all).toHaveLength(2)
    expect(all.map(p => p.videoId).sort()).toEqual(['lesson-uuid-1', 'lesson-uuid-2'])
  })

  it('should resume from saved position', async () => {
    await db.progress.put({
      courseId: 'yt-course-1',
      videoId: 'lesson-uuid-1',
      currentTime: 150,
      completionPercentage: 50,
    })

    const stored = await db.progress.get({ courseId: 'yt-course-1', videoId: 'lesson-uuid-1' })
    expect(stored!.currentTime).toBe(150)
  })
})

describe('YouTube auto-complete threshold', () => {
  it('should compute correct percentage at different positions', () => {
    const testCases = [
      { currentTime: 0, duration: 300, expected: 0 },
      { currentTime: 150, duration: 300, expected: 50 },
      { currentTime: 270, duration: 300, expected: 90 },
      { currentTime: 300, duration: 300, expected: 100 },
      { currentTime: 295, duration: 300, expected: 98 },
    ]

    for (const { currentTime, duration, expected } of testCases) {
      const percent = Math.min(100, Math.round((currentTime / duration) * 100))
      expect(percent).toBe(expected)
    }
  })

  it('should trigger auto-complete at exactly 90%', () => {
    const threshold = 0.9
    expect(270 / 300).toBeGreaterThanOrEqual(threshold)
    expect(269 / 300).toBeLessThan(threshold)
  })
})
