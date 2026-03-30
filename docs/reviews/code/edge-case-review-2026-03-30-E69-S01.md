## Edge Case Review — E69-S01 (2026-03-30)

**Scope:** `src/lib/storageEstimate.ts`, `src/app/components/settings/StorageManagement.tsx`, `src/lib/__tests__/storageEstimate.test.ts`

### Unhandled Edge Cases

---

**[storageEstimate.ts:80–84] `estimateTableSize` Blob detection** — `Row contains multiple Blob fields`
> Consequence: The reduce callback returns `sum + val.size` on the *first* Blob field found in a row, skipping all remaining fields (both Blob and non-Blob). A row with two Blob fields (e.g., `{ thumbnail: Blob(500), preview: Blob(300) }`) only counts 500 bytes instead of 800. The early `return` inside the `for...of` loop short-circuits after the first Blob value.
> Guard: `Accumulate all Blob sizes and non-Blob JSON size per row instead of returning on first Blob hit. For example: let blobTotal = 0; let hasBlob = false; for (const val of Object.values(row)) { if (val instanceof Blob) { blobTotal += val.size; hasBlob = true; } } return sum + (hasBlob ? blobTotal : new Blob([JSON.stringify(row)]).size)`

---

**[storageEstimate.ts:80–84] `estimateTableSize` Blob detection** — `Row contains a Blob nested inside an object or array`
> Consequence: The `Object.values(row)` iteration only inspects top-level fields. A Blob stored at `row.data.content` or in an array like `row.attachments[0]` will not be detected as a Blob, so `JSON.stringify` is used instead. For Blobs, `JSON.stringify` produces `"{}"` (2 bytes), drastically underestimating actual storage.
> Guard: `Either document that only top-level Blob fields are supported, or add recursive Blob detection for nested structures.`

---

**[storageEstimate.ts:80–84] `estimateTableSize` Blob detection** — `Row contains ArrayBuffer, Uint8Array, or File objects`
> Consequence: IndexedDB can store `ArrayBuffer`, typed arrays, and `File` objects. These are not instances of `Blob`, so the `instanceof Blob` check misses them. `JSON.stringify(arrayBuffer)` produces `"{}"`, yielding a massive underestimate for binary data stored as typed arrays.
> Guard: `Add checks for ArrayBuffer, ArrayBufferView, and File: if (val instanceof ArrayBuffer) return sum + val.byteLength; if (ArrayBuffer.isView(val)) return sum + val.byteLength; if (val instanceof File) return sum + val.size`

---

**[storageEstimate.ts:70–88] `estimateTableSize`** — `Table has millions of rows with highly variable row sizes`
> Consequence: The default sample of 5 rows (taken via `.limit(5)`) reads the first 5 rows by insertion order. If early rows are small stubs and later rows contain large content (common in append-heavy patterns), the estimate will be severely low. Conversely, if the first rows are outliers with large content, the estimate overshoots. A 5-row sample from millions has no statistical significance.
> Guard: `Consider sampling from random offsets (e.g., table.offset(Math.random() * count).limit(sampleSize)) or increasing default sampleSize to 20–50 for better accuracy. Document the known inaccuracy for skewed distributions.`

---

**[storageEstimate.ts:74] `estimateTableSize`** — `table.count() returns a very large number (millions+)`
> Consequence: `table.limit(5).toArray()` on a Dexie table with millions of rows is generally fine (Dexie uses cursor-based limits). However, `table.count()` on a corrupted or very large IndexedDB can be slow (full index scan in some browsers). There is no timeout — a hung `count()` call will leave the dashboard in perpetual loading state.
> Guard: `Wrap the entire estimation in a Promise.race with a timeout (e.g., 5 seconds): Promise.race([estimateTableSize(name), new Promise(resolve => setTimeout(() => resolve(0), 5000))])`

---

**[storageEstimate.ts:78] `estimateTableSize`** — `sample.length is 0 but count > 0 (phantom count)`
> Consequence: Currently handled — returns 0 when `sample.length === 0`. However, this can happen if rows are deleted between `count()` and `limit().toArray()`. The user would see "Courses: 0 B" despite courses existing. This is a TOCTOU race but consequence is cosmetic only.
> Guard: `No fix needed — cosmetic only, self-corrects on next refresh.`

---

**[StorageManagement.tsx:254–265] `handleRefresh`** — `User rapidly clicks Refresh multiple times`
> Consequence: The `if (refreshing) return` guard prevents concurrent calls, but there is a subtle issue: if the user clicks Refresh, the first call starts. If they click again while it's in-flight, the second click is correctly rejected. But if the first call fails and sets `error: true`, then the user clicks Refresh again — the error state is cleared (`setError(false)`) but the old `overview` data remains visible. The stale data + error banner combination is actually handled correctly (`error && !overview` shows error state, otherwise shows stale data). No real bug here.
> Guard: `Already handled — stale data shown alongside error is acceptable UX.`

---

**[StorageManagement.tsx:232–248] `useEffect` unmount race** — `Component unmounts during getStorageOverview()`
> Consequence: The `cancelled` flag prevents `setOverview`, `setError`, and `setLoading` from being called after unmount. This is correctly implemented. However, `getStorageOverview()` itself continues running (fetching from IndexedDB and the Storage API) even after unmount — wasting resources.
> Guard: `Use AbortController and pass signal to getStorageOverview() to cancel in-flight Dexie queries. Low priority — the wasted work is small.`

---

**[StorageManagement.tsx:254–265] `handleRefresh`** — `Component unmounts during refresh`
> Consequence: Unlike the `useEffect` path, `handleRefresh` has no `cancelled` flag or unmount guard. If the component unmounts while a refresh is in-flight, `setOverview`, `setError`, and `setRefreshing` will be called on an unmounted component. In React 18+, this does not throw (the "setState on unmounted" warning was removed), but it is a wasted state update.
> Guard: `Add a ref-based `isMounted` flag or use the same cancelled-flag pattern as the useEffect: const mountedRef = useRef(true); useEffect(() => () => { mountedRef.current = false }, []); then check mountedRef.current before each setState in handleRefresh.`

---

**[storageEstimate.ts:60] `getStorageEstimate` returns `quota: 0`** — `Browser reports quota as 0 (e.g., private browsing, storage pressure)`
> Consequence: `storageQuotaMonitor.ts:60` computes `usagePercent: quota > 0 ? usage / quota : 0`, so `usagePercent` becomes 0 even if `usage > 0`. The UI shows "0%" usage which is misleading — the user has data stored but the quota is unknown/zero. No warning banner is shown even though storage may be critically constrained.
> Guard: `Add a distinct UI state for "quota unknown" (quota === 0 but usage > 0): display "Quota unavailable" instead of "0 of 0 (0%)" and consider showing a cautionary info banner.`

---

**[storageEstimate.ts:60] `getStorageEstimate`** — `usage > quota (browser inconsistency)`
> Consequence: Some browsers can report `usage > quota` transiently (during garbage collection or when eviction is pending). The `usagePercent` would exceed 1.0 (e.g., 1.05). `Math.round(usagePercent * 100)` would show "105%". The warning banner logic uses `>= 0.95` so the critical banner would appear (correct behavior), but "105%" is confusing to users.
> Guard: `Clamp usagePercent to [0, 1]: usagePercent: Math.min(1, quota > 0 ? usage / quota : 0). Or display "100%+" for values exceeding 1.`

---

**[StorageManagement.tsx:268–271] `handleDismissWarning` sessionStorage** — `SessionStorage quota exceeded`
> Consequence: The `try/catch` around `sessionStorage.setItem` is correctly present. If `sessionStorage` is full, the catch swallows the error and the in-memory `warningDismissed` state remains `true` — so the dismiss works for the current render. On page reload, the warning reappears (since sessionStorage write failed). This is acceptable degradation.
> Guard: `Already handled — graceful degradation is correct.`

---

**[StorageManagement.tsx:81–90] `QuotaWarningBanner`** — `usagePercent is exactly 0.80`
> Consequence: The condition `usagePercent >= 0.8` means exactly 80.0% triggers the warning banner. `Math.round(usagePercent * 100)` shows "80%". This is correct — but the test at line 222 in the test file only validates the service returns 0.8, not that the component renders the warning banner at this boundary. The boundary behavior is untested at the UI level.
> Guard: `Add a component-level test that mounts StorageManagement with usagePercent = 0.8 and asserts the warning banner is rendered.`

---

**[StorageManagement.tsx:166–172] `StorageOverviewBar` chart data** — `formatFileSize receives NaN or Infinity`
> Consequence: If a category's `sizeBytes` is somehow `NaN` (e.g., from a corrupted Blob.size), `formatFileSize` calls `Math.max(0, NaN)` which returns `NaN`, then `Math.log(NaN)` produces `NaN`, and the unit index becomes `NaN`. The final output would be `"NaN undefined"` displayed in the tooltip.
> Guard: `Add a NaN guard in formatFileSize: if (!Number.isFinite(safe) || safe <= 0) return '0 B'`

---

**[storageEstimate.ts:80–84] `estimateTableSize`** — `JSON.stringify encounters circular references`
> Consequence: If an IndexedDB row contains a circular reference (unusual but possible with manually-inserted data), `JSON.stringify(row)` throws `TypeError: Converting circular structure to JSON`. This error is caught by the outer try/catch, but it causes the *entire table* estimate to return 0 rather than just skipping the problematic row.
> Guard: `Wrap the per-row JSON.stringify in a try/catch inside the reduce: try { return sum + new Blob([JSON.stringify(row)]).size } catch { return sum + 100 /* fallback estimate */ }`

---

**[storageEstimate.ts:107–116] `estimateCategory` with Promise.allSettled** — `CATEGORY_MAP references a table name that does not exist in the Dexie schema`
> Consequence: `db.table('nonexistentTable')` in Dexie throws synchronously (not async) with `"Table nonexistentTable does not exist"`. The `estimateTableSize` try/catch handles this. However, if the Dexie schema evolves and a table is renamed without updating `CATEGORY_MAP`, the category silently reports 0 bytes with no warning — the user sees a category as empty when it actually has data under a new table name.
> Guard: `Add a dev-mode assertion that validates all table names in CATEGORY_MAP exist in db.tables at startup: if (import.meta.env.DEV) { for (const cat of Object.values(CATEGORY_MAP)) { for (const t of cat.tables) { if (!db.tables.some(dt => dt.name === t)) console.warn('[StorageEstimate] Unknown table:', t) } } }`

---

**[StorageManagement.tsx:197] `CategoryBreakdownLegend` percentage** — `categorizedTotal is 0 but categories have sizeBytes > 0 (floating point edge)`
> Consequence: The guard `overview.categorizedTotal > 0 ? Math.round((...)) : 0` prevents division by zero. However, due to floating point arithmetic, if all categories independently round to 0 but `categorizedTotal` ends up as a tiny positive number (e.g., 0.0000001 from rounding), the percentage calculation could produce extremely large numbers. Extremely unlikely but theoretically possible.
> Guard: `No fix needed — probability is negligible and consequence is cosmetic.`

---

**Total:** 16 edge cases analyzed; **9 unhandled** requiring code changes, **4 already handled** (confirmed correct), **3 low-priority** (cosmetic or negligible risk).

### Summary of Actionable Findings

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | HIGH | `estimateTableSize` Blob loop | First-Blob-wins early return skips remaining fields |
| 2 | MEDIUM | `estimateTableSize` Blob detection | Nested Blobs not detected (only top-level) |
| 3 | MEDIUM | `estimateTableSize` binary types | ArrayBuffer/TypedArray/File not handled |
| 4 | LOW | `estimateTableSize` sampling | 5-row sample from insertion-ordered data may be unrepresentative |
| 5 | LOW | `estimateTableSize` timeout | No timeout on slow count()/toArray() for huge tables |
| 6 | MEDIUM | `handleRefresh` unmount | No cancelled-flag guard on refresh path |
| 7 | MEDIUM | `getStorageEstimate` quota=0 | Misleading "0 of 0 (0%)" when quota is unknown |
| 8 | LOW | `usagePercent > 1.0` | No clamping — can display "105%" |
| 9 | LOW | UI boundary test gap | Warning banner at exactly 80% untested at component level |
| 10 | LOW | `formatFileSize` NaN | No NaN/Infinity guard |
| 11 | LOW | `JSON.stringify` circular ref | One bad row zeros entire table estimate |
| 12 | MEDIUM | CATEGORY_MAP stale tables | Silent 0-byte report if table renamed in schema |
