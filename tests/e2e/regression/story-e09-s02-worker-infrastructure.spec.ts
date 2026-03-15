import { test, expect } from '@playwright/test'
import { mockEmbeddingWorker } from '../../support/helpers/mock-workers'

test.describe('E09-S02: Web Worker Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmbeddingWorker(page)
  })

  test('AC7: Dexie schema v9 has embeddings table', async ({ page }) => {
    await page.goto('/')

    const hasTable = await page.evaluate(async () => {
      return new Promise<boolean>(resolve => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = event => {
          const db = (event.target as IDBOpenDBRequest).result
          resolve(db.objectStoreNames.contains('embeddings'))
          db.close()
        }
        request.onerror = () => resolve(false)
      })
    })

    expect(hasTable).toBe(true)
  })

  test('AC1: coordinator spawns mock worker and returns embedding result', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { generateEmbeddings } = await import('/src/ai/workers/coordinator.ts')
      const embeddings = await generateEmbeddings(['test text'])
      // Float32Array doesn't serialize across page.evaluate — convert to plain array
      return { count: embeddings.length, dims: Array.from(embeddings[0]).length }
    })

    expect(result.count).toBe(1)
    expect(result.dims).toBe(384)
  })

  test('AC6: load-index then search returns top-K results sorted by score', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { coordinator } = await import('/src/ai/workers/coordinator.ts')
      await coordinator.executeTask('load-index', {
        vectors: { 'note-1': new Float32Array(384), 'note-2': new Float32Array(384) },
      })
      const searchResult = await coordinator.executeTask<{
        results: Array<{ noteId: string; score: number }>
      }>('search', { queryVector: new Float32Array(384), topK: 2 })
      return searchResult.results
    })

    expect(result[0].noteId).toBe('note-1')
    expect(result[0].score).toBe(0.95)
    expect(result[1].score).toBeLessThan(result[0].score)
  })
})
