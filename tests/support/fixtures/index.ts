/**
 * Merged test fixtures for EduVi E2E tests.
 *
 * Usage:
 *   import { test, expect } from '../support/fixtures'
 *
 * Provides:
 *   - localStorageFixture: seed/clear localStorage between tests
 *   - indexedDBFixture: seed/clear IndexedDB (Dexie) between tests
 *   - courseFactory: generate Course/Module/Lesson data
 */
import { mergeTests } from '@playwright/test'
import { test as localStorageTest } from './local-storage-fixture'
import { test as indexedDBTest } from './indexeddb-fixture'

export const test = mergeTests(localStorageTest, indexedDBTest)

export { expect } from '@playwright/test'
