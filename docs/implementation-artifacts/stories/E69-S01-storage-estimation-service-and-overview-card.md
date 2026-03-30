# Story 69.1: Storage Estimation Service and Overview Card

Status: in-progress
reviewed: in-progress
review_started: 2026-03-30
review_gates_passed: []
review_scope: full

## Story

As a learner using Knowlune,
I want to see a visual overview of how much browser storage my learning data is using,
so that I can understand my storage consumption and know when I'm approaching limits.

## Acceptance Criteria

1. **Given** the Settings page is loaded and the browser supports `navigator.storage.estimate()`, **When** the Storage Management card renders, **Then** a horizontal stacked bar chart displays total usage vs quota with 6 color-coded category segments (courses, notes, flashcards, AI search data, thumbnails, transcripts), **And** a summary line shows "Total Usage: ~{size} of ~{quota} ({percentage}%)", **And** a category breakdown legend grid shows each category with colored dot, name, formatted size, and percentage.

2. **Given** the Storage Management card is loading storage estimates, **When** the Dexie table queries are in progress, **Then** skeleton placeholders are shown for the bar chart, legend, and table areas, **And** `aria-busy="true"` is set on the card content.

3. **Given** storage usage is between 80% and 94% of quota, **When** the Storage Management card renders, **Then** an amber warning banner appears with `role="alert"` and `aria-live="polite"`, showing "Storage is getting full" with a dismiss button, **And** dismissing stores the state in sessionStorage so it reappears next session.

4. **Given** storage usage is 95% or above, **When** the Storage Management card renders, **Then** a red critical banner appears with `aria-live="assertive"`, showing "Storage almost full" with a "Free Up Space" button that scrolls to the cleanup section.

5. **Given** the user clicks the "Refresh" button in the card header, **When** the button is clicked, **Then** a loading spinner appears on the button and all storage estimates are re-computed from current Dexie data.

6. **Given** `navigator.storage.estimate()` is not available (e.g., insecure context or unsupported browser), **When** the Storage Management card renders, **Then** a graceful fallback message is shown: "Storage estimation is not available in this browser".

7. **Given** all Dexie tables are empty (no imported courses, no notes, etc.), **When** the Storage Management card renders, **Then** an empty state is shown: "No learning data stored yet. Import a course to get started!"

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/storageEstimate.ts` with types and `formatBytes()` utility (AC: 1)
  - [ ] 1.1 Define `StorageOverview`, `StorageCategoryBreakdown`, `CourseStorageEntry` types
  - [ ] 1.2 Implement `formatBytes(bytes: number): string` — returns "1.2 MB", "450 KB", etc.

- [ ] Task 2: Implement `estimateTableSize()` helper (AC: 1)
  - [ ] 2.1 `estimateTableSize(table, sampleSize=10)` — count * avg sample size
  - [ ] 2.2 Use `new Blob([JSON.stringify(record)]).size` for UTF-8 byte accuracy
  - [ ] 2.3 For blob-heavy tables (courseThumbnails, screenshots), use `blob.size` from the stored data

- [ ] Task 3: Implement `getStorageOverview()` orchestrator (AC: 1, 6, 7)
  - [ ] 3.1 Call `navigator.storage.estimate()` for total usage/quota (return null if unavailable)
  - [ ] 3.2 Estimate each table grouped into 6 categories (see Dev Notes)
  - [ ] 3.3 Use `Promise.allSettled()` for parallel estimation (one failing table should not block others)
  - [ ] 3.4 Return null if Storage API unavailable

- [ ] Task 4: Create `StorageManagement.tsx` card container with loading/error/empty states (AC: 2, 5, 6, 7)
  - [ ] 4.1 Card with `id="storage-management"`, `HardDrive` icon header matching Settings pattern
  - [ ] 4.2 Title: "Storage & Usage", subtitle: "Monitor and manage your local data storage"
  - [ ] 4.3 `useEffect` to call `getStorageOverview()` on mount, store in state
  - [ ] 4.4 Skeleton loading state with `aria-busy="true"`
  - [ ] 4.5 Error state for unavailable Storage API
  - [ ] 4.6 Empty state when no data stored
  - [ ] 4.7 "Refresh" button with spinner in card header area

- [ ] Task 5: Implement `QuotaWarningBanner` inline sub-component (AC: 3, 4)
  - [ ] 5.1 Warning (80-94%): amber with `AlertTriangle`, `role="alert"`, `aria-live="polite"`, dismiss button
  - [ ] 5.2 Critical (95%+): red with `AlertOctagon`, `aria-live="assertive"`, "Free Up Space" scrolls to `#cleanup-actions`
  - [ ] 5.3 Dismiss stores state in `sessionStorage` (reappears next session)
  - [ ] 5.4 Design tokens: `bg-warning-soft border-warning text-warning-foreground` (warning), `bg-destructive/10 border-destructive text-destructive` (critical)

- [ ] Task 6: Implement `StorageOverviewBar` inline sub-component (AC: 1)
  - [ ] 6.1 Summary line: "Total Usage: ~{formattedSize} of ~{quota} ({percentage}%)"
  - [ ] 6.2 Recharts horizontal stacked `BarChart` in shadcn `ChartContainer`
  - [ ] 6.3 6 segments using `chart-1` through `chart-5` + `muted` tokens
  - [ ] 6.4 32px height, `rounded-lg` corners
  - [ ] 6.5 `ChartTooltip` with `ChartTooltipContent` showing category name + formatted size
  - [ ] 6.6 `aria-label="Storage usage breakdown chart"`

- [ ] Task 7: Implement `CategoryBreakdownLegend` inline sub-component (AC: 1)
  - [ ] 7.1 3-column grid (2 on mobile): `grid grid-cols-2 md:grid-cols-3 gap-3`
  - [ ] 7.2 Each cell: colored dot + category name + formatted size + percentage
  - [ ] 7.3 Cell: `rounded-lg border border-border/50 p-3 bg-surface-elevated`
  - [ ] 7.4 `role="list"` with `role="listitem"` for accessibility
  - [ ] 7.5 Visually hidden table as screen reader alternative for chart

- [ ] Task 8: Integrate into Settings.tsx (AC: 1)
  - [ ] 8.1 Import `StorageManagement` from `@/app/components/settings/StorageManagement`
  - [ ] 8.2 Insert `<StorageManagement />` after the Data Management card closing `</Card>` (line ~1135 area) and before `<DataRetentionSettings />`

- [ ] Task 9: Write unit tests for `storageEstimate.ts` (AC: 1, 6, 7)
  - [ ] 9.1 Test `formatBytes()` — 0 bytes, KB, MB, GB, edge cases
  - [ ] 9.2 Test `estimateTableSize()` with mocked Dexie table
  - [ ] 9.3 Test `getStorageOverview()` with mocked `navigator.storage.estimate()` and Dexie tables
  - [ ] 9.4 Test graceful degradation: Storage API unavailable, empty tables, failed table queries

## Dev Notes

### Architecture and Patterns

**Settings Card Pattern** — follow `MyDataSummary.tsx` exactly:
- Card with icon header: `<Card id="storage-management">` + `<CardHeader className="border-b border-border/50 bg-surface-sunken/30">`
- Icon: `HardDrive` in `rounded-full bg-brand-soft p-2`, `text-brand`
- Title: `text-lg font-display`, subtitle: `text-sm text-muted-foreground`
- useEffect with cancelled flag pattern for async data fetch
- Skeleton loading, then render content

**Existing Storage API** — reuse pattern from `src/lib/storageQuotaMonitor.ts`:
- `navigator.storage?.estimate` null-check for browser support
- Try/catch returning null on failure
- Existing `StorageEstimate` type exported from that module (different from our new `StorageOverview` type — no name collision since our types are in `storageEstimate.ts`)

**Category Table Groupings:**
- **Courses**: `importedCourses` + `importedVideos` + `importedPdfs` + `courses`
- **Notes**: `notes` + `screenshots`
- **Flashcards**: `flashcards` + `reviewRecords`
- **AI Search Data** (user-facing name for embeddings): `embeddings`
- **Thumbnails**: `courseThumbnails`
- **Transcripts**: `videoCaptions` + `youtubeTranscripts`

**Chart Configuration** — use shadcn/ui `ChartContainer` with Recharts:
```typescript
const chartConfig: ChartConfig = {
  courses:     { label: "Courses",       color: "var(--chart-1)" },
  notes:       { label: "Notes",         color: "var(--chart-2)" },
  flashcards:  { label: "Flashcards",    color: "var(--chart-3)" },
  embeddings:  { label: "AI Search Data",color: "var(--chart-4)" },
  thumbnails:  { label: "Thumbnails",    color: "var(--chart-5)" },
  transcripts: { label: "Transcripts",   color: "var(--color-muted)" },
}
```

**User-Friendly Terminology** — never expose technical terms:
| Technical | User-Facing |
|-----------|-------------|
| IndexedDB | "browser storage" |
| Embeddings | "AI search data" |
| QuotaExceededError | "Storage is full" |
| `navigator.storage.estimate()` | just show numbers |

**Warning Banner Colors** (design tokens only):
- Warning: `bg-warning-soft border-warning text-warning-foreground`
- Critical: `bg-destructive/10 border-destructive text-destructive`

**Insertion Point in Settings.tsx:**
The card goes AFTER the `<Card id="data-management">` block (which ends around line 1130) and BEFORE `<DataRetentionSettings />` (line 1135). This places storage management between Data Management and Data Retention in the settings flow.

NOTE: `HardDrive` is already imported in Settings.tsx (line 13). The Data Management card already uses it, so StorageManagement should use a different icon or share it.

### Project Structure Notes

- New files: `src/lib/storageEstimate.ts`, `src/app/components/settings/StorageManagement.tsx`, `src/lib/__tests__/storageEstimate.test.ts`
- Modified: `src/app/pages/Settings.tsx` (import + JSX insertion)
- All sub-components (QuotaWarningBanner, StorageOverviewBar, CategoryBreakdownLegend) are inline within `StorageManagement.tsx` — extract to `src/app/components/settings/storage/` if file exceeds ~400 lines

### Key Dependencies

- **Recharts** via shadcn/ui `ChartContainer` — already installed (`src/app/components/ui/chart.tsx`)
- **Dexie** (`src/db/schema.ts`) — 20+ tables, all typed via `ElearningDatabase`
- **shadcn/ui**: Card, Skeleton, Button (all already available)
- **lucide-react**: `HardDrive`, `AlertTriangle`, `AlertOctagon`, `RefreshCw` (all available)
- **toastHelpers**: `toastSuccess`, `toastError` from `@/lib/toastHelpers`

### Testing Strategy

- Mock `navigator.storage` via `vi.stubGlobal`
- Mock Dexie via `vi.mock('@/db')` with controlled `.count()` and `.limit().toArray()` returns
- Test `formatBytes()` pure function exhaustively
- Test `getStorageOverview()` returns null when Storage API unavailable
- Test empty table handling (count=0 returns 0 bytes)
- Test `Promise.allSettled` behavior when one table estimation fails

### References

- [Source: _bmad-output/planning-artifacts/epics-storage-management.md#Story 69.1]
- [Source: _bmad-output/implementation-artifacts/tech-spec-indexeddb-storage-management-dashboard.md#Tasks 1-9]
- [Source: _bmad-output/planning-artifacts/ux-design-storage-management.md#Components 1-4]
- [Source: src/lib/storageQuotaMonitor.ts] — existing Storage API pattern
- [Source: src/app/components/settings/MyDataSummary.tsx] — Settings card pattern reference
- [Source: src/db/schema.ts] — Dexie table definitions

## Challenges and Lessons Learned

- **Storage estimation sampling approach**: Chose `new Blob([JSON.stringify(record)]).size` for UTF-8 byte accuracy when estimating table sizes. Sampling 10 records and extrapolating by count provides a good balance between accuracy and performance for tables with thousands of records.
- **Recharts in shadcn ChartContainer**: The stacked bar chart required inline `style` props for dynamic segment widths — Tailwind can't handle computed percentages at runtime. This triggers the `no-inline-styles` ESLint warning but is the correct pattern for Recharts.
- **Promise.allSettled for resilience**: Using `Promise.allSettled()` instead of `Promise.all()` ensures one failing table estimation (e.g., a corrupted table) doesn't block the entire overview. Each category gracefully falls back to 0 bytes.
- **Category mapping consolidation**: Grouped 20+ Dexie tables into 6 user-facing categories. The mapping lives in `storageEstimate.ts` and needs updating when new tables are added to the schema — this is a maintenance consideration for future stories.
- **Warning banner sessionStorage pattern**: Dismiss state is stored in `sessionStorage` so warnings reappear on new sessions but don't nag within a session. This matches the AC requirement and provides a good UX balance.

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](../plans/e69-s01-storage-estimation-overview-card.md) for implementation approach.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
