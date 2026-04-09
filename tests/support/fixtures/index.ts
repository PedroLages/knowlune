/**
 * Merged test fixtures for Knowlune E2E tests.
 *
 * Usage:
 *   import { test, expect } from '../support/fixtures'
 *
 * Provides:
 *   - localStorageFixture: seed/clear localStorage between tests
 *   - indexedDBFixture: seed/clear IndexedDB (Dexie) between tests
 *   - libraryPage: library page interaction helper (E107-S04)
 *   - courseFactory: generate Course/Module/Lesson data
 */
import { mergeTests } from '@playwright/test'
import { test as localStorageTest } from './local-storage-fixture'
import { test as indexedDBTest } from './indexeddb-fixture'
import { test as libraryPageTest } from './library-page-fixture'

export const test = mergeTests(localStorageTest, indexedDBTest, libraryPageTest)

export { expect } from '@playwright/test'
