## Security Review: Resource Ordering, Sidebar UX, and Scoped Materials Tab

**Date:** 2026-04-04
**Phases executed:** 5/8
**Diff scope:** 8 files changed, 596 insertions, 143 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 4 vectors identified |
| 2 | Secrets Scan | Always | Clean (diff-scoped) |
| 3 | OWASP Top 10 | Always | 6 categories checked |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | 3 new components assessed |
| 7 | Configuration | config files changed | N/A — no config files changed |
| 8 | Config Security | Always-on | 1 pre-existing finding (informational) |

### Attack Surface Changes

1. **Filename parsing via regex** (`src/lib/lessonMaterialMatcher.ts`) — New module parses user-provided filenames with regex patterns and LCS string comparison. Input comes from local filesystem filenames imported via File System Access API.
2. **Expanded data flow** (`src/lib/courseAdapter.ts`) — New `getGroupedLessons()` method and caching layer (`cachedGroups`). Data flows from IndexedDB through the matcher into React components.
3. **Tab switching via props** (`BelowVideoTabs.tsx`, `useLessonPlayerState.ts`) — New `focusTabKey` counter and `handleFocusMaterials` callback enable cross-component tab control. Input is internal (not user-controlled).
4. **Expanded rendering surface** (`MaterialsTab.tsx`, `LessonsTab.tsx`) — New UI sections render filename-derived text, material counts, and standalone PDF sections.

### Findings

#### Blockers
None.

#### High Priority
None.

#### Medium

- **`src/lib/lessonMaterialMatcher.ts:89-111` — LCS algorithm is O(m*n) per pair** (confidence: 70)
  **Scenario:** The `lcsLength()` function runs O(m*n) string comparison for each unmatched PDF against each video across Tiers 2-5. For a course with V videos and P PDFs with average stem length L, worst case is O(V * P * L^2). With typical courses (< 100 lessons, stems < 100 chars), this is negligible. However, a pathologically constructed course import with hundreds of long-named PDFs could cause UI jank during `getGroupedLessons()`.
  **Mitigating factors:** (1) Results are cached in `LocalCourseAdapter.cachedGroups`, so the computation runs once per adapter instance. (2) Input is local filesystem filenames, not arbitrary user text input. (3) Filenames are naturally short (OS path limits).
  **Fix:** No immediate action needed. If courses with 500+ lessons are supported in the future, consider adding an early-exit or limiting stem comparison length to ~200 chars.

#### Informational

- **`src/lib/lessonMaterialMatcher.ts:57` — Regex `^(\d+(?:[-_.]\d+)*)` is safe from ReDoS** (confidence: 95)
  The prefix extraction regex is anchored at `^` and uses a non-overlapping alternation pattern. The quantifier `(?:[-_.]\d+)*` cannot cause catastrophic backtracking because `[-_.]` and `\d+` are disjoint character classes. The extension regex `/\.[a-zA-Z0-9]{2,4}$/` is also safe (bounded quantifier, anchored). No ReDoS risk.

- **`src/app/components/course/tabs/LessonsTab.tsx:44` — Regex injection in search is properly mitigated** (confidence: 95)
  `HighlightedLessonTitle` escapes all regex special characters via `query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before constructing `new RegExp()`. This prevents user search input from injecting regex patterns.

- **`src/app/components/course/tabs/MaterialsTab.tsx:83` — Blob URL lifecycle is properly managed** (confidence: 90)
  `URL.createObjectURL(file)` is called in an effect with proper cleanup: (1) if the effect is cancelled before completion, the URL is immediately revoked (line 88); (2) a separate cleanup effect revokes on unmount (lines 106-110). No blob URL leaks detected.

- **`.mcp.json:15` — Pre-existing: Google API key in plaintext** (confidence: 95)
  `.mcp.json` is tracked by git and contains a plaintext `X-Goog-Api-Key`. This is NOT introduced by this diff and is a pre-existing issue. Recommend: move to environment variable, add `.mcp.json` to `.gitignore`, and rotate the key.

### Secrets Scan

Clean — no secrets detected in the diff. The `.mcp.json` finding above is a pre-existing issue not related to this feature.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control changes; materials are user's own imported files |
| CS2: Client-Side Injection (XSS) | Yes | No | All filename rendering uses React JSX auto-escaping. No `dangerouslySetInnerHTML`, no `innerHTML`, no `href={variable}`. Search regex properly escaped. |
| CS3: Sensitive Data in Client Storage | No | No | No new secrets or tokens stored. Material groups cached in adapter instance memory only. |
| CS5: Client-Side Integrity | Yes | No | IndexedDB reads (`db.importedPdfs.where`) use parameterized Dexie queries. Cached groups are derived from existing trusted data. |
| CS7: Client-Side Security Logging | Yes | No | No `console.log` statements in any changed file. No sensitive data in error messages. |
| CS9: Client-Side Communication | No | No | No postMessage, no cross-origin communication added. |

### What's Done Well

1. **Proper React patterns for filename rendering.** All user-controlled filenames (from local filesystem imports) flow through React's JSX auto-escaping. The `HighlightedLessonTitle` component correctly escapes regex special characters before constructing `new RegExp()`, preventing regex injection from search input.

2. **Disciplined blob URL lifecycle management.** The `PdfSection` component handles blob URLs with both cancellation guards (via `ignore` flag in the effect) and cleanup-on-unmount via a separate `useEffect`. The `revokeObjectUrl` helper centralizes cleanup.

3. **Safe regex design.** The filename parsing regex in `lessonMaterialMatcher.ts` uses anchored patterns with disjoint character classes, avoiding catastrophic backtracking. The bounded extension regex (`{2,4}`) further limits execution time.

---
Phases: 5/8 | Findings: 1 medium, 4 informational | Blockers: 0 | False positives filtered: 2

*False positives filtered:*
1. localStorage/IndexedDB data visibility — expected for client-side BYOK architecture
2. Blob URL creation from local files — properly managed lifecycle, not a leak
