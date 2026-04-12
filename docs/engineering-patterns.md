# Engineering Patterns

Shared patterns extracted from retrospectives (Epics 5-9B). Read this before starting any story.

## IDB Cleanup in E2E Tests

Always `await` IndexedDB cleanup in `afterEach`. Fire-and-forget causes flaky inter-test pollution.

```typescript
// Use the indexeddb-fixture helper
test.afterEach(async ({ page, indexedDB }) => {
  await indexedDB.clearStore('challenges')
})

// Or wrap raw IDB in a Promise
await page.evaluate(
  () =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction('storeName', 'readwrite')
        const clearReq = tx.objectStore('storeName').clear()
        clearReq.onsuccess = () => {
          idb.close()
          resolve()
        }
        clearReq.onerror = () => reject(clearReq.error)
      }
      req.onerror = () => reject(req.error)
    })
)
```

## DST-Safe Date Handling

Use `toLocaleDateString('sv-SE')` for timezone-safe YYYY-MM-DD strings. Never use `toISOString().split('T')[0]` — it returns UTC, not local time, so near-midnight users in western timezones get wrong dates.

```typescript
// CORRECT — local timezone
const dateStr = new Date().toLocaleDateString('sv-SE') // "2026-03-08"

// WRONG — UTC date, off by one near midnight in US timezones
const dateStr = new Date().toISOString().split('T')[0]
```

For parsing YYYY-MM-DD strings back to Date objects, use `parseLocalDate()` to avoid UTC midnight shift:

```typescript
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
```

**Dedup storage queries**: `toLocaleDateString('sv-SE')` is also the project standard for same-day dedup keys in IndexedDB queries. Both `hasKnowledgeDecayToday()` and `hasRecommendationMatchToday()` in `src/services/NotificationService.ts` use this format. When adding new dedup functions, match this pattern rather than using epoch timestamps or ISO strings.

## Type Guard Edge Cases

When form state allows empty or undefined values, always guard dynamic lookups before using them in validation messages or UI labels.

```typescript
// WRONG — produces "undefined videos" when type is empty
const label = `${UNIT_LABELS[type]} required`

// CORRECT — guard before lookup
const label = type ? `${UNIT_LABELS[type]} required` : 'Select a type'
```

## Optimistic UI with Rollback

When using optimistic UI updates, snapshot the full state array before mutation. Rollback on failure must restore the original order.

```typescript
const snapshot = [...get().items] // full snapshot before mutation

set({ items: items.filter(i => i.id !== id) }) // optimistic

try {
  await db.items.delete(id)
} catch {
  set({ items: snapshot }) // rollback preserves original order
}
```

For non-optimistic operations (like `refreshAllProgress`), update state only after DB persistence succeeds. Keep a snapshot for rollback on DB failure.

## useEffect Cleanup

Always return a cleanup function for effects with async operations. Use an `ignore` flag to prevent stale state updates.

```typescript
useEffect(() => {
  let ignore = false
  fetchData().then(data => {
    if (!ignore) setState(data)
  })
  return () => {
    ignore = true
  }
}, [])
```

For effects with timers or event listeners, clean those up too:

```typescript
useEffect(() => {
  const handler = () => {
    /* ... */
  }
  window.addEventListener('event-name', handler)
  return () => window.removeEventListener('event-name', handler)
}, [deps])
```

## Timeout Pattern for Unreliable Callbacks

When using third-party library callbacks that may not fire reliably (e.g., `tocChanged` from epub.js, MediaRecorder `ondataavailable`, File System Access API events), pair the callback with a timeout effect to set a fallback state. This prevents indefinite loading states.

**Why needed:** Some third-party library callbacks may not fire due to:

- Missing or corrupt data in the source (e.g., EPUB with no navigation)
- Library bugs or edge cases
- Race conditions in library initialization

**Pattern:**

```typescript
useEffect(() => {
  // Callback sets success state
  const handleCallback = () => {
    setIsLoading(false)
    setData(loadedData)
  }

  thirdPartyLibrary.onCallback(handleCallback)

  // Timeout sets fallback state if callback never fires
  const timeoutId = setTimeout(() => {
    if (isLoading) {
      setIsLoading(false) // Fallback to empty/error state
    }
  }, TIMEOUT_MS)

  return () => {
    clearTimeout(timeoutId)
    thirdPartyLibrary.offCallback(handleCallback)
  }
}, [isLoading])
```

**Key points:**

- Check current state before setting fallback (avoid overwriting successful loads)
- Clean up both timeout and callback listener in effect cleanup
- Choose timeout duration based on expected operation time (5s for TOC, 30s for network, etc.)

**Case study:** E107-S03 — `tocChanged` callback from `react-reader` may not fire for EPUBs with no navigation or corrupt TOC data. A 5-second timeout prevents infinite loading spinner while allowing legitimate slow EPUBs to load.

## Error Handling

Never swallow errors in catch blocks. At minimum, log to console AND surface to the user.

```typescript
// WRONG — error silently disappears
catch { }
catch (e) { console.log(e) }

// CORRECT — log + notify user
catch (error) {
  console.error('[ComponentName] operation failed:', error)
  toast.error('Operation failed. Please try again.')
}
```

## Start Simple, Escalate If Needed (Decision Framework)

When choosing between implementation approaches of varying complexity, **default to the simplest viable solution**. Only escalate to a more complex approach if the simple one fails to meet explicit, measured performance or capability targets.

**Decision Process:**

1. **Identify the simplest approach** that could work (brute force, linear scan, naive algorithm)
2. **Define measurable failure criteria** before building (e.g., ">100ms latency", ">100MB memory")
3. **Build and benchmark** the simple approach first
4. **Escalate only if** the simple approach fails the defined criteria
5. **When research scores differ by <15%**, choose the lower-risk/simpler option

**Case Study — Epic 9 Vector Search:**

- Custom HNSW (complex): 700+ lines, 6.2% recall, 3 hours invested, 0 progress
- Brute force k-NN (simple): 200 lines, 100% recall, 10.27ms @ 10K vectors (10x under budget)
- Lesson: Brute force should have been the starting point. HNSW was premature optimization.

**Migration Triggers (document upfront):**
When building the simple approach, document the specific conditions that would trigger migration to a more complex solution. Example: "If >50K vectors OR >200ms latency → evaluate EdgeVec library."

**Anti-patterns:**

- Building complex solutions before proving the simple one is insufficient
- Choosing higher-scored research options when the score gap is small but complexity gap is large
- Continuing to fix a failing complex approach instead of pivoting to a simpler one (sunk cost)

## Epic Split Criteria

When planning an epic that covers both infrastructure/foundation work AND feature work built on that foundation, consider splitting into two epics.

**Split when:**

- The epic has 3+ "foundation" stories (data layer, config, API setup, worker architecture) AND 3+ "feature" stories that depend on them
- Infrastructure stories need to stabilize before feature stories can begin productively
- Different skill sets or review criteria apply to infrastructure vs. features
- The combined epic would exceed 8 stories

**Don't split when:**

- Infrastructure is just 1-2 small stories (setup/config)
- Features can be developed incrementally alongside infrastructure
- The total scope is ≤6 stories

**Naming convention:** Use letter suffix for the feature epic (e.g., Epic 9 = infrastructure, Epic 9B = features).

**Case Study — Epic 9/9B:**

- Epic 9 (3 stories): AI provider config, web workers, embedding pipeline — all foundation
- Epic 9B (6 stories): Video summary, Q&A, learning paths, gap detection, note org, analytics — all features
- Result: Clean dependency boundary, infrastructure stabilized before features started

## Fire-and-Forget Error Boundaries

Auto-analysis features, background analytics, and telemetry must **never** throw unhandled errors. These features enhance the experience but must not break user workflows.

```typescript
// CORRECT — fire-and-forget with error boundary
const runAutoAnalysis = async (courseId: string) => {
  try {
    await analyzeCourseMaterial(courseId)
  } catch (error) {
    console.error('[AutoAnalysis] Failed:', error)
    toast.error('Auto-analysis unavailable. Your data is safe.')
    // Never re-throw — caller continues normally
  }
}
```

**Rules:**

- Wrap all background/analytics operations in try/catch
- Log the error for debugging (console.error with component prefix)
- Show a non-blocking toast notification (never a modal or alert)
- Never re-throw — the calling workflow must complete regardless
- Never let analytics errors propagate to React error boundaries

## CSP Configuration for External APIs

Content Security Policy violations fail **silently** in the browser but **clearly** in E2E tests. This causes features to appear working in dev but fail in tests.

**Rule:** Configure CSP allowlists in infrastructure stories **before** any feature story that calls external APIs.

**Checklist for external API stories:**

1. Add API domain to `connect-src` in CSP meta tag or header
2. Verify in both browser console (check for CSP violation warnings) and E2E tests
3. Document the CSP change in the story's implementation notes

## Branch From Main Always

Never branch a feature branch from another feature branch. Always branch from `main`.

Stacked branches (feature-on-feature) cause painful rebase conflicts when the base branch is rebased and merged. Without dedicated stacked PR tooling (e.g., Graphite, ghstack), the conflict resolution cost exceeds any parallelism benefit.

**Rule:** `git checkout main && git pull && git checkout -b feature/e##-s##-slug`

**Case Study — Epic 13 (E13-S02):**
E13-S02 was branched from E13-S01's feature branch. When E13-S01 was rebased and merged to main, E13-S02 inherited all old E13-S01 commits plus extensive conflicts during rebase. Sequential stories branching from main would have avoided the issue entirely.

## Catch Blocks Must Surface Errors

Every `catch` block in an event handler or user-triggered function must include visible user feedback (e.g., `toast.error()`). Console logging alone is a **silent failure** — the user has no idea something went wrong.

This pattern has recurred across 3+ epics (E03-S03, E12-S06, E13-S04) and is now enforced by the `error-handling/no-silent-catch` ESLint rule.

```typescript
// WRONG — silent failure (user sees nothing)
catch (error) {
  console.error('Failed:', error)
}

// WRONG — completely empty catch
catch { }

// CORRECT — log + notify user
catch (error) {
  console.error('[ComponentName] operation failed:', error)
  toast.error('Something went wrong. Please try again.')
}
```

**Exceptions** (where silent catch is acceptable):

- `beforeunload` handlers (no UI available)
- Background telemetry/analytics (fire-and-forget pattern — see "Fire-and-Forget Error Boundaries" above)
- Cleanup/dispose functions where failure is inconsequential

## Inventory Existing Code Before Story Planning

Before writing task breakdowns for a new story, audit the codebase for pre-existing code that's relevant. In Epic 13, 3 of 6 stories (50%) discovered that significant functionality already existed, making task lists overestimate effort.

**Audit checklist:**

1. Search stores (`src/stores/`) for actions/selectors related to the story's domain
2. Search types (`src/types/`) for interfaces the story needs
3. Search components (`src/app/components/`) for UI primitives that can be reused
4. Check if the story's primary data flow is already wired

**Case Study — Epic 13:**

- E13-S03 (Pause/Resume): ~80% already built in E12-S03 (Zustand persist) and E13-S01 (resume button)
- E13-S05 (Shuffle): Fisher-Yates was already inline in `useQuizStore.ts` — story became an extraction refactor
- E13-S01 (Navigation): `goToNextQuestion`/`goToPrevQuestion` already existed in the store

## Retro Commitment Enforcement Principle

Only commit to retro action items that can be enforced automatically (ESLint rules, git hooks, review gates). Items requiring voluntary initiative without enforcement should be labeled "aspirational" and deprioritized.

**Evidence (Epics 11-13):**

- Automated items (ESLint design-token rule, review gates): ~100% compliance
- Documentation-only items (conventions, pattern docs): <20% follow-through
- Items with enforcement attached (contrast fix blocking a story): 100% completion

**Rule:** If it can't be enforced, it won't get done consistently. Attach automation or accept it's aspirational.

## Scoring Dual-Path: `isCorrect` vs `pointsEarned`

For multiple-select questions, `isCorrect` and `pointsEarned` follow **different logic paths** in `src/lib/scoring.ts`:

- **`isCorrect`** (boolean): Exact set-match — `true` only when the user selects every correct option and no incorrect ones. Used for "correct/incorrect" status display.
- **`pointsEarned`** (number): Partial Credit Model (PCM) — awards fractional points based on `max(0, (correct_selections - incorrect_selections) / total_correct) * points`. Used for score calculation.

This means a partially correct answer returns `isCorrect: false` but `pointsEarned > 0`. For example, selecting 2 of 3 correct options (no wrong picks) yields `isCorrect: false, pointsEarned: 6.67` on a 10-point question.

**Why two paths:** Quiz results need both a binary status badge ("Correct" / "Incorrect") and a nuanced score. PCM rewards partial knowledge without labeling incomplete answers as fully correct.

**Testing guidance:** Write scoring test expectations directly from the AC formulas, not from intuition about how "correct" should work. The most common mistake (E14-S02) is assuming all-or-nothing points for multiple-select because `isCorrect` is all-or-nothing. Always check both fields independently.

**Reference:** `calculatePointsForQuestion()` in [src/lib/scoring.ts](../src/lib/scoring.ts)

## Quiz/Question Component Accessibility Checklist

Recurring ARIA mistakes from Epic 14 retrospective. Check every item when building question or quiz UI.

**Structure:**

- [ ] `<fieldset>` + `<legend>` wraps each question group
- [ ] `<legend>` uses `aria-labelledby` pointing to question text element
- [ ] No redundant `role="group"` on `<fieldset>` (it's implicit)

**ARIA associations:**

- [ ] `aria-describedby` links inputs to hint/instruction text
- [ ] `aria-live="polite"` on dynamically updating content (counters, timers, validation status)
- [ ] `aria-invalid` + `aria-errormessage` on inputs with validation errors

**Interaction:**

- [ ] RadioGroup: Arrow keys navigate options (Radix default — don't override)
- [ ] Checkboxes: Tab key moves between options (not arrow keys)
- [ ] Focus indicators: `ring-2 ring-ring ring-offset-2` on all interactive elements

**Touch & sizing:**

- [ ] Touch targets ≥44px (`min-h-12` on clickable elements)
- [ ] Label text clickable (wraps or `htmlFor` on associated input)

## Review Gate Skip Policy

When and how to skip review gates during `/review-story`:

**Acceptable skip conditions:**

- Documentation-only changes (no .tsx/.ts/.css)
- Test-only changes (no production source)
- Emergency hotfixes (document reason in PR)

**Skip procedure:**

1. Document the skipped gate(s) in the story's lessons learned
2. Add `skip-review: [gate-name]` label on the PR
3. Note the reason in the epic tracking file

**Never skip:** Build, lint, type-check (these are fast and catch real bugs)

## Playwright addInitScript

`addInitScript` runs on every page load, including `page.reload()`. If you use `localStorage.clear()` inside it, reloads will wipe seeded test data.

Fix: use a sessionStorage flag to run setup only once per test:

```typescript
await page.addInitScript(() => {
  if (sessionStorage.getItem('test-setup-done')) return
  sessionStorage.setItem('test-setup-done', '1')
  localStorage.clear()
})
```

## Dexie Version Sequencing in Story Specs

Each Dexie schema migration consumes a version number (v30, v31, v32...). When stories add new fields that require migrations, always note the **next available version** in the story's guardrails section so subsequent stories pick it up without digging through `schema.ts` history.

```markdown
### Critical Guardrails (in story spec)

- Dexie migration: use v33 (v32 consumed by E60-S01 for knowledgeDecay)
- Next available version after this story: v34
```

This prevents version collisions when multiple stories in the same epic touch the Dexie schema. Each story author sees the version they should use without reading the full migration chain.

**Case study**: E60-S02 — S01 consumed v32 for `knowledgeDecay`, and S02's spec explicitly noted "use v33 for `recommendationMatch`", avoiding a version conflict.

## Persist Before Navigate

When switching contexts (format switching, navigation after save), always call persistence callbacks **before** `navigate()`. React Router navigation is synchronous — once `navigate()` fires, the current component unmounts and any pending async saves may be lost.

```typescript
// WRONG — position may be lost if component unmounts before save completes
navigate(`/library/${linkedBook.id}/read`)
savePosition()

// CORRECT — save first, then navigate
savePosition()
navigate(`/library/${linkedBook.id}/read`)
```

**Case study**: E103-S02 — R1 review caught position-save called after `navigate()` in the format switch handler. The component unmounts on navigation, abandoning any pending Dexie writes.

## Ref Guard for One-Shot Actions

Use `useRef` (not `useState`) for navigation guards and other one-shot action locks. A ref update does not trigger a re-render cycle, and when the guarded action causes component unmount (navigation, modal close), the ref is automatically garbage-collected — no cleanup needed.

```typescript
const switchingRef = useRef(false)

function handleSwitch() {
  if (switchingRef.current) return // guard: already switching
  switchingRef.current = true
  // switchingRef is NOT reset — component unmounts on navigation
  // No setTimeout cleanup needed
  navigate(targetUrl)
}
```

**Why not useState**: Setting state triggers a re-render; refs don't. For guards on one-time actions that cause unmount, the ref approach is simpler and avoids a superfluous render cycle.

**Case study**: E103-S02 — initial implementation used `setTimeout` to reset the ref after a delay. R1 review correctly identified this as unnecessary — the guard clears automatically when the component unmounts.

## WebSocket CSP Allowlist

The Content Security Policy includes `ws: wss:` wildcards for WebSocket connections. This is **intentional** for Audiobookshelf integration — ABS servers run on user-configured LAN addresses (varying hosts and ports), making a fixed CSP allowlist impractical.

**Security context:** This is acceptable because:

1. Knowlune is a local-first PWA — no server-side rendering or shared hosting
2. WebSocket connections are only initiated by user-configured ABS server URLs
3. All ABS connections require API key authentication

**Reference:** E102-S04 (Socket.IO via native WebSocket)

## Resource URL Resolution Hooks

When working with stored resources that use custom protocols (e.g., OPFS with `opfs://` identifiers), use a React hook to resolve URLs to displayable blob URLs with automatic lifecycle management.

**Why this pattern:**

1. **Custom protocols can't be used directly**: `opfs://` and `opfs-cover://` identifiers are meaningful to the storage service but not to the browser. An `<img src="opfs://book123">` won't load — the browser doesn't understand the protocol.

2. **Blob URLs require cleanup**: Converting stored files to blob URLs via `URL.createObjectURL()` creates a reference that must be revoked with `URL.revokeObjectURL()` to prevent memory leaks.

3. **Reusability**: Any future resource that needs blob URL resolution (audio files, document previews, etc.) can follow this pattern.

**Template for resource URL hooks:**

```typescript
// src/app/hooks/useBookCoverUrl.ts (reference implementation)
import { useEffect, useState, useRef } from 'react'

interface UseResourceUrlOptions {
  resourceId: string
  url: string | undefined
}

export function useResourceUrl({ resourceId, url }: UseResourceUrlOptions): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const previousUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let blobUrl: string | null = null

    const resolveUrl = async () => {
      // No URL provided
      if (!url) {
        if (!isCancelled) setResolvedUrl(null)
        return
      }

      // External URL - use directly
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (!isCancelled) setResolvedUrl(url)
        return
      }

      // Custom storage protocol - resolve via service
      try {
        blobUrl = await storageService.getUrl(resourceId)
        if (!isCancelled) {
          setResolvedUrl(blobUrl)
          previousUrlRef.current = blobUrl
        }
      } catch {
        if (!isCancelled) setResolvedUrl(null)
      }
    }

    resolveUrl()

    // Cleanup: revoke blob URL when URL changes or component unmounts
    return () => {
      isCancelled = true
      if (previousUrlRef.current && previousUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrlRef.current)
        previousUrlRef.current = null
      }
    }
  }, [resourceId, url])

  return resolvedUrl
}
```

**Usage example:**

```typescript
// In your component
const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

if (resolvedCoverUrl) {
  return <img src={resolvedCoverUrl} alt="Cover" />
}
return <div className="placeholder">No cover</div>
```

**Key implementation details:**

- Use `useRef` to track the previous blob URL for cleanup
- Always revoke the previous URL when creating a new one (prevents leaks)
- Use an `isCancelled` flag to prevent state updates after unmount
- Handle both external URLs (passthrough) and custom storage protocols
- Return `null` for missing URLs to allow graceful fallbacks

**Custom storage protocols supported:**

- `opfs://path` — Origin Private File System file
- `opfs-cover://bookId` — OPFS-stored cover image
- Future: `opfs-audio://`, `opfs-doc://`, etc.

**Reference:** E107-S01 (useBookCoverUrl hook)

## Custom Protocol Validation at Browser API Boundaries

Custom protocols like `opfs://` and `opfs-cover://` are meaningful inside the app but break silently when passed to native browser APIs (Media Session API, `fetch()`, History API, etc.).

Before passing any URL to a native browser API, validate its scheme:

```typescript
// Only pass safe schemes to navigator.mediaSession
if (/^(blob:|https?:|data:image\/)/.test(artworkUrl)) {
  navigator.mediaSession.metadata = new MediaMetadata({ artwork: [...] })
}
```

**Why it fails silently:** Browser APIs accept invalid URLs without throwing — they just don't load the resource. There's no error to catch.

**Where this applies:** Media Session API artwork, `fetch()`, `<audio src>`, `<video src>`, History API URLs. Any API that takes a URL string.

**Case study:** E107-S01 — `book.coverUrl` (containing `opfs://`) was passed directly to `navigator.mediaSession.metadata.artwork`, causing the cover to never appear in OS media controls.

## Async Effect Two-Phase Resource Cleanup

Async effects that create disposable resources (blob URLs, file handles, streams) need two independent cleanup targets, not one:

1. **Effect-local resource** (`effectBlobUrl`): the URL/handle resolved by the current effect run. Revoke if the effect is cancelled before the component renders the new value.
2. **Previous displayed resource** (`previousUrlRef`): the URL/handle currently shown. Revoke when the component renders a replacement (or unmounts).

Single-phase cleanup (only on unmount) misses the rapid-re-render race: a new effect starts, the old one is cancelled, but the new effect's resource is never revoked if _that_ effect is also cancelled.

```typescript
const previousUrlRef = useRef<string | null>(null)

useEffect(() => {
  let isCancelled = false
  let effectBlobUrl: string | null = null

  async function resolve() {
    const url = await getResourceUrl(resourceId)
    if (isCancelled) {
      // Cancel path: revoke the resource this effect created
      if (url) URL.revokeObjectURL(url)
      return
    }
    effectBlobUrl = url
    setResolvedUrl(url)
    // Revoke the previously displayed resource
    if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current)
    previousUrlRef.current = url
  }

  resolve()

  return () => {
    isCancelled = true
    // Unmount path: revoke the resource this effect created
    if (effectBlobUrl) URL.revokeObjectURL(effectBlobUrl)
  }
}, [resourceId])
```

**Case study:** E107-S01 — `useBookCoverUrl` initial implementation used single-phase cleanup, leaking blob URLs on rapid cover prop changes. Fixed in `231c8d5f`.

## Tailwind v4 JIT: Arbitrary Values Must Be Literal Strings

Tailwind's JIT scanner extracts class names from source files at build time using static analysis. Dynamically constructed class strings (template literals, string concatenation) are invisible to the scanner, producing missing styles at runtime with no build error.

```typescript
// ❌ BROKEN — Tailwind never sees this class
const bg = `bg-[${hexColor}]`

// ✅ WORKS — literal string is scannable
const BG_CLASSES: Record<string, string> = {
  '#faf5ee': 'bg-[#faf5ee]',
  '#f9f9fe': 'bg-[#f9f9fe]',
  '#1a1b26': 'bg-[#1a1b26]',
}
const bg = BG_CLASSES[hexColor] ?? 'bg-background'
```

When you need arbitrary Tailwind values driven by runtime data, use a lookup map where every class string appears as a complete literal. This applies to `bg-[...]`, `text-[...]`, `border-[...]`, and any arbitrary value syntax.

**Case study:** E107-S05 — Reader theme config uses `BG_CLASSES` and `TEXT_CLASSES` maps to bridge hex color values from `readerThemeConfig.ts` into scannable Tailwind classes.

## AbortController: Set Terminal State at Decision Point

When using `AbortController` to cancel a loop, set the terminal phase state at each abort checkpoint — not in a shared post-loop block. A post-loop block runs after `break` and can overwrite the cancelled state with `done` if the abort check fires too late.

```typescript
// ❌ RACE — post-loop block can overwrite 'cancelled' with 'done'
for (const file of files) {
  if (signal.aborted) break
  await processFile(file)
}
setPhase('done') // runs even after abort break

// ✅ CORRECT — terminal state set at the decision point
for (const file of files) {
  if (signal.aborted) {
    setPhase('cancelled') // state locked before break
    break
  }
  await processFile(file)
}
if (!signal.aborted) setPhase('done')
```

This pattern also applies to `try/catch` blocks where multiple catch paths could set conflicting states — always set the terminal state where the decision is made, not in a finally/post-block.

**Case study:** E108-S01 — `useBulkImport` abort handling. Fixed in `f4fd82ee` after code review flagged the race.

## Numerator/Denominator Scope Matching for Aggregate Metrics

When computing a ratio or average from database records, verify that both the numerator and denominator reference the same scope (same book set, same session set, same time window). Scope mismatches produce silently wrong metrics.

**Checklist before coding any ratio:**

1. Write out: "Numerator = [sum of X] over [scope A]"
2. Write out: "Denominator = [count of Y] over [scope B]"
3. If scope A ≠ scope B, the ratio is suspect — align them.

**Example (correct):**

```text
avgPagesPerSession (finished books only):
  Numerator   = totalPages from finished books
  Denominator = session count WHERE bookId IN (finished book IDs)
```

**Anti-pattern (wrong):**

```text
avgPagesPerSession:
  Numerator   = totalPages from finished books only
  Denominator = count of ALL sessions (including in-progress books)
  → Denominator scope is wider → average is artificially low
```

**Case study:** E112-S02 — `avgPagesPerSession` initially summed pages from finished books but counted all sessions. Fix: scope both to `finishedBookIds`.

## Keyboard Shortcut Hooks: useRef for Zero-Render-Cost Registration

When building keyboard shortcut hooks, store the shortcut map in a `useRef` (not state) and register a single `keydown` listener on `document`. This avoids re-registering the listener on every render when shortcuts change.

```typescript
const shortcutsRef = useRef(shortcuts);
useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.isComposing) return; // IME guard — prevents firing during CJK input
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    shortcutsRef.current.forEach(({ key, action }) => {
      if (e.key === key) { e.preventDefault(); action(); }
    });
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []); // Empty deps — handler reads from ref, never stale
```

Key guards to always include:
- `e.isComposing` — prevents firing during IME composition (Japanese, Chinese, Korean)
- `activeElement instanceof HTMLInput/Textarea` — prevents interference with typing
- `contenteditable` check — `active?.closest('[contenteditable]')`

**Case study:** E108-S03 — `useKeyboardShortcuts` hook in `src/app/hooks/useKeyboardShortcuts.ts`.
