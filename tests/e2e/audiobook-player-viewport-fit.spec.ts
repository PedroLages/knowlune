/**
 * E2E Regression: Full audiobook player fits within the viewport on laptop-sized screens.
 *
 * Guards against vertical overflow (page scrollbar) and primary controls being
 * pushed below the visible area — see AudiobookRenderer + BookReader layout.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../support/fixtures'
import { mockAudioElement } from '../support/helpers/audio-mock'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_NAME = 'ElearningDB'
const COVER_FIXTURE = resolve(__dirname, '../fixtures/covers/non-square-600x800.png')

const ABS_SERVER = {
  id: 'abs-server-viewport-fit',
  name: 'Viewport Fit Server',
  url: 'http://abs-viewport-fit.test:13379',
  apiKey: 'viewport-fit-key',
  libraryIds: ['lib-vfit'],
  status: 'connected',
  lastSyncedAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const FIT_AUDIOBOOK = {
  id: 'abs-viewport-fit-book-1',
  title: 'Viewport Fit Audiobook',
  author: 'Test Author',
  format: 'audiobook',
  status: 'unread',
  tags: [],
  chapters: [
    {
      id: 'vfit-ch-1',
      bookId: 'abs-viewport-fit-book-1',
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
    {
      id: 'vfit-ch-2',
      bookId: 'abs-viewport-fit-book-1',
      title: 'Chapter 2',
      order: 1,
      position: { type: 'time', seconds: 900 },
    },
  ],
  source: {
    type: 'remote',
    url: 'http://abs-viewport-fit.test:13379',
    auth: { bearer: 'viewport-fit-key' },
  },
  coverUrl: '/__test__/api/items/vfit-item-1/cover',
  absServerId: 'abs-server-viewport-fit',
  absItemId: 'vfit-item-1',
  totalDuration: 3600,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

test.describe('Audiobook player viewport fit', () => {
  test('primary controls and reader chrome fit within 1280×720 with no document scroll', async ({
    page,
  }) => {
    await mockAudioElement(page)

    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z' })
      )
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    const coverPng = readFileSync(COVER_FIXTURE)
    await page.route('**/__test__/api/items/vfit-item-1/cover*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: coverPng,
      })
    })

    await page.route('**/api/items/*/play', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'vfit-session-1',
            audioTracks: [
              {
                contentUrl: '/s/item/vfit-item-1/book.m4b',
                duration: 3600,
                mimeType: 'audio/mp4',
              },
            ],
          }),
        })
      } else {
        await route.continue()
      }
    })
    await page.route('**/api/session/*/close', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route('**/s/item/**', async route => {
      await route.fulfill({ status: 200, contentType: 'audio/mp4', body: '' })
    })

    await page.goto('/')
    await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
      ABS_SERVER,
    ] as unknown as Record<string, unknown>[])
    await seedIndexedDBStore(page, DB_NAME, 'books', [
      FIT_AUDIOBOOK,
    ] as unknown as Record<string, unknown>[])

    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto(`/library/${FIT_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('audiobook-primary-controls')).toBeVisible()
    await expect(page.getByTestId('audiobook-secondary-controls')).toBeVisible()

    const layout = await page.evaluate(() => {
      const reader = document.querySelector('[data-testid="audiobook-reader"]') as HTMLElement | null
      const primary = document.querySelector(
        '[data-testid="audiobook-primary-controls"]'
      ) as HTMLElement | null
      const secondary = document.querySelector(
        '[data-testid="audiobook-secondary-controls"]'
      ) as HTMLElement | null
      const progress = document.querySelector(
        '[data-testid="audiobook-progress-panel"]'
      ) as HTMLElement | null
      if (!reader || !primary || !secondary) return null

      const r = reader.getBoundingClientRect()
      const p = primary.getBoundingClientRect()
      const s = secondary.getBoundingClientRect()
      const pr = progress?.getBoundingClientRect() ?? null

      return {
        innerHeight: window.innerHeight,
        readerBottom: r.bottom,
        primaryBottom: p.bottom,
        secondaryBottom: s.bottom,
        progressBottom: pr ? pr.bottom : 0,
        docScrollHeight: document.documentElement.scrollHeight,
        docClientHeight: document.documentElement.clientHeight,
      }
    })

    expect(layout).not.toBeNull()
    if (!layout) return

    const epsilon = 4
    expect(layout.readerBottom).toBeLessThanOrEqual(layout.innerHeight + epsilon)
    expect(layout.primaryBottom).toBeLessThanOrEqual(layout.innerHeight + epsilon)
    expect(layout.secondaryBottom).toBeLessThanOrEqual(layout.innerHeight + epsilon)
    if (layout.progressBottom > 0) {
      expect(layout.progressBottom).toBeLessThanOrEqual(layout.innerHeight + epsilon)
    }
    expect(layout.docScrollHeight).toBeLessThanOrEqual(layout.docClientHeight + epsilon)
  })
})
