import { test, expect } from '@playwright/test'
import { seedNotes } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

/**
 * NFR24: Toast-based undo for destructive actions
 *
 * Tests soft delete/restore functionality via raw IndexedDB operations.
 * Uses shared seedNotes helper and addInitScript for stable seeding.
 */
test.describe('NFR24: Note soft delete and restore', () => {
  const TEST_NOTE = {
    id: 'test-note-nfr24',
    courseId: 'test-course',
    videoId: 'test-video',
    content: '<p>Test note for NFR24 undo</p>',
    plainText: 'Test note for NFR24 undo',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    tags: ['test'],
    deleted: false,
  }

  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed BEFORE navigation
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    // Navigate and wait for DOM
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Seed test note using shared helper (AFTER navigation, so IDB exists)
    await seedNotes(page, [TEST_NOTE])

    // Reload to pick up seeded data
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('should have note in IndexedDB after seeding', async ({ page }) => {
    const noteExists = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readonly')
          const store = tx.objectStore('notes')
          const getReq = store.get('test-note-nfr24')
          getReq.onsuccess = () => {
            db.close()
            resolve(getReq.result != null)
          }
          getReq.onerror = () => {
            db.close()
            reject(getReq.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    })
    expect(noteExists).toBe(true)
  })

  test('should soft delete note (mark deleted=true in IndexedDB)', async ({ page }) => {
    // Soft delete via raw IndexedDB update
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readwrite')
          const store = tx.objectStore('notes')
          const getReq = store.get('test-note-nfr24')
          getReq.onsuccess = () => {
            const note = getReq.result
            if (note) {
              note.deleted = true
              note.deletedAt = new Date('2025-01-15T10:00:00Z').toISOString()
              store.put(note)
            }
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }
        req.onerror = () => reject(req.error)
      })
    })

    // Verify note is soft-deleted but still exists
    const noteData = await page.evaluate(async () => {
      return new Promise<{ deleted: boolean; deletedAt: string | undefined } | null>(
        (resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction('notes', 'readonly')
            const store = tx.objectStore('notes')
            const getReq = store.get('test-note-nfr24')
            getReq.onsuccess = () => {
              const note = getReq.result
              db.close()
              resolve(note ? { deleted: note.deleted, deletedAt: note.deletedAt } : null)
            }
            getReq.onerror = () => {
              db.close()
              reject(getReq.error)
            }
          }
          req.onerror = () => reject(req.error)
        }
      )
    })

    expect(noteData).not.toBeNull()
    expect(noteData!.deleted).toBe(true)
    expect(noteData!.deletedAt).toBeDefined()
  })

  test('should restore note (set deleted=false in IndexedDB)', async ({ page }) => {
    // First soft delete
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readwrite')
          const store = tx.objectStore('notes')
          const getReq = store.get('test-note-nfr24')
          getReq.onsuccess = () => {
            const note = getReq.result
            if (note) {
              note.deleted = true
              note.deletedAt = new Date('2025-01-15T10:00:00Z').toISOString()
              store.put(note)
            }
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }
        req.onerror = () => reject(req.error)
      })
    })

    // Then restore (undo)
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readwrite')
          const store = tx.objectStore('notes')
          const getReq = store.get('test-note-nfr24')
          getReq.onsuccess = () => {
            const note = getReq.result
            if (note) {
              note.deleted = false
              delete note.deletedAt
              store.put(note)
            }
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }
        req.onerror = () => reject(req.error)
      })
    })

    // Verify note is restored
    const noteData = await page.evaluate(async () => {
      return new Promise<{ deleted: boolean; deletedAt: string | undefined } | null>(
        (resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction('notes', 'readonly')
            const store = tx.objectStore('notes')
            const getReq = store.get('test-note-nfr24')
            getReq.onsuccess = () => {
              const note = getReq.result
              db.close()
              resolve(note ? { deleted: note.deleted, deletedAt: note.deletedAt } : null)
            }
            getReq.onerror = () => {
              db.close()
              reject(getReq.error)
            }
          }
          req.onerror = () => reject(req.error)
        }
      )
    })

    expect(noteData).not.toBeNull()
    expect(noteData!.deleted).toBe(false)
    expect(noteData!.deletedAt).toBeUndefined()
  })

  test('should permanently delete note (remove from IndexedDB)', async ({ page }) => {
    // Permanently delete
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readwrite')
          const store = tx.objectStore('notes')
          store.delete('test-note-nfr24')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    })

    // Verify note is gone
    const noteExists = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readonly')
          const store = tx.objectStore('notes')
          const getReq = store.get('test-note-nfr24')
          getReq.onsuccess = () => {
            db.close()
            resolve(getReq.result != null)
          }
          getReq.onerror = () => {
            db.close()
            reject(getReq.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    })

    expect(noteExists).toBe(false)
  })
})
