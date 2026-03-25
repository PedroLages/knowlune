## Edge Case Review — E18-S11 (2026-03-23)

### Unhandled Edge Cases

**`src/stores/useQuizStore.ts:157`** — `courseId is empty string or does not match any IDB record`
> Consequence: setItemStatus called with empty courseId; junk IDB record written
> Guard: `if (!courseId) return; // before db.courses.get(courseId)`

---

**`src/stores/useQuizStore.ts:161`** — `currentQuiz.lessonId is undefined or empty string`
> Consequence: Content progress record written with empty itemId; silent data corruption
> Guard: `if (!currentQuiz.lessonId) return; // before setItemStatus call`

---

**`src/stores/useContentProgressStore.ts:127-135`** — `setItemStatus IDB persist fails after optimistic Zustand update`
> Consequence: Quiz marked passed in IDB but lesson shows not-completed in UI
> Guard: `// Zustand rolls back statusMap but quiz attempt already committed — caller (submitQuiz) has no rollback for content progress; divergent state`

---

**`src/stores/useQuizStore.ts:108` (via `calculateQuizScore`)** — `quiz.passingScore is undefined or NaN`
> Consequence: percentage >= NaN is false; passing quiz never marks lesson complete
> Guard: `const passed = Number.isFinite(quiz.passingScore) && percentage >= quiz.passingScore;`

---

**`src/stores/useContentProgressStore.ts:90`** — `modules array is empty because course not found in IDB`
> Consequence: Module progress badge stays not-started even when lesson is completed
> Guard: `// No cascade when modules=[]; lesson IS marked completed but parent module status not updated — silent correctness gap`

---

**`tests/e2e/story-18-11.spec.ts:91`** — `indexedDB.open('ElearningDB') opens stale version without contentProgress store`
> Consequence: getContentProgressEntry resolves null; AC1 test false-fails with misleading error
> Guard: `indexedDB.open('ElearningDB', <current_version>) // pin version to avoid old-schema open`

---

**`tests/e2e/story-18-11.spec.ts:131`** — `seedIndexedDBStore called before app fully opens and versions the IDB`
> Consequence: Seed opens wrong IDB version; app later upgrades and loses seeded data
> Guard: `await page.waitForFunction(() => !!window.__dexieReady) // or wait for app IDB init signal before seeding`

---

**`tests/e2e/story-18-11.spec.ts:183-185`** — `entry is null due to silent IDB write failure on fail-quiz path`
> Consequence: AC2 test passes even when setItemStatus errored instead of being correctly skipped
> Guard: `// Distinguish: assert entry is strictly null AND no console errors, not just status !== 'completed'`

---

**`tests/e2e/story-18-11.spec.ts:147-186`** — `no afterEach IDB cleanup; browser context reuse bleeds seeded data`
> Consequence: Seeded quiz/course from AC1 test present during AC2 test; false positives possible
> Guard: `test.afterEach(async ({ page }) => { await page.evaluate(() => indexedDB.deleteDatabase('ElearningDB')) })`

---

**Total:** 9 unhandled edge cases found.
