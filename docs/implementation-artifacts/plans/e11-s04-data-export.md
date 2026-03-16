# E11-S04: Data Export — Implementation Plan

## Context

LevelUp stores learning data across 15 IndexedDB tables (Dexie v14) and localStorage. The current export (`src/lib/settings.ts:exportAllData()`) only covers localStorage — losing all IndexedDB data (notes, sessions, challenges, progress, etc.). This story adds comprehensive multi-format export (JSON, CSV, Markdown), Open Badges achievement export, xAPI-compatible activity logging, and JSON re-import with schema migration.

**Key constraints:**
- `FileSystemFileHandle`/`FileSystemDirectoryHandle` objects **cannot be serialized** — excluded from export
- `Blob` fields (screenshots, thumbnails) — convert to base64 for JSON, exclude from CSV
- No dedicated achievements table exists — synthesize Open Badges from completed challenges + streak milestones
- Performance: all exports must complete within 30 seconds

---

## Task 1: Export Service Core — JSON Serializer (AC1)

**Create** `src/lib/exportService.ts`

### 1.1 Define export schema envelope

```typescript
interface LevelUpExport {
  schemaVersion: number        // Current: 14 (matches Dexie schema)
  exportedAt: string           // ISO 8601
  appVersion: string           // from package.json
  data: {
    settings: Record<string, unknown>   // localStorage
    importedCourses: Omit<ImportedCourse, 'directoryHandle'>[]
    importedVideos: Omit<ImportedVideo, 'fileHandle'>[]
    importedPdfs: Omit<ImportedPdf, 'fileHandle'>[]
    progress: VideoProgress[]
    bookmarks: VideoBookmark[]
    notes: Note[]
    studySessions: StudySession[]
    contentProgress: ContentProgress[]
    challenges: Challenge[]
    reviewRecords: ReviewRecord[]
    learningPath: LearningPathCourse[]
    aiUsageEvents: AIUsageEvent[]
    // Excluded: screenshots, courseThumbnails (Blobs), embeddings (large vectors)
  }
}
```

### 1.2 Implement `exportAllAsJson()`

- Query each Dexie table via `db.tableName.toArray()`
- Strip non-serializable fields (FileSystemHandles) using destructuring
- Merge with localStorage settings
- Return `LevelUpExport` object

### 1.3 File download helper

- Create `src/lib/fileDownload.ts` with:
  - `downloadJson(data, filename)` — `Blob` + `URL.createObjectURL` + anchor click
  - `downloadZip(files, filename)` — use lightweight zip library (see Task 2)

**Files:** `src/lib/exportService.ts` (new), `src/lib/fileDownload.ts` (new)

---

## Task 2: CSV Export (AC2)

**Add to** `src/lib/exportService.ts`

### 2.1 CSV serializer

- `exportSessionsCsv()` — columns: id, courseId, contentItemId, startTime, endTime, duration, idleTime, sessionType, qualityScore
- `exportProgressCsv()` — columns: courseId, itemId, status, updatedAt
- `exportStreaksCsv()` — derive from studySessions: date, sessionCount, totalMinutes, streakDay

### 2.2 Zip bundling

- Use **JSZip** (`npm install jszip`) — lightweight, well-maintained, browser-native
- Bundle: `sessions.csv`, `progress.csv`, `streaks.csv` → `levelup-export-{date}.zip`

**Files:** `src/lib/exportService.ts`, `src/lib/csvSerializer.ts` (new)

---

## Task 3: Markdown Notes Export (AC3)

**Reuse** existing `src/lib/noteExport.ts` patterns

### 3.1 Bulk note export

- For each note: generate YAML frontmatter (title from first line, course, topic from tags, tags, createdAt, updatedAt, lastReviewedAt from reviewRecords)
- Use existing `sanitizeFilename()` and Turndown service from `noteExport.ts`
- Bundle all `.md` files into zip

### 3.2 Enhance frontmatter

- Add `lastReviewedAt` field by joining with `reviewRecords` table on noteId
- Add `course` field by joining with `importedCourses` table on courseId

**Files:** `src/lib/exportService.ts` (add `exportNotesAsMarkdown()`), reuse `src/lib/noteExport.ts`

---

## Task 4: xAPI Activity Logging (AC4)

**Create** `src/lib/xapiStatements.ts`

### 4.1 Define xAPI statement structure

```typescript
interface XAPIStatement {
  actor: { name: string; mbox: string }
  verb: { id: string; display: Record<string, string> }
  object: { id: string; definition: { name: Record<string, string>; type: string } }
  result?: { duration?: string; completion?: boolean; score?: { scaled: number } }
  timestamp: string
}
```

### 4.2 Statement generators

- `sessionToXAPI(session, course)` → verb: "experienced" or "completed"
- `progressToXAPI(progress, course)` → verb: "progressed"
- `challengeToXAPI(challenge)` → verb: "completed" (if completedAt set)

### 4.3 Integration

- Add `exportAsXAPI()` to exportService — transforms existing data into xAPI statements
- **No runtime logging changes** — xAPI is an export format, not a new logging layer. We transform existing session/progress data into xAPI statements at export time.

**Files:** `src/lib/xapiStatements.ts` (new), `src/lib/exportService.ts`

---

## Task 5: Open Badges v3.0 Export (AC5)

**Create** `src/lib/openBadges.ts`

### 5.1 Synthesize achievements from existing data

Sources:
- **Completed challenges** (`challenges` table where `completedAt` is set)
- **Streak milestones** (from localStorage `streak-milestones` — `StreakMilestone[]`)

### 5.2 Generate Open Badges v3.0 JSON

```typescript
interface OpenBadgeCredential {
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"]
  type: ["VerifiableCredential", "OpenBadgeCredential"]
  issuer: { type: "Profile"; name: string }
  issuanceDate: string
  credentialSubject: {
    type: "AchievementSubject"
    achievement: {
      type: "Achievement"
      name: string
      criteria: { narrative: string }
    }
  }
  evidence?: Array<{ type: "Evidence"; narrative: string }>
}
```

### 5.3 Badge types

- Challenge completion: "Completed [challenge name] — [type] challenge"
- Streak milestone: "Achieved [N]-day study streak"
- Bundle all badges into single JSON array or zip of individual files

**Files:** `src/lib/openBadges.ts` (new), `src/lib/exportService.ts`

---

## Task 6: JSON Re-Import with Schema Migration (AC6)

**Add to** `src/lib/exportService.ts`

### 6.1 Import pipeline

1. Parse JSON, validate `schemaVersion` field exists
2. Type-check top-level structure against `LevelUpExport` interface
3. If `schemaVersion < 14`: apply forward migrations (map old field names → current)
4. Clear existing data (with confirmation) or merge
5. Write to IndexedDB via `db.tableName.bulkPut()`
6. Write localStorage settings

### 6.2 Schema migration registry

```typescript
const migrations: Record<number, (data: LevelUpExport) => LevelUpExport> = {
  // Future: add migrations as schema evolves
  // For now, v14 is the first export schema — no migrations needed yet
}
```

### 6.3 Fidelity verification

- After import: count records per table, compare with export metadata
- Report any discrepancies (logged, not blocking)

**Files:** `src/lib/exportService.ts`

---

## Task 7: Export UI — Settings Page (AC7)

**Modify** `src/app/pages/Settings.tsx`

### 7.1 Replace existing Data Management card content

Replace the simple Export/Import cards (lines 480-538) with:

- **Export Your Data** section with 3 export row cards:
  - Full Data Export (JSON / CSV format toggle)
  - Notes Export (Markdown)
  - Achievements Export (Open Badges)
- **Import Data** section (enhanced for JSON re-import with validation)
- Keep existing Danger Zone section unchanged

### 7.2 Export state management

- `useState` for: `isExporting`, `exportProgress` (0-100), `exportFormat`, `exportPhase` (string label)
- Progress callback passed to export service: `onProgress(percent, phase)`

### 7.3 Progress indicator

- Reuse existing `<Progress>` component with same styling as avatar upload
- Show phase label: "Exporting sessions (2/5 tables)..."
- `data-testid="data-export-section"` on container
- `data-testid="export-progress"` on progress bar

### 7.4 Background export

- Use `async/await` with `requestAnimationFrame` yielding between table exports
- Not a Web Worker (Dexie doesn't easily work in workers) — but async generator pattern keeps UI responsive

**Files:** `src/app/pages/Settings.tsx`

---

## Task 8: Error Handling and Cleanup (AC8)

**Integrated across all tasks**

### 8.1 Error detection

- Catch `DOMException` (QuotaExceededError, NotAllowedError)
- Catch Blob/download failures
- Wrap all export operations in try/catch

### 8.2 Toast notifications

- Success: `toastSuccess.exported('All data')` (existing helper)
- Error: `toastError.saveFailed('Export failed — try freeing disk space')` (existing helper)
- For import: use `toastPromise` for loading/success/error states

### 8.3 Cleanup

- On export failure: revoke any created object URLs
- On import failure: no partial writes (use Dexie transaction for atomicity)

**Files:** Integrated into `src/lib/exportService.ts` and `Settings.tsx`

---

## Implementation Order

| Step | Task | Files | Commit after |
|------|------|-------|-------------|
| 1 | Install JSZip dependency | `package.json` | Yes |
| 2 | Task 1: JSON export service + file download helper | `src/lib/exportService.ts`, `src/lib/fileDownload.ts` | Yes |
| 3 | Task 2: CSV serializer + zip bundling | `src/lib/csvSerializer.ts`, update `exportService.ts` | Yes |
| 4 | Task 3: Markdown notes export (reuse noteExport.ts) | update `exportService.ts` | Yes |
| 5 | Task 4: xAPI statement generator | `src/lib/xapiStatements.ts` | Yes |
| 6 | Task 5: Open Badges generator | `src/lib/openBadges.ts` | Yes |
| 7 | Task 7: Settings page UI (export section + progress) | `src/app/pages/Settings.tsx` | Yes |
| 8 | Task 6: JSON re-import with validation | update `exportService.ts`, `Settings.tsx` | Yes |
| 9 | Task 8: Error handling polish + cleanup | All files | Yes |
| 10 | Unit tests for serializers | `src/lib/__tests__/exportService.test.ts` etc. | Yes |

---

## Verification

1. **Build**: `npm run build` — no TypeScript errors
2. **Lint**: `npm run lint` — no ESLint violations
3. **Unit tests**: `npm run test:unit` — all serializer tests pass
4. **E2E tests**: `npx playwright test tests/e2e/story-e11-s04.spec.ts` — all 6 ATDD tests pass
5. **Manual test**: Settings → Export JSON → verify file contains schema version + all data tables
6. **Round-trip**: Export JSON → Reset data → Import JSON → verify data restored

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Dexie schema (v14), all table definitions |
| `src/data/types.ts` | TypeScript interfaces for all data types |
| `src/lib/settings.ts` | Current localStorage-only export (to be replaced) |
| `src/lib/noteExport.ts` | Existing Markdown export with Turndown + YAML frontmatter |
| `src/lib/toastHelpers.ts` | Toast notification helpers (success/error/promise/undo) |
| `src/app/pages/Settings.tsx` | Settings page with Data Management card (lines 466-597) |
| `src/app/components/ui/progress.tsx` | Progress bar component |
