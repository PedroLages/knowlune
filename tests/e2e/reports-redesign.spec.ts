/**
 * Reports page redesign E2E tests — verifies the redesigned Study Analytics
 * tab renders all chart sections, tabs switch correctly, and layout is
 * responsive on mobile.
 *
 * Demonstrates:
 *   - Role-based and text-based selectors
 *   - Tab interaction testing
 *   - Responsive viewport verification
 *   - Empty state validation
 */
import { test, expect } from '../support/fixtures'
import { goToReports } from '../support/helpers/navigation'

test.describe('Reports Page — Study Analytics', () => {
  test('should display Reports heading and Study Analytics tab active', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
    // Study Analytics tab should be active by default
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('should render all four stat cards', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Lessons Completed', { exact: true })).toBeVisible()
    await expect(page.getByText('Courses In Progress')).toBeVisible()
    await expect(page.getByText('Courses Completed')).toBeVisible()
    await expect(page.getByText('Study Notes')).toBeVisible()
  })

  test('should render Weekly Study Goal section', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Weekly Study Goal')).toBeVisible()
  })

  test('should render Course Completion chart', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Course Completion', { exact: true })).toBeVisible()
    // The horizontal bar chart should have a recharts container
    const barChartCard = page.locator('text=Course Completion').locator('..').locator('..')
    await expect(barChartCard).toBeVisible()
  })

  test('should render Progress by Category radar chart', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Progress by Category')).toBeVisible()
    // Radar chart should have an aria-label with category data
    const radarContainer = page.locator('[role="img"][aria-label*="Category progress"]')
    await expect(radarContainer).toBeVisible()
  })

  test('should render Study Activity area chart', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Study Activity (Last 30 Days)')).toBeVisible()
  })

  test('should render Learning Profile skills radar', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Learning Profile')).toBeVisible()
    // Skills radar should have an aria-label with dimension data
    const skillsRadar = page.locator('[role="img"][aria-label*="Learning profile"]')
    await expect(skillsRadar).toBeVisible()
  })

  test('should render Recent Activity section', async ({ page }) => {
    await goToReports(page)

    await expect(page.getByText('Recent Activity', { exact: true })).toBeVisible()
  })

  test('should show empty state message when no activity', async ({ page, localStorage }) => {
    await page.goto('/')
    await localStorage.clearAll()
    await page.goto('/reports')
    await page.waitForLoadState('load')

    // Sidebar seed for tablet viewports
    await page.addInitScript(() => {
      window.localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    await page.reload()
    await page.waitForLoadState('load')

    await expect(
      page.getByText('No activity yet. Start studying to see your progress here.')
    ).toBeVisible()
  })
})

test.describe('Reports Page — Tab Switching', () => {
  test('should switch between Study Analytics and AI Analytics tabs', async ({ page }) => {
    await goToReports(page)

    // Click AI Analytics tab
    const aiTab = page.getByRole('tab', { name: 'AI Analytics' })
    await aiTab.click()
    await expect(aiTab).toHaveAttribute('data-state', 'active')

    // Study Analytics tab should no longer be active
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'inactive'
    )

    // Switch back
    const studyTab = page.getByRole('tab', { name: 'Study Analytics' })
    await studyTab.click()
    await expect(studyTab).toHaveAttribute('data-state', 'active')

    // Study content should be visible again
    await expect(page.getByText('Weekly Study Goal')).toBeVisible()
  })
})

test.describe('Reports Page — Responsive', () => {
  test('bar chart should be scrollable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    // Seed sidebar closed for mobile
    await page.addInitScript(() => {
      window.localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    await page.goto('/reports')
    await page.waitForLoadState('load')

    // The overflow-x-auto wrapper should exist around the bar chart
    const scrollContainer = page.locator('.overflow-x-auto').first()
    await expect(scrollContainer).toBeVisible()

    // The inner chart should have min-width larger than viewport
    const minWidthChart = page.locator('.min-w-\\[480px\\]').first()
    await expect(minWidthChart).toBeVisible()
  })
})
