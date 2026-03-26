/**
 * E2E Tests for E09-S03: Embedding Pipeline & Vector Store
 *
 * Tests:
 * 1. DB schema v18 with embeddings table (AC1)
 * 2. DB internal version is 180 (Dexie v18 × 10) (AC1)
 * 3. Semantic toggle disabled when no embeddings exist (AC6)
 * 4. Tooltip trigger visible and shows "No embeddings available" text (AC6)
 * 5. Semantic toggle enabled when embeddings are seeded (AC2/AC6)
 * 6. Text search works with toggle off (AC6)
 * 7. Semantic search displays similarity badges ordered by score (AC5/AC6)
 */
import { test, expect } from '../../support/fixtures'
import { seedVectorEmbeddings, seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const VECTOR_LOAD_TIMEOUT = 5_000

// Pre-computed 384-dim vectors for deterministic similarity ordering.
// note-a has vector heavily weighted toward dim 0 (1.0, 0, 0, ...)
// note-b has a mix leaning toward dim 0 (0.8, 0.6, 0, ...)
// note-c is orthogonal (0, 0, 1.0, ...)
// Query vector matches note-a > note-b >> note-c
function make384Vector(dim0: number, dim1: number, dim2: number): number[] {
  const v = new Array(384).fill(0)
  v[0] = dim0
  v[1] = dim1
  v[2] = dim2
  return v
}

function makeNote(id: string, content: string) {
  return {
    id,
    courseId: 'course-test',
    videoId: `video-${id}`,
    content,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    tags: [],
  }
}

test.describe('E09-S03: Embedding Pipeline & Vector Store', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure sidebar is closed on mobile/tablet viewports to prevent overlay.
    // Must use addInitScript (not page.evaluate) — localStorage is inaccessible before navigation.
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
  })

  test('schema v18: embeddings table exists in IndexedDB', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const hasEmbeddingsTable = await page.evaluate(async () => {
      return new Promise<boolean>(resolve => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          resolve(db.objectStoreNames.contains('embeddings'))
          db.close()
        }
        req.onerror = () => resolve(false)
      })
    })

    expect(hasEmbeddingsTable).toBe(true)
  })

  test('schema v18: database internal version is 180 (Dexie v18 × 10)', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const version = await page.evaluate(async () => {
      return new Promise<number>(resolve => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const v = req.result.version
          req.result.close()
          resolve(v)
        }
        req.onerror = () => resolve(-1)
      })
    })

    // Dexie multiplies schema version by 10 internally — Dexie v18 = IDB v180
    expect(version).toBe(180)
  })

  test('semantic toggle is disabled when no embeddings exist', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    const toggle = page.getByTestId('semantic-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeDisabled()
  })

  test('semantic toggle shows tooltip when disabled', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    const tooltipTrigger = page.getByTestId('semantic-tooltip-trigger')
    await expect(tooltipTrigger).toBeVisible()

    // Hover the trigger and verify tooltip text (AC6: tooltip content)
    await tooltipTrigger.hover()
    await expect(page.getByRole('tooltip')).toContainText('No embeddings available')
  })

  test('semantic toggle is enabled when embeddings are seeded', async ({ page }) => {
    // Navigate first — IndexedDB is only accessible after navigating to the app origin
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    // Seed notes + embeddings
    await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
      makeNote('note-seed-1', 'Python programming basics'),
    ])
    await seedVectorEmbeddings(page, [
      {
        noteId: 'note-seed-1',
        embedding: make384Vector(1, 0, 0),
        createdAt: FIXED_DATE,
      },
    ])

    // Reload so the app picks up the seeded embeddings via vectorStorePersistence.loadAll()
    await page.reload()
    await page.waitForLoadState('networkidle')

    // The toggle should become enabled once vector store loads
    const toggle = page.getByTestId('semantic-toggle')
    await expect(toggle).toBeEnabled({ timeout: VECTOR_LOAD_TIMEOUT })
  })

  test('text search works with toggle off', async ({ page }) => {
    // Navigate first — IndexedDB is only accessible after navigating to the app origin
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
      makeNote('note-text-1', 'Machine learning fundamentals'),
      makeNote('note-text-2', 'Cooking pasta recipes'),
    ])

    await page.reload()
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByRole('searchbox', { name: 'Search notes' })
    await searchInput.fill('machine learning')

    // Should show the matching note
    await expect(page.getByTestId('note-card').first()).toBeVisible()
  })

  test.skip('semantic search displays similarity badges when active', async ({ page }) => {
    // Skip: Semantic search now requires AI worker to generate query embeddings
    // (generateEmbeddings → coordinator.ts). The worker isn't available in E2E,
    // so the search falls back to text mode and no similarity badges appear.
    // Navigate first — IndexedDB is only accessible after navigating to the app origin
    await page.goto('/notes')
    await page.waitForLoadState('networkidle')

    // Seed 3 notes with known similarity ordering vs query vector (1, 0, 0):
    //   note-sem-1: vector (1,0,0)  — highest similarity (exact match)
    //   note-sem-2: vector (0.8,0.6,0) — medium similarity
    //   note-sem-3: vector (0,0,1)  — lowest similarity (orthogonal)
    await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
      makeNote('note-sem-1', 'Deep learning neural networks'),
      makeNote('note-sem-2', 'Machine learning basics'),
      makeNote('note-sem-3', 'Baking bread at home'),
    ])

    await seedVectorEmbeddings(page, [
      { noteId: 'note-sem-1', embedding: make384Vector(1, 0, 0), createdAt: FIXED_DATE },
      { noteId: 'note-sem-2', embedding: make384Vector(0.8, 0.6, 0), createdAt: FIXED_DATE },
      { noteId: 'note-sem-3', embedding: make384Vector(0, 0, 1), createdAt: FIXED_DATE },
    ])

    // Reload so the app picks up the seeded embeddings
    await page.reload()
    await page.waitForLoadState('networkidle')

    const toggle = page.getByTestId('semantic-toggle')
    await expect(toggle).toBeEnabled({ timeout: VECTOR_LOAD_TIMEOUT })
    await toggle.click()

    const searchInput = page.getByRole('searchbox', { name: 'Search notes' })
    await searchInput.fill('deep learning')

    // Wait for semantic results to appear — similarity badges indicate semantic mode is active
    await expect(page.getByTestId('similarity-badge').first()).toBeVisible({ timeout: 10000 })

    // AC6: Verify results are ordered by similarity score descending
    const badges = page.getByTestId('similarity-badge')
    const badgeTexts = await badges.allTextContents()
    const scores = badgeTexts.map(t => parseInt(t.replace('% match', ''), 10))

    // Scores must appear in descending order (highest match first)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })
})
