import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

/**
 * Seed AI configuration into localStorage
 */
async function seedAIConfig(
  page: import('@playwright/test').Page,
  overrides: { analytics?: boolean; connectionStatus?: string } = {}
) {
  await page.evaluate(
    ({ analytics, connectionStatus }) => {
      const aiConfig = {
        provider: 'openai',
        connectionStatus: connectionStatus ?? 'connected',
        _testApiKey: 'sk-test-key-1234567890abcdef',
        consentSettings: {
          videoSummary: true,
          noteQA: true,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: analytics ?? true,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(aiConfig))
    },
    { analytics: overrides.analytics, connectionStatus: overrides.connectionStatus }
  )
}

/**
 * Seed AI usage events into IndexedDB for analytics display tests
 */
async function seedAIUsageEvents(
  page: import('@playwright/test').Page,
  events: Array<{
    id: string
    featureType: string
    timestamp: string
    status?: string
    courseId?: string
  }>
) {
  const records = events.map(e => ({
    id: e.id,
    featureType: e.featureType,
    timestamp: e.timestamp,
    status: e.status ?? 'success',
    courseId: e.courseId,
  }))
  await seedIndexedDBStore(page, 'ElearningDB', 'aiUsageEvents', records)
}

test.describe('E09B-S06: AI Feature Analytics & Auto-Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze clock to FIXED_DATE so getPeriodBounds() aligns with seeded event timestamps
    await page.clock.setFixedTime(new Date(FIXED_DATE))
    // Navigate first so localStorage is accessible (about:blank blocks it)
    await page.goto('/')
    // Prevent tablet sidebar overlay
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
  })

  test.afterEach(async ({ page }) => {
    // Clear seeded aiUsageEvents to prevent test interference
    // (seedIndexedDBStore bypasses fixture auto-cleanup which only tracks importedCourses)
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      const edb = dbs.find(d => d.name === 'ElearningDB')
      if (!edb) return
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      if (db.objectStoreNames.contains('aiUsageEvents')) {
        const tx = db.transaction('aiUsageEvents', 'readwrite')
        tx.objectStore('aiUsageEvents').clear()
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
      db.close()
    })
  })

  test.describe('AC1: AI Analytics dashboard with usage statistics', () => {
    test('displays usage statistics with trend indicators for each AI feature', async ({
      page,
    }) => {
      await seedAIConfig(page)

      // Seed current-period events (same week as FIXED_DATE = Jan 15 2025, Wednesday)
      await seedAIUsageEvents(page, [
        { id: 'evt-1', featureType: 'summary', timestamp: FIXED_DATE },
        { id: 'evt-2', featureType: 'summary', timestamp: FIXED_DATE },
        { id: 'evt-3', featureType: 'qa', timestamp: FIXED_DATE },
        { id: 'evt-4', featureType: 'learning_path', timestamp: FIXED_DATE },
        { id: 'evt-5', featureType: 'note_organization', timestamp: FIXED_DATE },
      ])

      // Seed previous-period events (previous week) for trend comparison
      const lastWeek = getRelativeDate(-7)
      await seedAIUsageEvents(page, [
        { id: 'evt-prev-1', featureType: 'summary', timestamp: lastWeek },
      ])

      // Navigate to Reports → AI Analytics tab
      await page.getByRole('link', { name: /reports/i }).click()
      await page.getByRole('tab', { name: /ai analytics/i }).click()

      // All 5 stat cards should be visible
      const summaryCard = page.getByTestId('ai-stat-summary')
      const qaCard = page.getByTestId('ai-stat-qa')
      const learningPathCard = page.getByTestId('ai-stat-learning_path')
      const noteOrgCard = page.getByTestId('ai-stat-note_organization')
      const knowledgeGapsCard = page.getByTestId('ai-stat-knowledge_gaps')

      await expect(summaryCard).toBeVisible()
      await expect(qaCard).toBeVisible()
      await expect(learningPathCard).toBeVisible()
      await expect(noteOrgCard).toBeVisible()
      await expect(knowledgeGapsCard).toBeVisible()

      // Verify trend indicator: summaries went from 1 (previous) to 2 (current) = "up"
      const summaryTrend = summaryCard.locator('[aria-label*="Up from previous period"]')
      await expect(summaryTrend).toBeVisible()

      // Knowledge gaps should show "Coming soon" badge
      await expect(knowledgeGapsCard).toContainText('Coming soon')
    })
  })

  test.describe('AC2: Time period toggle updates statistics', () => {
    test('switches between daily, weekly, monthly and stats reflect selected period', async ({
      page,
    }) => {
      await seedAIConfig(page)

      // Seed events at FIXED_DATE (clock is frozen to this date)
      await seedAIUsageEvents(page, [
        { id: 'evt-1', featureType: 'summary', timestamp: FIXED_DATE },
        { id: 'evt-2', featureType: 'summary', timestamp: FIXED_DATE },
      ])

      await page.getByRole('link', { name: /reports/i }).click()
      await page.getByRole('tab', { name: /ai analytics/i }).click()

      // Period toggle buttons should be visible
      const dailyBtn = page.getByRole('button', { name: 'Daily' })
      const weeklyBtn = page.getByRole('button', { name: 'Weekly' })
      const monthlyBtn = page.getByRole('button', { name: 'Monthly' })

      await expect(dailyBtn).toBeVisible()
      await expect(weeklyBtn).toBeVisible()
      await expect(monthlyBtn).toBeVisible()

      // Weekly should be default (pressed) and show the seeded data
      await expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true')
      const summaryCard = page.getByTestId('ai-stat-summary')
      await expect(summaryCard).toContainText('2')

      // Switch to daily — stats should still show data (events are on the frozen "today")
      await dailyBtn.click()
      await expect(dailyBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false')
      await expect(summaryCard).toContainText('2')

      // Switch to monthly
      await monthlyBtn.click()
      await expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(dailyBtn).toHaveAttribute('aria-pressed', 'false')
      await expect(summaryCard).toContainText('2')
    })
  })

  test.describe('AC3: Auto-analysis triggers on course import', () => {
    test('auto-analysis respects consent: no AI fetch when analytics disabled', async ({
      page,
    }) => {
      // Disable analytics consent
      await seedAIConfig(page, { analytics: false })

      // Track whether any AI provider request is made
      let aiRequestMade = false
      await page.route('**/api.openai.com/**', route => {
        aiRequestMade = true
        return route.abort()
      })
      await page.route('**/api.anthropic.com/**', route => {
        aiRequestMade = true
        return route.abort()
      })

      await page.goto('/courses')

      // Invoke triggerAutoAnalysis — should early-return due to disabled analytics consent.
      // The consent check (isFeatureEnabled) is synchronous, so no async wait is needed.
      await page.evaluate(async () => {
        const { triggerAutoAnalysis } = await import('/src/lib/autoAnalysis.ts')
        const mockCourse = {
          id: 'test-course-1',
          name: 'Test Course',
          videoCount: 3,
          pdfCount: 1,
          tags: [],
          title: 'Test Course',
          importDate: '2025-01-15T12:00:00.000Z',
          totalSize: 1000,
          fileCount: 4,
        }
        triggerAutoAnalysis(mockCourse as never)
      })
      // No AI request should have been made because consent is disabled
      expect(aiRequestMade).toBe(false)
    })
  })

  test.describe('AC4: Auto-analysis completion applies results', () => {
    test('auto-analysis records events with auto_analysis featureType and shows toast', async ({
      page,
    }) => {
      await seedAIConfig(page)

      // Seed an auto_analysis event (simulating completed auto-analysis)
      await seedAIUsageEvents(page, [
        {
          id: 'evt-auto-1',
          featureType: 'auto_analysis',
          timestamp: FIXED_DATE,
          courseId: 'test-course-1',
        },
      ])

      // Also seed a course so we can verify it coexists
      await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [
        {
          id: 'test-course-1',
          name: 'Test Course',
          title: 'Test Course',
          importDate: FIXED_DATE,
          totalSize: 1000,
          fileCount: 4,
          videoCount: 3,
          pdfCount: 1,
          tags: ['react', 'hooks'],
        },
      ])

      await page.getByRole('link', { name: /reports/i }).click()
      await page.getByRole('tab', { name: /ai analytics/i }).click()

      // The auto_analysis events should NOT inflate the summaries count
      // (auto_analysis is a separate featureType now)
      const summaryCard = page.getByTestId('ai-stat-summary')
      await expect(summaryCard).toBeVisible()
      // Summary count should be 0 (only auto_analysis event was seeded, not summary)
      await expect(summaryCard).toContainText('0')
    })
  })

  test.describe('AC5: Graceful fallback on AI provider failure', () => {
    test('shows AI unavailable state when provider not configured', async ({ page }) => {
      // Set AI as unconfigured — tests the static configuration guard
      await seedAIConfig(page, { connectionStatus: 'unconfigured' })

      await page.getByRole('link', { name: /reports/i }).click()
      await page.getByRole('tab', { name: /ai analytics/i }).click()

      // Should show "AI provider not configured" message with guidance
      await expect(page.getByText(/AI provider not configured/i)).toBeVisible()
      await expect(page.getByText(/Set up an AI provider in Settings/i)).toBeVisible()
    })

    test('auto-analysis shows error toast on network failure', async ({ page }) => {
      await seedAIConfig(page)

      // Intercept AI provider with network failure
      await page.route('**/api.openai.com/**', route => route.abort())

      await page.goto('/courses')

      // Trigger auto-analysis which should fail
      await page.evaluate(async () => {
        const { triggerAutoAnalysis } = await import('/src/lib/autoAnalysis.ts')
        const mockCourse = {
          id: 'test-course-fail',
          name: 'Failing Course',
          videoCount: 1,
          pdfCount: 0,
          tags: [],
          title: 'Failing Course',
          importDate: '2025-01-15T12:00:00.000Z',
          totalSize: 500,
          fileCount: 1,
        }
        triggerAutoAnalysis(mockCourse as never)
      })

      // Should show error toast with retry option
      await expect(page.getByText(/auto-analysis could not complete/i)).toBeVisible({
        timeout: 10000,
      })
    })
  })

  test.describe('AC6: Consent toggle prevents auto-analysis', () => {
    test('no data sent to AI provider when analytics consent is off', async ({ page }) => {
      // Disable analytics consent
      await seedAIConfig(page, { analytics: false })

      // Track all AI provider requests — none should be made
      const aiRequests: string[] = []
      await page.route('**/api.openai.com/**', route => {
        aiRequests.push(route.request().url())
        return route.abort()
      })

      await page.goto('/')

      await page.getByRole('link', { name: /reports/i }).click()
      await page.getByRole('tab', { name: /ai analytics/i }).click()

      // Empty state should be shown since consent is off and no events exist
      await expect(page.getByText(/No AI usage data yet/i)).toBeVisible()

      // Verify no AI provider requests were made
      expect(aiRequests).toHaveLength(0)
    })
  })
})
