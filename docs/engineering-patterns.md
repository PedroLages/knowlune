# Engineering Patterns

Shared patterns extracted from retrospectives (Epics 5-9B). Read this before starting any story.

## CE Orchestrator — Preferred Single-Feature Pipeline

Use `/ce-orchestrator` as the entry point for any net-new feature, fix, or refactor where a BMAD story doesn't already exist. It chains brainstorm → plan → work → review → PR with a single hard human gate at plan approval.

| Entry | Command | When |
| --- | --- | --- |
| Bare idea | `/ce-orchestrator "add keyboard shortcut help modal"` | New feature, no prior artifacts |
| Existing story | `/ce-orchestrator docs/implementation-artifacts/E##-S##*.md` | BMAD story exists; bridges to CE plan |
| Existing plan | `/ce-orchestrator docs/plans/YYYY-MM-DD-*-plan.md` | Skip brainstorm, go straight to gate |
| Bug | `/ce-orchestrator "streak resets after midnight"` | Routes through systematic-debugging first |

**Prefer this over `/lfg`** when the work needs upstream brainstorming or Knowlune's safety gates (bundle regression, ESLint design-tokens, port 5173 cleanup). Use `/lfg` only when a plan already exists and you want the narrower plan→work→review loop.

**Epic-level:** use `/epic-orchestrator E##` for running all stories in an epic through the BMAD workflow.

See: [`.claude/skills/ce-orchestrator/SKILL.md`](.claude/skills/ce-orchestrator/SKILL.md)

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

## Zustand Selector Anti-Pattern

**Never call a function inside a Zustand selector:**

```typescript
// ❌ WRONG — creates new array reference every render → infinite re-render loop
const suggestions = useStore(state => state.getSuggestions())

// ✅ CORRECT — select pre-computed state directly
const suggestions = useStore(state => state.suggestions) // pre-computed state (preferred)
```

Root cause: Zustand uses referential equality for bailout. A selector returning a new array/object each call always triggers re-render because `[] !== []`. The fix is to pre-compute in the store (e.g., in `computeScores()`) and select the computed value directly.

**Case study:** E71-S03 — `getSuggestedActions()` getter was replaced with pre-computed `suggestions` state in `computeScores()` to avoid infinite re-render.

## Tailwind Responsive Cascade

`lg:flex` correctly overrides `sm:grid` — larger breakpoints always win, this is expected Tailwind behavior and is not a bug. The cascade order is `sm` < `md` < `lg` < `xl` < `2xl`.

```typescript
// ✅ CORRECT — mobile grid, desktop flex
<div className="sm:grid lg:flex gap-6">
```

## Pre-Review Checklist (Story Workflow)

Before running `/review-story`, run the story's E2E spec locally to catch crashes and test failures before the full review pipeline runs:

```bash
npx playwright test tests/e2e/story-{epic}-{story}.spec.ts --project=chromium
```

This avoids a full review pipeline run only to discover a basic spec crash — saving 5-10 minutes per iteration.

## Zod-Validated Structured Output for LLM JSON Calls

Use Zod schemas to validate JSON returned from LLM structured-output calls. LLMs may omit optional fields, use wrong types, or produce subtly malformed JSON even when instructed to follow a schema.

```typescript
import { z } from 'zod'

const FlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()).default([]),
})

const ResponseSchema = z.array(FlashcardSchema)

const raw = await llm.generateObject({ schema: ResponseSchema, prompt })
// raw is typed and validated — missing fields get defaults, wrong types throw
```

**Why:** LLM structured output is not a guarantee — it's a strong hint. A Zod parse failure is an explicit error with a useful message rather than a silent downstream bug (e.g., `undefined.length` in the render path).

**When to use:** Any LLM call where you use the response to mutate state, write to DB, or render UI. Passthrough logging calls don't need validation.

**Case study:** E72 retro — multiple stories discovered silent LLM output bugs when optional fields were omitted. Zod validation with `.default()` handles the common case cleanly.

## Dexie Mock Boilerplate for Unit Tests (`vi.mock('@/db')`)

Any unit test that imports a hook or store that touches Dexie must mock both `@/db` and `@/db/schema` at the top of the file. Dexie calls `indexedDB.open()` at module-load time, which throws `MissingAPIError: IndexedDB API missing` in jsdom.

```typescript
// At the top of any test file that imports Dexie-dependent code
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({
  db: {
    tableName: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))
```

**Key rule:** Mock `@/db/schema` with the specific tables your code under test accesses — not a blanket empty object. The mock must match the exact Dexie API surface the code calls (`.where().equals().toArray()`, `.add()`, etc.), otherwise you get `TypeError: db.tableName.where is not a function`.

**When updating a store** that grows new DB operations (e.g., `removeServer` now also deletes related `books`), update the existing mock to add the new table — don't rely on the blanket `{}` stub.

**Case study:** E57 retro — `useAudiobookshelfStore`, `UnifiedLessonPlayer`, and `useQuizGeneration` tests all failed with `MissingAPIError` until db mocks were added.

## Test the Real Function, Never a Replica

Write unit tests against the production function directly. Never copy-paste the function's logic into the test to compute the expected value.

```typescript
// ❌ WRONG — tests a replica, not the real function
it('formats duration correctly', () => {
  const seconds = 3661
  const expected = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m` // replica
  expect(formatDuration(seconds)).toBe(expected)
})

// ✅ CORRECT — expected value is a hard-coded literal derived from domain knowledge
it('formats duration correctly', () => {
  expect(formatDuration(3661)).toBe('1h 1m')
})
```

**Why replicas are dangerous:** They duplicate the same logic flaw. If `formatDuration` has an off-by-one bug, the replica test has the same bug and passes. The literal `'1h 1m'` catches the flaw.

**How to derive literals:** Run the function in a REPL or browser console with known inputs, capture the output, and assert that exact value. If the function is too complex to run manually, it's a sign it needs to be decomposed.

**Case study:** E62 retro — retention score display test computed the expected hex color using the same OKLCH formula as the component. The test passed even when the formula was wrong, because both used the same buggy math.

## Semantic State Over Computed Style Assertions

Assert on semantic state (ARIA attributes, data attributes, text content, class names with meaning) — never on computed CSS values (`getComputedStyle`, raw hex colors, pixel dimensions).

```typescript
// ❌ WRONG — brittle, theme-dependent, not semantic
expect(getComputedStyle(badge).backgroundColor).toBe('rgb(239, 68, 68)')

// ✅ CORRECT — asserts what the user perceives
expect(badge).toHaveAttribute('data-status', 'error')
expect(badge).toHaveClass('bg-destructive')
expect(badge).toHaveTextContent('Failed')

// ✅ ALSO CORRECT — ARIA communicates state
expect(meter).toHaveAttribute('aria-valuenow', '75')
expect(alert).toHaveAttribute('aria-live', 'polite')
```

**Why computed styles fail:** jsdom doesn't process Tailwind CSS — `getComputedStyle()` returns empty/default values. Even in browsers, hex color assertions break when themes change.

**Rule for custom status indicators:** Add a `data-status` or `data-variant` attribute to the element and assert on that. The semantic meaning is stable across theme changes and refactors.

**Case study:** E62 retro — `TopicTreemap` retention color tests initially asserted on hex values via `getComputedStyle()`. Tests passed in one theme and silently failed in another. Switched to `data-retention-tier` attribute assertions.

## RLS Testing Requires a Transaction

When writing SQL tests for Postgres RLS policies using `auth.uid()`, all role-switching and JWT claims must be wrapped in an explicit transaction:

```sql
BEGIN;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub": "user-a-uuid"}', true);
  -- now auth.uid() resolves correctly
  SELECT * FROM content_progress WHERE user_id = 'user-b-uuid'; -- returns 0 rows
COMMIT;
```

**Why it fails without a transaction:** `set_config(..., is_local=true)` scopes the value to the current transaction. In psql autocommit mode each statement runs in its own implicit transaction. The `set_config` applies to that single statement's transaction (which has no follow-up query), so the next `SELECT` sees no JWT and `auth.uid()` returns NULL — making RLS allow everything (NULL != user_id is always false, but NULL-safe comparison behavior varies by policy).

**Applies to:** Any psql-based RLS isolation test using `auth.uid()`, `auth.role()`, or JWT claims.

**Case study:** E92-S01 — first AC3 attempt ran set_config + SET ROLE + SELECT as separate statements; all rows were visible across users. Wrapping in BEGIN/COMMIT fixed it.

## Cross-Model Severity Divergence is a Quality Signal

When multiple AI reviewers (Claude, GLM, OpenAI) rate the same finding at widely different severities (e.g., NIT vs HIGH vs BLOCKER), the spread itself is a signal — not just noise to average away. It means the code is ambiguous enough to confuse both reviewers and future maintainers.

**Rule:** Fix any finding where cross-model severity range spans more than 2 levels (e.g., NIT→HIGH or LOW→BLOCKER), regardless of the lowest rating given.

**Why:** A finding rated NIT by one model and BLOCKER by another typically indicates latent ambiguity — the code works today but creates a footgun for the next person who touches it. The lowest-severity reviewer may be correct about current impact, but the highest-severity reviewer is often correct about future risk.

**Case study:** E92-S01 R3 — duplicate `_status_rank()` definition was rated NIT (Claude), HIGH (GLM), BLOCKER (OpenAI-fallback). Real impact was maintainability risk, not runtime bug. Fixed in R3. The spread correctly flagged an issue that would have confused any future maintainer editing the fixup migration.

## Dexie Upgrade Callbacks Cannot Read Async Auth State

The Dexie `.upgrade()` callback runs synchronously during `db.open()`, which executes at module import time — before Zustand, Supabase, or any async auth hydration has completed. Reading `userId` from an auth store inside `.upgrade()` will always return `null` on first app load, silently skipping every record.

**Pattern:** Split data backfill into two phases:
1. **Migration-time (inside `.upgrade()`):** stamp only static values like `updatedAt = migrationNow`
2. **Post-auth (hook):** stamp user-specific values like `userId` from a post-`db.open()` auth lifecycle hook

```typescript
// ❌ Wrong — auth store is null at upgrade time
database.version(52).upgrade(async tx => {
  const userId = useAuthStore.getState().userId // always null here
  await tx.table('notes').modify(r => { r.userId = userId }) // no-op
})

// ✅ Correct — split the work
database.version(52).upgrade(async tx => {
  const now = new Date().toISOString()
  await tx.table('notes').modify(r => { if (!r.updatedAt) r.updatedAt = now })
})
// After db.open(), in useAuthLifecycle:
backfillUserId(session.user.id) // stamps userId post-auth
```

**Case study:** E92-S02 — initial design would have called `useAuthStore.getState().userId` inside the v52 upgrade callback. The race was caught during story planning and the two-phase design was adopted from the start.

## Dexie Filter Semantics for Missing Fields

`db.table(t).where('field').equals(undefined)` returns **zero rows** even when documents have no `field` key at all. Dexie's sparse index only tracks documents where the indexed field is present and defined — `undefined` and absent are not the same from the index's perspective.

**Pattern:** To find records where a field is missing, null, or empty, use `.toCollection().filter()`:

```typescript
// ❌ Wrong — returns 0 rows for documents missing 'userId'
await db.notes.where('userId').equals(undefined).modify(stamp)

// ✅ Correct — catches missing, null, and empty-string
await db.notes.toCollection().filter(r => !r.userId).modify(stamp)
```

This is slower (full table scan vs index lookup), but it's the only reliable way to target "field not present" records. In steady state after backfill, the filter returns 0 rows so the performance cost is negligible.

**Case study:** E92-S02 — first draft of `backfillUserId` used `.where('userId').equals(undefined)` and silently backfilled nothing. Switching to `.filter(r => !r.userId)` fixed it.

## JSONB + GIN for Schema-Flexible Columns

When a Postgres/Supabase column needs to hold schema-divergent data from multiple sources (imported courses from different providers, AI-generated annotations over time, per-user experiment flags), reach for `JSONB` + a `GIN` index instead of:

- Adding nullable polymorphic columns for each source
- Creating a separate table per integration
- Storing opaque JSON text that the database can't query into

**When it pays off:**
- The shape of the data varies by source but all sources share a parent entity (e.g., `importedCourses.metadata JSONB` where YouTube/Udemy/Coursera each contribute different fields)
- You need to query *into* the JSON (e.g., "find all courses where `metadata->>'platform' = 'youtube'`")
- Schema churn from `ALTER TABLE ADD COLUMN` per new source is becoming painful

**When to reach for a proper column instead:**
- The field is always present and always queried — use a typed column
- The field has referential integrity needs (foreign keys)
- The query pattern is a simple equality check on a hot path — typed column + B-tree is faster than JSONB + GIN

**Pattern:**
```sql
ALTER TABLE imported_courses ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
CREATE INDEX imported_courses_metadata_gin ON imported_courses USING GIN (metadata);

-- Now queryable at speed:
SELECT * FROM imported_courses WHERE metadata @> '{"platform":"youtube"}';
SELECT * FROM imported_courses WHERE metadata->'tags' ? 'postgres';
```

**Note:** This pattern is already partially in use in E92 (`messages JSONB`, `preferences JSONB`) but without GIN indexes because those columns aren't queried into. New columns that WILL be queried into should add the GIN index from the start.

**Reference:** `docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md` §4.3 documents this as an accepted design pattern for future Postgres-backed features.

## `vi.hoisted()` for Shared Vitest Mock Factories

When a Vitest test needs to mock multiple modules that all reference the same underlying spy (e.g., `db.table.toArray()` used by both `syncEngine` and `syncableWrite`), define the spies with `vi.hoisted()` once and reference them from every `vi.mock()` factory. This avoids the "factory cannot access outer variable" error that occurs when a `vi.mock()` factory closes over a `const` declared above it — because `vi.mock()` calls are hoisted to the top of the file, but `const` declarations are not.

```typescript
// ✅ Correct — spies hoisted with vi.hoisted(), reused across mocks
const { mockToArray, mockBulkDelete, mockFrom } = vi.hoisted(() => ({
  mockToArray: vi.fn().mockResolvedValue([]),
  mockBulkDelete: vi.fn().mockResolvedValue(undefined),
  mockFrom: vi.fn().mockReturnValue({ upsert: vi.fn(), insert: vi.fn() }),
}))

vi.mock('@/db', () => ({
  db: { syncQueue: { toArray: mockToArray, bulkDelete: mockBulkDelete } },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ❌ Wrong — ReferenceError at test load: "Cannot access 'mockToArray' before initialization"
const mockToArray = vi.fn().mockResolvedValue([])
vi.mock('@/db', () => ({ db: { syncQueue: { toArray: mockToArray } } }))
```

**When to use:**
- Any Vitest suite that mocks 2+ modules sharing spy state
- Any test that reaches into mock internals via `mockReturnValue` / `mockResolvedValue` between `it()` blocks (spies declared with `vi.hoisted()` can be mutated inside `beforeEach` without remount)

**When not to use:**
- Single-mock tests — a plain `vi.fn()` declared above the `vi.mock()` is slightly clearer when only one factory needs it (Vitest's hoisting is transparent for this case)

**Case study:** E92-S05 — `syncEngine.test.ts` needed to coordinate 9 spies across `@/db`, `@/lib/supabase`, `@/stores/useAuthStore`, and `navigator.locks`. Initial implementation hit hoisting ReferenceErrors until the entire spy set was wrapped in a single `vi.hoisted()` block. Reference: `src/lib/sync/__tests__/syncEngine.test.ts:18-55`.

## `ignore` Flag Cleanup for Async `useEffect`

When a React effect performs an async fetch whose result writes to component state, a stale response can land after the component has unmounted or its deps have changed — causing a "setState on unmounted component" warning and, worse, stale data flashing into the UI. Guard the state setter with a locally-scoped `ignore` flag that the effect cleanup flips to `true`.

```typescript
// ✅ Correct — stale response short-circuits before touching state
useEffect(() => {
  if (!open || !userId) return
  let ignore = false
  setCounts(null)
  countUnlinkedRecords(userId)
    .then((result) => {
      if (!ignore) setCounts(result)
    })
    .catch((err) => {
      console.error('[LinkDataDialog] countUnlinkedRecords failed:', err)
    })
  return () => { ignore = true }
}, [open, userId])

// ❌ Wrong — no guard; late resolution overwrites newer state or leaks on unmount
useEffect(() => {
  countUnlinkedRecords(userId).then(setCounts)
}, [open, userId])
```

**Why this beats AbortController for Dexie/IndexedDB calls:**
- Dexie and other IDB wrappers typically don't accept an `AbortSignal`, so cancellation has to happen at the consumer, not the producer.
- The pattern is local, synchronous, and obvious in diff review — no signal plumbing required.

**When to use:**
- Any `useEffect` that performs async work and writes to React state on success
- Especially when the dep array changes frequently (dialog open/close, userId changes, search inputs)

**When not to use:**
- Effects that only call imperative APIs with no state writes afterwards (e.g., `fetch()` whose response is intentionally ignored)
- Effects where the underlying API does accept an `AbortSignal` — prefer real cancellation over flag-based suppression

**Case study:** E92-S08 — `LinkDataDialog` fires `countUnlinkedRecords(userId)` each time the dialog opens. Without the `ignore` flag, closing and reopening the dialog for a different user could surface the previous user's counts for a frame. Reference: `src/app/components/sync/LinkDataDialog.tsx:59-73`.

## Module-Level `Map` Registry in Pure Modules

When a "pure" module (no React imports, no Zustand, no side-effectful singletons) needs to let other modules register callbacks — e.g., the sync engine letting each store register a "refresh me after download" hook — use a module-level `Map` keyed by a string identifier. Do not import the Zustand store into the pure module to call it directly.

```typescript
// syncEngine.ts — pure module
const _storeRefreshRegistry = new Map<string, () => Promise<void>>()

export const syncEngine = {
  registerStoreRefresh(tableName: string, callback: () => Promise<void>) {
    _storeRefreshRegistry.set(tableName, callback)
  },
  // …engine calls callback by tableName after applying downloaded records
}

// useSyncLifecycle.ts — impure (React/Zustand) module, wires the registry
useEffect(() => {
  syncEngine.registerStoreRefresh('notes', () =>
    useNoteStore.getState().loadNotes(),
  )
}, [])
```

**Why a Map instead of importing the store:**
- Importing `useNoteStore` into `syncEngine.ts` would pull Dexie's `db` import into the test environment at module load, which triggers `Dexie.open()` in jsdom and creates hard-to-mock side effects.
- The registry keeps `syncEngine.ts` mockable with `vi.mock('@/db', ...)` alone — no store mocking needed.
- Circular dependency risk drops to zero: pure module never imports its consumers.

**When to use:**
- Any module that is imported by unit tests under a jsdom/node environment and must stay framework-free
- Any pub/sub seam where the consumer count is known-bounded (small number of stores, tables, or channels)

**When not to use:**
- Event buses with unbounded subscribers — prefer a typed `EventEmitter` or RxJS Subject
- Registries where ordering matters — `Map` preserves insertion order but doesn't support priority

**Case study:** E92-S05/S07 — `syncEngine` registers per-table refresh callbacks via `registerStoreRefresh(tableName, callback)`; `useSyncLifecycle` wires the P0 stores in one `useEffect`. Keeping the registry in-module let the S05 test suite mock only `@/db` and `@/lib/supabase`. Reference: `src/lib/sync/syncEngine.ts:137` (registry) and `src/lib/sync/syncEngine.ts:880-882` (public API).

## Single Write Path for Synced Mutations

When a Dexie table participates in Supabase sync, every caller must write through one wrapper function — not directly via `db.<table>.put()` / `.add()` / `.delete()`. The wrapper owns metadata stamping (`userId`, `updatedAt`), optimistic local write, field stripping (non-serializable handles, vault credentials), queue enqueue, and engine nudge. Scattering those responsibilities across stores leaks them.

```typescript
// ✅ Correct — stores write through the wrapper
import { syncableWrite } from '@/lib/sync/syncableWrite'

async function saveProgress(entry: ContentProgress) {
  await syncableWrite('contentProgress', 'put', entry)
}

// ❌ Wrong — direct Dexie write bypasses metadata stamping and queue enqueue
async function saveProgress(entry: ContentProgress) {
  await db.contentProgress.put(entry) // no userId, no updatedAt, no sync queue entry
}
```

**The wrapper guarantees:**
1. **Metadata stamping** — `userId` from `useAuthStore.getState()`, `updatedAt` from a single `new Date().toISOString()` captured once per call.
2. **Optimistic local write** — Dexie write happens immediately; failures propagate to the caller.
3. **Field stripping** — `toSnakeCase()` drops `stripFields` (browser handles) and `vaultFields` (credentials) before the payload is queued.
4. **Queue enqueue** — `SyncQueueEntry` inserted only when `userId` is present and `skipQueue` is not set.
5. **Engine nudge** — `syncEngine.nudge()` triggers a debounced upload cycle.

**Error-handling contract:**
- Dexie write failure → rethrow (fatal; caller surfaces to the user).
- Queue insert failure → log + swallow (non-fatal; Dexie is the source of truth; the next full sync scan reconciles).

**When to use:**
- Every mutation of a table registered in `tableRegistry.ts`
- Both authenticated and unauthenticated flows — the wrapper internally skips the queue when no `userId` is present, but still stamps `updatedAt`

**When not to use:**
- Reads (`get`, `where().toArray()`) — the wrapper is write-only
- Tables explicitly excluded from sync (e.g., local-only scratch tables that are never in `tableRegistry`)
- One-time backfill scripts that need to set `userId` without enqueuing every row — use `skipQueue: true`

**Enforcement:** Today the rule is convention + review. A future ESLint rule (tracked as tech debt) will flag direct `db.<synced-table>.put/add/delete` calls outside `syncableWrite.ts` itself.

**Case study:** E92-S04 introduced `syncableWrite`; E92-S09 wired the P0 stores (`contentProgress`, `studySessions`, `progress`) through it. PRs #343 and #348. Reference: `src/lib/sync/syncableWrite.ts:66-166`.

## Compound-PK recordId Synthesis — Unit Separator Join

Compound-PK tables (`progress`, `contentProgress`, `chapterMappings`) declare `compoundPkFields: string[]` in `tableRegistry.ts`. `syncableWrite` synthesizes `syncQueue.recordId` by joining those field values with `\u001f` (ASCII unit separator). Printable delimiters (`:`, `/`, `-`) risk collision with user-supplied ids like URIs, paths, and UUIDs. `\u001f` is collision-safe by construction because it cannot appear in URIs, slugs, or UUIDs.

```typescript
// src/lib/sync/syncableWrite.ts
if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
  const parts = entry.compoundPkFields.map((f) => String(record[f]))
  if (parts.some((p) => !p.trim())) throw new Error(/* empty recordId */)
  recordId = parts.join('\u001f')
}
```

**Symmetry requirement:** The download path (`syncEngine._getLocalRecord`) must use the identical `\u001f` join when deriving a recordId from field values. Drift between upload/download silently breaks `syncQueue` coalescing.

**Empty-part guard:** Throw if any compound field is empty or whitespace — do not enqueue a partial recordId that collides with a differently-partial row.

Case study: PR #361 post-E93 cleanup — resolved R1-PE-01 (missing `compoundPkFields` declaration on the `progress` table). Full narrative: `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`.

## Fail-Closed Destructive Migrations (Session GUC + RLS Audit)

When a Supabase migration must `DELETE` rows to satisfy a new constraint (UNIQUE, CHECK, FK), every row destruction must be (a) gated on per-session operator acknowledgement, and (b) recoverable from a durable audit trail. Four layered safeguards — each addresses a real failure mode surfaced during the embeddings UNIQUE(note_id) migration:

**1. Session-scoped GUC gate with `pg_settings.source = 'session'` check.** Don't trust `current_setting('my.flag') = 'on'` alone — that flag can persist via `ALTER ROLE` or `postgresql.conf`. Verify the source was `session` (set by `SET LOCAL` in the current transaction):

```sql
SELECT source INTO v_allow_source FROM pg_settings WHERE name = 'knowlune.allow_dedup';
IF v_allow_flag IS DISTINCT FROM 'on' OR v_allow_source IS DISTINCT FROM 'session' THEN
  RAISE EXCEPTION 'Silent dedup not allowed. Run SET LOCAL … in this session.';
END IF;
```

**2. Durable audit table, not just `RAISE WARNING`.** Log aggregators truncate long messages (CloudWatch 256KB, Datadog 1MB). Write deleted-row provenance to a permanent `public._<feature>_audit_<date>` table before the DELETE so reconciliation does not depend on log capture.

**3. RLS + REVOKE ALL on the audit table.** Supabase's `ALTER DEFAULT PRIVILEGES` grants `SELECT` to `anon` and `authenticated` on new `public` tables. Without explicit `REVOKE ALL` + `ENABLE ROW LEVEL SECURITY` (with zero policies), PostgREST exposes per-row `user_id ↔ <pk>` correlation cross-tenant.

**4. Bounded `EXCLUSIVE` lock with `lock_timeout`.** `LOCK TABLE … IN EXCLUSIVE MODE` + `SET LOCAL lock_timeout = '3s'` blocks concurrent writes without stalling reads, and fails fast if long readers block the deploy. Note: `ADD CONSTRAINT UNIQUE` upgrades to `ACCESS EXCLUSIVE` briefly — schedule during off-peak.

**Tie-break on freshness, not id.** When picking the survivor row in `DISTINCT ON`, `ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id`. UUID lexicographic order picks randomly and can orphan the id the client's local record points to.

**Idempotent `ADD CONSTRAINT`.** Wrap in `DO $$ IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = …) THEN ALTER TABLE … ADD CONSTRAINT … END IF $$;`.

Reference implementation: `supabase/migrations/20260419000001_embeddings_unique_note_id.sql`. Full architectural narrative with each safeguard mapped to the review finding that forced it: `docs/solutions/best-practices/fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md`.

## GREATEST Monotonic Guard Requires a Separate Reset RPC

Supabase upserts that use `GREATEST(existing, incoming)` to enforce monotonic advancement silently swallow intentional resets. When a user explicitly sends `mastery_score = 0`, `GREATEST(current_value, 0)` keeps the existing value — the reset is a no-op with no error or exception.

**Fix:** Provide a separate `SECURITY DEFINER` RPC for any operation that must bypass the monotonic guard:

```sql
CREATE OR REPLACE FUNCTION reset_flashcard_mastery(p_user_id uuid, p_card_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE flashcard_progress
  SET mastery_score = 0, updated_at = now()
  WHERE user_id = p_user_id AND card_id = p_card_id;
END;
$$;
```

**Rule:** Whenever you add a `GREATEST`/`LEAST` guard to an upsert, document the intentional-reset escape hatch in the same migration. The guard and its bypass must ship together.

**Case study:** E93-S06 R3 BLOCKER — `flashcard_progress` upsert with `GREATEST` guard silently discarded all "Reset Mastery" actions. Fixed by adding a dedicated `reset_flashcard_mastery` RPC. Reference: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`.

## Upsert PK Reuse — Look Up Natural Key Before Generating UUID

Any upsert that generates a fresh UUID on every call accumulates unbounded duplicate rows when the unique constraint is on the PK (the generated UUID) rather than on the natural key.

```typescript
// ❌ Wrong — generates a new PK on every call; inserts a fresh row every time
await db.embeddings.put({ id: crypto.randomUUID(), sourceId, vector })

// ✅ Correct — reuse the existing PK; only mint a UUID for truly new records
const existing = await db.embeddings.where('sourceId').equals(sourceId).first()
const id = existing?.id ?? crypto.randomUUID()
await db.embeddings.put({ id, sourceId, vector, updatedAt: now })
```

Also add a natural-key unique constraint on the Supabase side so `ON CONFLICT (source_id) DO UPDATE` handles concurrent writes correctly.

**Rule:** If a function generates a fresh UUID and immediately upserts it, verify the unique constraint is on the natural key (not just the PK). If it's PK-only, the function silently accumulates duplicates.

**Case study:** E93-S05 BLOCKER — `saveEmbedding` called `crypto.randomUUID()` on every invocation; each note accumulated hundreds of duplicate rows. Reference: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`.

## Append-Only Tables Must Use `created_at` as Sync Cursor

The download engine's delta sync queries `WHERE updated_at > last_sync_at`. Append-only tables (e.g., `audio_bookmarks`, event logs) have no `updated_at` — they only insert. Using the default `updated_at` cursor silently skips all rows; the download completes with zero results and no error.

**Fix:** Register append-only tables with `cursorColumn: 'created_at'` in the table registry:

```typescript
// tableRegistry.ts
{
  tableName: 'audio_bookmarks',
  cursorColumn: 'created_at',  // ← not 'updated_at'
  conflictTarget: 'id',
  appendOnly: true,
}
```

**Rule:** Before registering any table in the sync registry, answer: "Can rows be updated after insertion?" If no, set `cursorColumn: 'created_at'` and `appendOnly: true`. Using `updated_at` on an append-only table is a silent regression — all existing rows are skipped on first sync.

**Case study:** E93-S07 — `audio_bookmarks` uses `created_at` only; the standard `updated_at` cursor caused the download engine to skip every row. Reference: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`.
