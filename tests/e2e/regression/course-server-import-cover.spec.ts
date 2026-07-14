import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

const COURSE_NAME = 'Chase Hughes - NCI University E2E'
const COURSE_PATH = '/e2e-server/Chase%20Hughes%20-%20NCI%20University%20E2E/'
const MODULE_SEGMENT = '02-The%20Game%20of%20Investing'
const COVER_BYTES = readFileSync(
  resolve(process.cwd(), 'public/images/instructors/chase-hughes-96w.jpg')
)

function autoindex(entries: string): string {
  return `<html><body><pre><a href="../">../</a>${entries}</pre></body></html>`
}

test.describe('server course import cover regression', () => {
  test('persists 0x0.jpg across reload and decodes encoded module labels', async ({
    page,
    indexedDB,
  }) => {
    await page.route('**/e2e-server/**', async route => {
      const pathname = new URL(route.request().url()).pathname

      if (pathname.endsWith('/0x0.jpg')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: COVER_BYTES,
        })
        return
      }

      if (pathname.endsWith(`/${MODULE_SEGMENT}/`)) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: autoindex('<a href="01-Manifesto.mp4">01-Manifesto.mp4</a>'),
        })
        return
      }

      if (pathname === COURSE_PATH) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: autoindex(
            `<a href="${MODULE_SEGMENT}/">${MODULE_SEGMENT}/</a>` + '<a href="0x0.jpg">0x0.jpg</a>'
          ),
        })
        return
      }

      await route.fulfill({ status: 404, body: 'Not found' })
    })

    await navigateAndWait(page, '/courses')
    for (const store of [
      'courseThumbnails',
      'importedPdfs',
      'importedVideos',
      'importedCourses',
      'syncQueue',
    ]) {
      await indexedDB.clearStore(store)
    }
    await page.reload({ waitUntil: 'load' })

    await page.getByTestId('empty-import-folder-btn').click()
    await page.getByTestId('import-single-btn').click()
    await page.getByTestId('wizard-server-url-btn').click()
    await page.getByTestId('wizard-url-input').fill(new URL(COURSE_PATH, page.url()).toString())
    await page.getByTestId('wizard-server-scan-btn').click()

    await expect(page.getByTestId('wizard-course-name-input')).toHaveValue(COURSE_NAME)
    const coverOption = page.getByTestId('wizard-image-option-0x0.jpg')
    await expect(coverOption).toHaveAttribute('aria-checked', 'true')
    await coverOption.click()
    await coverOption.click()
    await expect(page.getByTestId('wizard-cover-selected')).toHaveText(
      'Selected cover file: 0x0.jpg'
    )

    await page.getByTestId('wizard-next-btn').click()
    await expect(page.getByTestId('wizard-track-none')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('wizard-path-import-btn').click()

    const card = page.getByTestId('imported-course-card').filter({ hasText: COURSE_NAME })
    await expect(card).toBeVisible()
    const cardCover = card.locator('img').first()
    await expect(cardCover).toBeVisible()
    await expect.poll(() => cardCover.evaluate(image => image.naturalWidth)).toBeGreaterThan(0)

    await page.reload({ waitUntil: 'load' })
    const reloadedCard = page.getByTestId('imported-course-card').filter({ hasText: COURSE_NAME })
    await expect(reloadedCard).toBeVisible()
    const reloadedCover = reloadedCard.locator('img').first()
    await expect(reloadedCover).toBeVisible()
    await expect.poll(() => reloadedCover.evaluate(image => image.naturalWidth)).toBeGreaterThan(0)

    await reloadedCard.getByTestId('start-course-btn').click()
    await expect(page.getByText('02-The Game of Investing', { exact: true })).toBeVisible()
  })
})
