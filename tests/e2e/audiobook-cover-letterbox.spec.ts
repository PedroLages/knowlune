/**
 * E2E Regression: Audiobook player cover renders edge-to-edge for non-square sources.
 *
 * Why this test exists
 * --------------------
 * The player at AudiobookRenderer.tsx renders ABS-served covers via:
 *
 *     <div class="aspect-square ... overflow-hidden bg-muted">
 *       <img class="h-full w-full object-cover" />
 *     </div>
 *
 * If Tailwind v4's source scanner ever silently drops one of these utilities
 * (e.g. `aspect-square`, `object-cover`, or the arbitrary `rounded-[24px]`),
 * the cover letterboxes — the img reverts to intrinsic size and `bg-muted`
 * shows through as bars. We hit this once; this spec prevents a repeat.
 *
 * The test is unconditional (does not depend on whether the current fix is
 * "CSS-only" or behavior-changing): it always uses a committed non-square
 * fixture so any future regression to CSS, Tailwind config, or the JSX
 * structure surfaces immediately.
 *
 * Strategy
 * --------
 * 1. Seed a minimal ABS audiobook in IndexedDB whose `coverUrl` points at a
 *    routed test endpoint we control.
 * 2. Intercept that URL via `page.route(...)` and serve the committed
 *    600x800 PNG from tests/fixtures/covers/non-square-600x800.png.
 * 3. Navigate to the player, wait for the cover to load, then assert that
 *    img.getBoundingClientRect() ≈ container.getBoundingClientRect() and
 *    computed `object-fit` is `cover`.
 *
 * Headless-audio mocking is reused from the streaming.spec.ts pattern.
 *
 * @since CE 2026-04-25 audiobook cover letterbox fix
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
const COVER_FIXTURE_W = 600
const COVER_FIXTURE_H = 800

const ABS_SERVER = {
  id: 'abs-server-cover',
  name: 'Cover Test Server',
  url: 'http://abs-cover.test:13378',
  apiKey: 'cover-test-key',
  libraryIds: ['lib-cover'],
  status: 'connected',
  lastSyncedAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const ABS_AUDIOBOOK = {
  id: 'abs-cover-book-1',
  title: 'Non-Square Cover Test Book',
  author: 'Cover Author',
  format: 'audiobook',
  status: 'unread',
  tags: [],
  chapters: [
    {
      id: 'cov-ch-1',
      bookId: 'abs-cover-book-1',
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
  ],
  source: {
    type: 'remote',
    url: 'http://abs-cover.test:13378',
    auth: { bearer: 'cover-test-key' },
  },
  // Routed below to serve the 600x800 fixture
  coverUrl: '/__test__/api/items/cov-item-1/cover',
  absServerId: 'abs-server-cover',
  absItemId: 'cov-item-1',
  totalDuration: 1800,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}


// Other cover render sites verified during Phase 3 visual inspection:
//   - AudioMiniPlayer.tsx: fixed 56×56 flex item — uses different layout, not affected by flex compression
//   - Library card grid: background-image based, not an <img> element
//   - Blurred backdrop (AudiobookRenderer.tsx:398): background-size:cover — already correct pre-fix
// Only the main player frame uses the aspect-square flex path that this test guards.

test.describe('Audiobook cover letterbox regression', () => {
  test('non-square ABS cover fills the square frame edge-to-edge', async ({ page }) => {
    // 1) Mock audio element BEFORE navigation
    await mockAudioElement(page)

    // 2) Skip onboarding/wizard and seed sidebar closed
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

    // 3) Route the cover URL to the committed non-square fixture
    const coverPng = readFileSync(COVER_FIXTURE)
    await page.route('**/__test__/api/items/cov-item-1/cover*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: coverPng,
      })
    })

    // 4) Route ABS playback session and stream so the player can mount cleanly
    await page.route('**/api/items/*/play', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'cov-session-1',
            audioTracks: [
              {
                contentUrl: '/s/item/cov-item-1/book.m4b',
                duration: 1800,
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

    // 5) Seed IndexedDB
    await page.goto('/')
    await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
      ABS_SERVER,
    ] as unknown as Record<string, unknown>[])
    await seedIndexedDBStore(page, DB_NAME, 'books', [
      ABS_AUDIOBOOK,
    ] as unknown as Record<string, unknown>[])

    // 6) Use mobile viewport (the size the bug was reported at)
    await page.setViewportSize({ width: 375, height: 800 })

    // 7) Navigate to the player and wait for it to mount
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })

    const frame = page.getByTestId('audiobook-cover-frame')
    const img = page.getByTestId('audiobook-cover-image')

    await expect(frame).toBeVisible()
    await expect(img).toBeVisible()

    // 8) Wait for the image to actually finish loading the fixture bytes
    await page.waitForFunction(
      () => {
        const el = document.querySelector(
          '[data-testid="audiobook-cover-image"]'
        ) as HTMLImageElement | null
        return !!el && el.complete && el.naturalWidth > 0
      },
      { timeout: 10000 }
    )

    // 9) Assert geometry: img rect equals container rect (no letterbox bars)
    const measurements = await page.evaluate(() => {
      const cov = document.querySelector('[data-testid="audiobook-cover-frame"]') as HTMLElement
      const im = document.querySelector(
        '[data-testid="audiobook-cover-image"]'
      ) as HTMLImageElement
      const ccs = getComputedStyle(cov)
      const ics = getComputedStyle(im)
      return {
        container: cov.getBoundingClientRect(),
        img: im.getBoundingClientRect(),
        natural: { w: im.naturalWidth, h: im.naturalHeight },
        containerComputed: {
          aspectRatio: ccs.aspectRatio,
          overflow: ccs.overflow,
          borderRadius: ccs.borderRadius,
        },
        imgComputed: {
          objectFit: ics.objectFit,
          width: ics.width,
          height: ics.height,
        },
      }
    })

    // The fixture must actually be the non-square 600x800 PNG we committed —
    // a Tailwind regression that forces the source to render at intrinsic size
    // would show up here too if the source were swapped.
    expect(measurements.natural.w).toBe(COVER_FIXTURE_W)
    expect(measurements.natural.h).toBe(COVER_FIXTURE_H)

    // Container must be square (aspect-square applied).
    // Geometric check is the durable assertion — aspectRatio serialization
    // varies across browsers ("1 / 1", "1", "auto").
    expect(measurements.container.width).toBeGreaterThan(0)
    expect(Math.abs(measurements.container.width - measurements.container.height)).toBeLessThan(0.5)

    // object-cover must be applied (this is the property that crops, not letterboxes)
    expect(measurements.imgComputed.objectFit).toBe('cover')

    // Image rect must equal container rect (no bars, no intrinsic shrink-wrap)
    expect(Math.abs(measurements.img.width - measurements.container.width)).toBeLessThan(0.5)
    expect(Math.abs(measurements.img.height - measurements.container.height)).toBeLessThan(0.5)
    expect(Math.abs(measurements.img.left - measurements.container.left)).toBeLessThan(0.5)
    expect(Math.abs(measurements.img.top - measurements.container.top)).toBeLessThan(0.5)

    // Container has the rounded-[24px] frame applied (catches the third class
    // Tailwind v4 source-scan could miss for arbitrary values).
    expect(measurements.containerComputed.borderRadius).toBe('24px')
    expect(measurements.containerComputed.overflow).toBe('hidden')
  })
})
