# E69-S01: Storage Estimation Service & Overview Card

## Context

Knowlune stores all learning data in IndexedDB (30+ Dexie tables). Users have no visibility into how much browser storage they're consuming or when they're approaching limits. This story adds a storage dashboard card to Settings showing a visual breakdown by category, quota warnings, and a refresh mechanism. It's the foundation for S02 (per-course table) and S03 (cleanup actions).

## Plan

### Task 1: Create `src/lib/storageEstimate.ts`

Pure logic module — types, category mapping, size estimation.

**Types:**
- `StorageCategory` — union of 6 category keys
- `CategoryEstimate` — { category, label, sizeBytes, tableBreakdown }
- `StorageOverview` — { totalUsage, totalQuota, usagePercent, categories[], categorizedTotal, uncategorizedBytes, apiAvailable }

**Category mapping constant:**
| Category | Tables |
|----------|--------|
| courses | importedCourses, importedVideos, importedPdfs |
| notes | notes, screenshots |
| flashcards | flashcards, reviewRecords |
| embeddings | embeddings |
| thumbnails | courseThumbnails |
| transcripts | videoCaptions, youtubeTranscripts |

Unmapped tables (progress, bookmarks, studySessions, quizzes, etc.) are NOT shown — `uncategorizedBytes = totalUsage - categorizedTotal` covers them implicitly. No "Other" bucket.

**Key functions:**
- `estimateTableSize(tableName, sampleSize=5)` — `count * avgSampleSize` via `db.table(name).count()` + `db.table(name).limit(5).toArray()` with `new Blob([JSON.stringify(row)]).size` for byte accuracy. Try/catch returns 0 on failure.
- `getStorageOverview()` — calls `getStorageEstimate()` from storageQuotaMonitor (reuse!), then `Promise.allSettled()` across all mapped tables, aggregates into categories.

**Reuse (do NOT recreate):**
- `formatFileSize()` from `src/lib/format.ts:34` — already formats bytes to "2.4 GB"
- `getStorageEstimate()` from `src/lib/storageQuotaMonitor.ts:47` — already calls navigator.storage.estimate()

### Task 2: Create `src/app/components/settings/StorageManagement.tsx`

Card component following MyDataSummary.tsx pattern exactly. 4 inline sub-components:

**1. StorageManagement (main export)**
- State: overview, loading, refreshing, warningDismissed
- useEffect with cancelled flag → `getStorageOverview()`
- Read `sessionStorage.getItem('storage-warning-dismissed')` on mount
- Refresh button calls `getStorageOverview()` again
- Icon: `BarChart3` (HardDrive already used by Data Management card)
- Card id: `storage-management`
- data-testid: `storage-management-section`

**2. QuotaWarningBanner (inline)**
- 80-94%: amber, `role="alert"`, `aria-live="polite"`, dismiss → sessionStorage
- 95%+: red, `aria-live="assertive"`, "Free Up Space" scrolls to `#data-management` (note: `#cleanup-actions` doesn't exist yet — use `#data-management` for now, update in S03)
- Design tokens: `bg-warning-soft border-warning text-warning-foreground` / `bg-destructive/10 border-destructive text-destructive`

**3. StorageOverviewBar (inline)**
- Summary: "Total Usage: ~{size} of ~{quota} ({percent}%)"
- Recharts `BarChart` with `layout="vertical"`, stacked `<Bar>` per category with `stackId="storage"`
- Single data row: `[{ courses: bytes, notes: bytes, ... }]`
- `ChartContainer` + `ChartTooltip` with `ChartTooltipContent`
- `aria-label="Storage usage breakdown chart"` + visually hidden table for screen readers

**4. CategoryBreakdownLegend (inline)**
- `grid grid-cols-2 md:grid-cols-3 gap-3`
- Cells: `bg-surface-elevated p-3 rounded-lg border border-border/50`
- Colored dot + label + `~{formatFileSize(bytes)}` + percentage
- `role="list"` / `role="listitem"`
- Only render categories with size > 0

**States:** Loading (skeleton + aria-busy), API unavailable (info message), empty (no data message), normal (full dashboard)

**Chart config:**
```typescript
const chartConfig: ChartConfig = {
  courses:     { label: 'Courses',        color: 'var(--chart-1)' },
  notes:       { label: 'Notes',          color: 'var(--chart-2)' },
  flashcards:  { label: 'Flashcards',     color: 'var(--chart-3)' },
  embeddings:  { label: 'AI Search Data', color: 'var(--chart-4)' },
  thumbnails:  { label: 'Thumbnails',     color: 'var(--chart-5)' },
  transcripts: { label: 'Transcripts',    color: 'var(--color-muted)' },
}
```

### Task 3: Integrate into Settings.tsx

- Import `StorageManagement` from `@/app/components/settings/StorageManagement`
- Insert `<StorageManagement />` after line 1310 (`</Card>` of Data Management), before line 1311 (`</div>`)
- That's it — 2 lines changed

### Task 4: Unit tests `src/lib/__tests__/storageEstimate.test.ts`

Mock strategy:
- `vi.mock('@/db/schema')` — mock db with fake table objects (.count(), .limit().toArray())
- `vi.mock('@/lib/storageQuotaMonitor')` — mock getStorageEstimate() return values

Test cases (~10-12):
- `estimateTableSize`: empty table → 0, normal table → count * avgSize, table throws → 0, fewer than 5 rows
- `getStorageOverview`: full data, API unavailable (apiAvailable: false), partial failures (Promise.allSettled), all empty tables, uncategorizedBytes computation (clamped to 0)
- Category mapping: verify courses category includes all 3 tables

### Task Sequence

| # | Task | File | Depends On | Commit after |
|---|------|------|------------|--------------|
| 1 | Service module | `src/lib/storageEstimate.ts` | — | Yes |
| 2 | Unit tests | `src/lib/__tests__/storageEstimate.test.ts` | Task 1 | Yes |
| 3 | Component | `src/app/components/settings/StorageManagement.tsx` | Task 1 | Yes |
| 4 | Settings integration | `src/app/pages/Settings.tsx` | Task 3 | Yes |

## Critical Files

| File | Action |
|------|--------|
| `src/lib/storageEstimate.ts` | CREATE — service module |
| `src/app/components/settings/StorageManagement.tsx` | CREATE — card component |
| `src/app/pages/Settings.tsx` | MODIFY — add import + JSX (2 lines) |
| `src/lib/__tests__/storageEstimate.test.ts` | CREATE — unit tests |
| `src/lib/format.ts` | REUSE — formatFileSize() |
| `src/lib/storageQuotaMonitor.ts` | REUSE — getStorageEstimate() |
| `src/app/components/settings/MyDataSummary.tsx` | PATTERN — card structure reference |
| `src/app/components/ui/chart.tsx` | REUSE — ChartContainer, ChartTooltip |
| `src/db/schema.ts` | REFERENCE — table definitions |

## Verification

1. `npm run build` — no type errors
2. `npx vitest run src/lib/__tests__/storageEstimate.test.ts` — all tests pass
3. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
4. Manual: open Settings page → see Storage & Usage card with chart, legend
5. Manual: check responsive at 375px (2-col legend) and 1024px (3-col legend)
6. Manual: check skeleton loading appears briefly on mount
