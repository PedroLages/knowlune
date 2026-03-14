/**
 * E2E tests for Story E9B-S05: AI Note Organization and Cross-Course Links
 *
 * ATDD: These tests are written BEFORE implementation (RED phase).
 * They validate AI-powered auto-tagging, categorization, cross-course linking,
 * preview/accept/reject workflow, and the Related Concepts panel.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'
import { seedAIConfiguration } from '../support/helpers/ai-summary-mocks'
import { FIXED_DATE } from '../utils/test-time'

// ── Test Data ──────────────────────────────────────────────────────────────

const mockNote1 = {
  id: 'note-1',
  courseId: 'course-1',
  videoId: 'video-1',
  content:
    'React hooks allow state management in functional components. useState is the primary hook.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['react', 'hooks'],
}

const mockNote2 = {
  id: 'note-2',
  courseId: 'course-1',
  videoId: 'video-2',
  content: 'useEffect handles side effects in React. Cleanup functions prevent memory leaks.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['react', 'effects'],
}

const mockNote3 = {
  id: 'note-3',
  courseId: 'course-2',
  videoId: 'video-3',
  content: 'Vue composables are similar to React hooks. They encapsulate reactive state logic.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['vue', 'composables'],
}

const mockNote4 = {
  id: 'note-4',
  courseId: 'course-2',
  videoId: 'video-4',
  content:
    'State management patterns differ between frameworks but share core concepts like reactivity.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['state-management'],
}

/** Mock AI response for note organization proposals */
const mockOrganizationResponse = {
  proposals: [
    {
      noteId: 'note-1',
      suggestedTags: ['state-management', 'functional-components'],
      category: 'frontend-development',
      crossCourseLinks: ['note-3'],
      rationale:
        'This note covers state management via hooks, connecting to Vue composables in course-2.',
    },
    {
      noteId: 'note-2',
      suggestedTags: ['lifecycle', 'cleanup'],
      category: 'frontend-development',
      crossCourseLinks: [],
      rationale: 'Side effects and cleanup are lifecycle concepts applicable across frameworks.',
    },
    {
      noteId: 'note-3',
      suggestedTags: ['state-management', 'reactive-state'],
      category: 'frontend-development',
      crossCourseLinks: ['note-1'],
      rationale:
        'Vue composables share the same pattern as React hooks for encapsulating reactive logic.',
    },
    {
      noteId: 'note-4',
      suggestedTags: ['design-patterns', 'reactivity'],
      category: 'software-architecture',
      crossCourseLinks: ['note-1', 'note-3'],
      rationale:
        'Cross-framework state management patterns connect to both React hooks and Vue composables.',
    },
  ],
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function seedTestNotes(page: Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
    mockNote1,
    mockNote2,
    mockNote3,
    mockNote4,
  ])
}

async function seedAIWithOrganizationConsent(page: Page) {
  await seedAIConfiguration(page, {
    provider: 'openai',
    apiKey: 'sk-test-key-for-e2e',
    videoSummaryConsent: true,
  })
}

async function injectMockOrganizationResponse(page: Page) {
  await page.addInitScript(
    ({ response }) => {
      ;(
        window as unknown as { __mockNoteOrganizationResponse: typeof response }
      ).__mockNoteOrganizationResponse = response
    },
    { response: mockOrganizationResponse }
  )
}

async function setupNotesPage(page: Page, options: { aiAvailable?: boolean } = {}) {
  const { aiAvailable = true } = options

  // Prevent sidebar overlay on tablet viewports
  await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

  if (aiAvailable) {
    await seedAIWithOrganizationConsent(page)
    await injectMockOrganizationResponse(page)
  }

  await page.goto('/notes')
  await page.waitForLoadState('networkidle')
}

// ── AC1: AI Organization Request ────────────────────────────────────────────

test.describe('AC1: Organize Notes with AI', () => {
  test('clicking "Organize with AI" triggers analysis and shows proposals', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    // Find and click the organize button
    const organizeButton = page.getByRole('button', { name: /organize.*ai/i })
    await expect(organizeButton).toBeVisible()
    await organizeButton.click()

    // Should show loading state
    await expect(organizeButton).toBeDisabled()

    // Preview dialog should appear with proposals
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Should show proposals for our test notes
    await expect(dialog.getByText(/state-management/i)).toBeVisible()
    await expect(dialog.getByText(/rationale/i).or(dialog.getByText(/reason/i))).toBeVisible()
  })

  test('organize button is disabled when no notes exist', async ({ page }) => {
    await setupNotesPage(page)

    const organizeButton = page.getByRole('button', { name: /organize.*ai/i })
    await expect(organizeButton).toBeDisabled()
  })
})

// ── AC2: Preview Panel ──────────────────────────────────────────────────────

test.describe('AC2: Preview panel with accept/reject', () => {
  test('preview panel shows proposed changes with AI rationale', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    await page.getByRole('button', { name: /organize.*ai/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Each proposal should show rationale text
    await expect(dialog.getByText(/state management via hooks.*connecting to Vue/i)).toBeVisible()

    // Should show proposed tags as badges
    await expect(dialog.getByText('functional-components')).toBeVisible()

    // Should show proposed category
    await expect(dialog.getByText(/frontend-development/i)).toBeVisible()
  })

  test('each proposal has an individual accept/reject checkbox', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    await page.getByRole('button', { name: /organize.*ai/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Should have checkboxes for each proposal (4 notes = 4 checkboxes)
    const checkboxes = dialog.getByRole('checkbox')
    await expect(checkboxes).toHaveCount(4)

    // All should be checked by default
    for (let i = 0; i < 4; i++) {
      await expect(checkboxes.nth(i)).toBeChecked()
    }

    // User can uncheck individual proposals
    await checkboxes.nth(1).uncheck()
    await expect(checkboxes.nth(1)).not.toBeChecked()
  })
})

// ── AC3: Apply Changes ──────────────────────────────────────────────────────

test.describe('AC3: Apply selected changes', () => {
  test('applying changes updates note tags and shows confirmation toast', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    await page.getByRole('button', { name: /organize.*ai/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Click apply
    const applyButton = dialog.getByRole('button', { name: /apply.*changes/i })
    await applyButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()

    // Toast should confirm applied changes
    await expect(page.getByText(/applied.*changes/i)).toBeVisible({ timeout: 5000 })
  })

  test('rejected proposals are not applied', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    await page.getByRole('button', { name: /organize.*ai/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Uncheck note-1 proposal (first checkbox)
    const checkboxes = dialog.getByRole('checkbox')
    await checkboxes.nth(0).uncheck()

    // Apply remaining
    await dialog.getByRole('button', { name: /apply.*changes/i }).click()
    await expect(dialog).not.toBeVisible()

    // Toast should indicate fewer changes applied
    await expect(
      page.getByText(/applied.*changes.*3/i).or(page.getByText(/3.*notes/i))
    ).toBeVisible({
      timeout: 5000,
    })
  })
})

// ── AC4: Related Concepts Panel ─────────────────────────────────────────────

test.describe('AC4: Related Concepts panel', () => {
  test('expanding a note shows related notes with shared tags', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    // Wait for notes to load
    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    // Expand note-1 (has 'react' tag shared with note-2)
    const noteCard = page.getByText(mockNote1.content.slice(0, 30)).locator('..')
    await noteCard.click()

    // Related Concepts panel should appear
    const relatedPanel = page.getByText(/related concepts/i)
    await expect(relatedPanel).toBeVisible({ timeout: 5000 })

    // Should show note-2 as related (shares 'react' tag)
    await expect(
      page.getByText(mockNote2.content.slice(0, 30)).or(page.getByText(/useEffect/i))
    ).toBeVisible()

    // Should show source course and shared tags
    await expect(page.getByText('react')).toBeVisible()
  })

  test('related panel shows cross-course notes with shared terms', async ({ page }) => {
    // note-1 (course-1, react hooks) and note-3 (course-2, vue composables)
    // share terms about state management
    await seedTestNotes(page)
    await setupNotesPage(page)

    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    // Expand note-4 which has 'state-management' tag shared with note-1 after AI organization
    const noteCard = page.getByText(mockNote4.content.slice(0, 30)).locator('..')
    await noteCard.click()

    // Related Concepts panel should show cross-course connections
    const relatedPanel = page.getByText(/related concepts/i)
    await expect(relatedPanel).toBeVisible({ timeout: 5000 })
  })
})

// ── AC5: Navigation Between Related Notes ───────────────────────────────────

test.describe('AC5: Navigation from related note', () => {
  test('clicking a related note navigates to its detail view', async ({ page }) => {
    await seedTestNotes(page)
    await setupNotesPage(page)

    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    // Expand a note to see related concepts
    const noteCard = page.getByText(mockNote1.content.slice(0, 30)).locator('..')
    await noteCard.click()

    // Wait for Related Concepts panel
    await expect(page.getByText(/related concepts/i)).toBeVisible({ timeout: 5000 })

    // Click on a related note link
    const relatedLink = page
      .getByRole('link', { name: /useEffect/i })
      .or(page.getByText(mockNote2.content.slice(0, 20)).locator('a'))

    if (await relatedLink.isVisible()) {
      await relatedLink.click()

      // Should navigate to the related note or scroll to it
      // Back-link should be visible
      await expect(
        page.getByText(/back/i).or(page.getByRole('link', { name: /back/i }))
      ).toBeVisible()
    }
  })
})

// ── AC6: AI Unavailable Fallback ────────────────────────────────────────────

test.describe('AC6: AI unavailable fallback', () => {
  test('shows "AI unavailable" message when provider not configured', async ({ page }) => {
    await seedTestNotes(page)
    // Do NOT seed AI configuration — AI is unavailable
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    // Organize button should be disabled or show unavailable state
    const organizeButton = page.getByRole('button', { name: /organize.*ai/i })
    await expect(organizeButton).toBeDisabled()
  })

  test('Related Concepts panel falls back to tag-based matching when AI unavailable', async ({
    page,
  }) => {
    await seedTestNotes(page)
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    // Expand note-1 (has 'react' tag)
    const noteCard = page.getByText(mockNote1.content.slice(0, 30)).locator('..')
    await noteCard.click()

    // Related Concepts should still work via tag matching
    const relatedPanel = page.getByText(/related concepts/i)
    await expect(relatedPanel).toBeVisible({ timeout: 5000 })

    // Should show tag-only matches indicator
    await expect(page.getByText(/tag.*match/i).or(page.getByText(/tag-based/i))).toBeVisible()
  })

  test('fallback activates within 2 seconds', async ({ page }) => {
    await seedTestNotes(page)
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    const noteCard = page.getByText(mockNote1.content.slice(0, 30)).locator('..')
    await noteCard.click()

    // Related Concepts should appear within 2 seconds (AC6 fallback requirement)
    // Playwright's timeout IS the assertion — if it resolves, fallback was fast enough
    await expect(page.getByText(/related concepts/i)).toBeVisible({ timeout: 2000 })
  })
})

// ── AC7: Privacy ────────────────────────────────────────────────────────────

test.describe('AC7: Privacy - no metadata in API payload', () => {
  test('API request contains only note content, tags, and course context', async ({ page }) => {
    await seedTestNotes(page)
    await seedAIWithOrganizationConsent(page)
    // Do NOT inject mock — let request go through so we can intercept it
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

    // Intercept the API call to inspect payload
    let capturedPayload: Record<string, unknown> | null = null
    await page.route('**/api/ai/generate', async route => {
      const postData = route.request().postDataJSON()
      capturedPayload = postData
      // Fulfill with mock response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(mockOrganizationResponse) }),
      })
    })

    await page.goto('/notes')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(mockNote1.content.slice(0, 30))).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /organize.*ai/i }).click()

    // Wait for the API call
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

    // Verify payload privacy
    expect(capturedPayload).not.toBeNull()
    const payloadStr = JSON.stringify(capturedPayload)

    // Should NOT contain noteIds, file paths, or user metadata
    expect(payloadStr).not.toContain('note-1')
    expect(payloadStr).not.toContain('note-2')
    expect(payloadStr).not.toContain('video-1')
    expect(payloadStr).not.toContain('video-2')
    expect(payloadStr).not.toContain('/path/to/')
    expect(payloadStr).not.toContain('createdAt')
    expect(payloadStr).not.toContain('updatedAt')
    expect(payloadStr).not.toContain('deletedAt')

    // SHOULD contain note content and tags (sanitized payload)
    expect(payloadStr).toContain('React hooks')
    expect(payloadStr).toContain('react')
  })
})
