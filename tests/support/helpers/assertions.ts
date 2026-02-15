/**
 * Common assertion helpers for LevelUp E2E tests.
 *
 * Lightweight wrappers for frequent checks. Keep actual expect()
 * calls in test bodies — these helpers only prepare data or
 * extract values for assertions.
 *
 * Reference: TEA knowledge base - test-quality.md (explicit assertions)
 */
import type { Page, Locator } from '@playwright/test'

/** Get the text content of all matching locators as an array. */
export async function getTextContents(locator: Locator): Promise<string[]> {
  return locator.allTextContents()
}

/** Check if the sidebar navigation has the expected active item. */
export async function getActiveSidebarItem(page: Page): Promise<string | null> {
  const active = page.locator('nav a[aria-current="page"], nav a.bg-blue-600, nav a.active')
  const count = await active.count()
  if (count === 0) return null
  return active.first().textContent()
}

/** Get all stat card values from the Overview page. */
export async function getStatCardValues(page: Page): Promise<string[]> {
  const statValues = page.locator('.text-3xl.font-bold')
  return statValues.allTextContents()
}
