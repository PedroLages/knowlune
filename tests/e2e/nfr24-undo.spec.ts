import { test, expect } from '@playwright/test'
import { FIXED_DATE } from '../utils/test-time'

/**
 * NFR24: Toast-based undo for destructive actions
 *
 * This test validates the soft delete/restore functionality at the store level.
 * The visual UI testing (toast with undo button) is covered by component tests.
 */
test.describe('NFR24: Note soft delete and restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Seed a test note into IndexedDB
    await page.evaluate(async () => {
      const request = indexedDB.open('ElearningDB')
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = async () => {
          const db = request.result
          const tx = db.transaction(['notes'], 'readwrite')
          const store = tx.objectStore('notes')

          const testNote = {
            id: 'test-note-nfr24',
            courseId: 'test-course',
            videoId: 'test-video',
            content: '<p>Test note for NFR24</p>',
            createdAt: FIXED_DATE,
            updatedAt: FIXED_DATE,
            tags: ['test'],
          }

          store.add(testNote)

          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    })
  })

  test('should soft delete note and allow restore', async ({ page }) => {
    // Call softDelete from the browser context
    const result = await page.evaluate(async () => {
      // Import and use the store
      const { useNoteStore } = await import('/src/stores/useNoteStore.ts')

      const store = useNoteStore.getState()

      // Load the note first and wait for state to update
      await store.loadNotes()

      // Wait a tick for Zustand state update
      await new Promise(resolve => setTimeout(resolve, 0))

      const notesBefore = useNoteStore.getState().notes
      if (notesBefore.length === 0) {
        return { error: 'No notes found', notesCount: notesBefore.length }
      }

      const noteId = 'test-note-nfr24'

      // Soft delete
      useNoteStore.getState().softDelete(noteId)

      // Check the note is marked as deleted
      const deletedNote = useNoteStore.getState().notes.find(n => n.id === noteId)
      const isSoftDeleted = deletedNote?.deleted === true
      const hasDeletedAt = typeof deletedNote?.deletedAt === 'string'

      // Restore
      useNoteStore.getState().restoreNote(noteId)

      // Check the note is restored
      const restoredNote = useNoteStore.getState().notes.find(n => n.id === noteId)
      const isRestored = restoredNote?.deleted === false
      const deletedAtCleared = restoredNote?.deletedAt === undefined

      return {
        isSoftDeleted,
        hasDeletedAt,
        isRestored,
        deletedAtCleared,
        notesCount: useNoteStore.getState().notes.length,
      }
    })

    // Assertions
    expect(result.isSoftDeleted).toBe(true)
    expect(result.hasDeletedAt).toBe(true)
    expect(result.isRestored).toBe(true)
    expect(result.deletedAtCleared).toBe(true)
    expect(result.notesCount).toBe(1) // Note still in state after soft delete
  })

  test('should keep note in state during soft delete', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { useNoteStore } = await import('/src/stores/useNoteStore.ts')

      await useNoteStore.getState().loadNotes()
      await new Promise(resolve => setTimeout(resolve, 0))

      const countBefore = useNoteStore.getState().notes.length

      useNoteStore.getState().softDelete('test-note-nfr24')

      const countAfter = useNoteStore.getState().notes.length

      return {
        countBefore,
        countAfter,
        noteStillExists: countAfter === countBefore,
      }
    })

    expect(result.countBefore).toBe(1)
    expect(result.countAfter).toBe(1)
    expect(result.noteStillExists).toBe(true)
  })

  test('should allow undo by calling restoreNote within timeout window', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { useNoteStore } = await import('/src/stores/useNoteStore.ts')

      await useNoteStore.getState().loadNotes()
      await new Promise(resolve => setTimeout(resolve, 0))

      // Simulate the undo flow
      const noteId = 'test-note-nfr24'

      // 1. Soft delete (immediate)
      useNoteStore.getState().softDelete(noteId)
      const afterDelete = useNoteStore.getState().notes.find(n => n.id === noteId)

      // 2. Restore within 10 seconds (simulated - no actual wait needed)
      useNoteStore.getState().restoreNote(noteId)
      const afterRestore = useNoteStore.getState().notes.find(n => n.id === noteId)

      return {
        wasDeleted: afterDelete?.deleted === true,
        wasRestored: afterRestore?.deleted === false,
        finalCount: useNoteStore.getState().notes.length,
      }
    })

    expect(result.wasDeleted).toBe(true)
    expect(result.wasRestored).toBe(true)
    expect(result.finalCount).toBe(1)
  })

  test('should permanently delete after timeout (simulated)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { useNoteStore } = await import('/src/stores/useNoteStore.ts')

      await useNoteStore.getState().loadNotes()
      await new Promise(resolve => setTimeout(resolve, 0))

      const noteId = 'test-note-nfr24'

      // Soft delete
      useNoteStore.getState().softDelete(noteId)

      // Simulate timeout - call permanent deleteNote
      await useNoteStore.getState().deleteNote(noteId)

      // Check note is removed
      const noteExists = useNoteStore.getState().notes.find(n => n.id === noteId)

      return {
        noteRemoved: noteExists === undefined,
        finalCount: useNoteStore.getState().notes.length,
      }
    })

    expect(result.noteRemoved).toBe(true)
    expect(result.finalCount).toBe(0)
  })
})
