/**
 * YouTube playlist import regression coverage.
 *
 * Verifies that playlist contents are resolved before Preview opens and that
 * playlist failures remain retryable on the URL step.
 */
import type { Page, Route } from '@playwright/test'
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLSk0AGtsyiaLtSC4_fGQOYFRrdwu3InOf'

const PLAYLIST_VIDEOS = [
  { id: 'oGwuihuuRJw', title: 'This One Mistake Made his Mindmap Useless' },
  { id: 'PfVZWaT4PM4', title: 'How to UPGRADE your Mind Mapping' },
  { id: 'mHAhV8YIlks', title: 'Are Mind Maps a WASTE OF TIME?' },
  { id: '382OExOIipQ', title: '2-HOUR DEEP WORK SESSION' },
  { id: 'JilEcEcojR4', title: 'How to Study With Me' },
  { id: 'ntaO3-n-isc', title: 'How To UPGRADE iPad Note Taking' },
  { id: 'NqxUExCZJ5Y', title: 'What 5000 Hours of Mind Mapping Taught Me' },
  { id: 'f3BEFt2dnUM', title: 'If You Want To Learn Faster' },
  { id: 'ja0U5xOT-uw', title: 'Become a Top 0.1% Student' },
] as const

async function seedYouTubeApiKey(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'youtube-configuration',
      JSON.stringify({
        cacheTtlDays: 7,
        _testApiKey: 'AIzaFAKEtest00000000000000000000000000',
      })
    )
  })
}

async function openYouTubeImportDialog(page: Page) {
  await navigateAndWait(page, '/courses')

  const emptyButton = page.getByTestId('empty-youtube-btn')
  const importCourseButton = page.getByTestId('import-course-btn')
  await expect(emptyButton.or(importCourseButton)).toBeVisible()

  if (await emptyButton.isVisible()) {
    await emptyButton.click()
  } else {
    await importCourseButton.click()
    await page.getByTestId('import-youtube-btn').click()
  }

  await expect(page.getByTestId('youtube-import-dialog')).toBeVisible()
}

async function enterPlaylistAndContinue(page: Page) {
  await page.getByTestId('youtube-url-textarea').fill(PLAYLIST_URL)
  const nextButton = page.getByTestId('wizard-next-btn')
  await expect(nextButton).toBeEnabled()
  await nextButton.click()
}

function playlistItemsResponse() {
  return {
    items: PLAYLIST_VIDEOS.map((video, position) => ({
      snippet: {
        title: video.title,
        position,
        channelTitle: 'Justin Sung',
        resourceId: { videoId: video.id },
        thumbnails: {
          default: { url: `https://i.ytimg.com/vi/${video.id}/default.jpg` },
        },
      },
    })),
    pageInfo: { totalResults: PLAYLIST_VIDEOS.length },
  }
}

async function fulfillVideoMetadata(route: Route) {
  const requestUrl = new URL(route.request().url())
  const requestedIds = requestUrl.searchParams.get('id')?.split(',') ?? []

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: requestedIds.map((id, index) => {
        const playlistVideo = PLAYLIST_VIDEOS.find(video => video.id === id)
        return {
          id,
          snippet: {
            title: playlistVideo?.title ?? `Playlist video ${index + 1}`,
            description: 'Playlist import regression test metadata.',
            channelId: 'UC2Zs9v2hL2qZZ7vsAENsg4w',
            channelTitle: 'Justin Sung',
            publishedAt: '2024-01-01T00:00:00Z',
            thumbnails: {
              default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` },
            },
          },
          contentDetails: { duration: 'PT10M' },
          status: {
            embeddable: true,
            privacyStatus: 'public',
            uploadStatus: 'processed',
          },
        }
      }),
      pageInfo: { totalResults: requestedIds.length },
    }),
  })
}

test.describe('YouTube playlist import', () => {
  test.beforeEach(async ({ page }) => {
    await seedYouTubeApiKey(page)
  })

  test('resolves playlist videos before opening Preview', async ({ page }) => {
    await page.route('**/www.googleapis.com/youtube/v3/playlistItems**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(playlistItemsResponse()),
      })
    )
    await page.route('**/www.googleapis.com/youtube/v3/videos**', fulfillVideoMetadata)
    await page.route('**/i.ytimg.com/**', route => route.abort())

    await openYouTubeImportDialog(page)
    await enterPlaylistAndContinue(page)

    await expect(page.getByTestId(`video-row-${PLAYLIST_VIDEOS[0].id}`)).toBeVisible()
    await expect(page.getByTestId(`video-row-${PLAYLIST_VIDEOS.at(-1)!.id}`)).toBeVisible()
    await expect(page.getByText('9 videos in import list')).toBeVisible()
    await expect(page.getByTestId('wizard-next-btn')).toBeEnabled()
  })

  test('keeps playlist API failures on Paste URLs and allows retry', async ({ page }) => {
    await page.route('**/www.googleapis.com/youtube/v3/playlistItems**', route =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 403,
            message: 'API access forbidden',
            errors: [{ reason: 'forbidden' }],
          },
        }),
      })
    )

    await openYouTubeImportDialog(page)
    await enterPlaylistAndContinue(page)

    const feedback = page.getByTestId('url-feedback')
    await expect(page.getByTestId('youtube-url-textarea')).toBeVisible()
    await expect(feedback).toContainText('Could not load playlist')
    await expect(feedback).toContainText('Check API key permissions')
    await expect(page.getByTestId('wizard-next-btn')).toBeEnabled()
  })

  test('keeps empty playlists on Paste URLs and allows retry', async ({ page }) => {
    await page.route('**/www.googleapis.com/youtube/v3/playlistItems**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          pageInfo: { totalResults: 0 },
        }),
      })
    )

    await openYouTubeImportDialog(page)
    await enterPlaylistAndContinue(page)

    await expect(page.getByTestId('youtube-url-textarea')).toBeVisible()
    await expect(page.getByTestId('url-feedback')).toContainText(
      'No public videos were found in this playlist'
    )
    await expect(page.getByTestId('wizard-next-btn')).toBeEnabled()
  })
})
