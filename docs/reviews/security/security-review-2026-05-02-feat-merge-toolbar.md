## Security Review: PR #484 — Merge Lesson Toolbar into Layout Header

**Date:** 2026-05-02
**Phases executed:** 8/8
**Diff scope:** 12 files changed (7 source, 5 test), ~2900 lines diff

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 9 categories checked, 0 findings |
| 4 | Dependencies | package.json NOT changed | N/A |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | New components/routes | 2 new components, 0 threats |
| 7 | Configuration | No config files changed | N/A |
| 8 | Config Security | Always-on checks | Clean |

### Attack Surface Changes

Three new attack surface vectors introduced:

1. **New localStorage-backed Zustand store** (`src/stores/useLessonChromeStore.ts`): Stores theater mode boolean (`lesson-theater-mode` key). Read on store initialization via `localStorage.getItem()`, written on toggle via `localStorage.setItem()`. No JSON parsing, no code execution path from stored data. Simple `raw === 'true'` string comparison.

2. **New route-parsing hook** (`src/app/hooks/useCourseRoute.ts`): Parses `useLocation().pathname` to extract `courseId` and `lessonId`. Values used for client-side navigation (React Router `Link` `to` prop and `navigate()` calls) and for course-name lookup in the import store. No server-side URL construction, no `window.location` assignment.

3. **New header-tools component** (`src/app/components/course/LessonHeaderTools.tsx`): Self-contained component reading from stores (Zustand) and rendering action buttons (theater mode, reading mode, notes, Pomodoro, QA chat, completion status). All buttons use React event handlers and Zustand store actions. No user-input-driven rendering.

### Findings

#### Blockers (critical vulnerabilities -- must fix before merge)
None.

#### High Priority (should fix)
None.

#### Medium (fix when possible)
None.

#### Informational (awareness only)

- **[`src/stores/useLessonChromeStore.ts:28-29,84-86`]** (confidence: 25 -- advisory): Module-level `readingModeToggleFn` callback registration mechanism is defined but never called in application code (only in tests). The `registerReadingModeToggle` function sits unused, meaning `toggleReadingMode` in the store is currently a no-op when invoked from `LessonHeaderTools` or `BottomNav`. Not a security vulnerability (calling arbitrary registered functions requires already having code execution), but the dead-callback pattern is worth noting during integration testing of the reading mode feature.

- **[`src/app/hooks/useCourseRoute.ts:36`]** (confidence: 15 -- informational): `pathname.split('/').filter(Boolean)` directly parses the browser URL without additional validation. The extracted `courseId` is used in React Router `Link` `to` paths and store lookups. Both are safe: React Router handles path encoding internally, and the store lookup is a simple `find()` equality check. No known exploit path.

### Secrets Scan
Clean -- no secrets, API keys, tokens, or credentials detected in the diff or new files.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | Yes | No | Guest gating preserved -- completion dropdown hidden for guests in LessonHeaderTools; no new route guards needed |
| CS2: Client-Side Injection (XSS) | Yes | No | No `dangerouslySetInnerHTML`, no `innerHTML`, no `href` with user-controlled protocols. `courseName` rendered as React text (auto-escaped). `courseId` used only in React Router `to` props (path-encoded) |
| CS3: Sensitive Data in Client Storage | Yes | No | Only boolean `'true'`/`'false'` stored in `lesson-theater-mode`. No API keys, tokens, or PII. Read uses simple `=== 'true'` comparison (no `JSON.parse`, no eval) |
| CS5: Client-Side Integrity | Yes | No | `readStoredTheater()` validates with `raw === 'true'` (only `'true'` string is truthy, everything else including corrupt data is `false`). `persistTheater` always writes `String(value)` (guaranteed `'true'` or `'false'`) |
| CS7: Client-Side Security Logging | Yes | No | No new `console.log` calls in changed files. Pre-existing `console.warn` for corrupted localStorage is in pre-existing code, not secrets |
| CS9: Client-Side Communication | No | N/A | No new `postMessage`, cross-window, or cross-origin communication |
| A05: Security Misconfiguration | No | N/A | No config files changed |
| A06: Vulnerable Components | No | N/A | `package.json` unchanged |
| A07: Auth Failures | No | N/A | No auth files changed |

### STRIDE Analysis

**New component: `LessonHeaderTools`**
| Threat | Assessment |
|--------|-----------|
| Spoofing | No identity decisions made |
| Tampering | All state in Zustand stores (in-memory); no external data mutated |
| Repudiation | No audit-trail actions performed |
| Information Disclosure | No sensitive data displayed or transmitted |
| Denial of Service | Lazy-loaded QAChatPanel prevents bundle bloat; no unbounded loops |
| Elevation of Privilege | Completion status dropdown hidden for guests (`!isGuest` guard) |

**New component: `useCourseRoute` hook**
| Threat | Assessment |
|--------|-----------|
| Spoofing | Cannot fake course context -- derives from browser URL which is user-visible and non-spoofable in client-side SPA |
| Tampering | Extracted IDs used only for read-only store lookups and React Router navigation |
| Repudiation | No actions performed |
| Information Disclosure | No data sent externally |
| Denial of Service | O(n) find() on imported courses array (typically <100 items) |
| Elevation of Privilege | No authorization decisions based on hook output |

**Module: `useLessonChromeStore`**
| Threat | Assessment |
|--------|-----------|
| Spoofing | Boolean value with no identity implications |
| Tampering | localStorage write wrapped in try/catch for quota errors; DOM attribute safely set/removed |
| Repudiation | UI state only, no audit requirement |
| Information Disclosure | Theater mode boolean is not sensitive |
| Denial of Service | Simple boolean toggle, no resource exhaustion path |
| Elevation of Privilege | No privilege boundary crossed |

### What's Done Well

1. **Safe localStorage pattern**: The `readStoredTheater()` function uses `raw === 'true'` (strict string comparison) instead of `JSON.parse()`, avoiding object injection risks. The write path uses `String(value)` ensuring only `'true'` or `'false'` are ever stored. Both read and write are wrapped in try/catch for browser storage API failures.

2. **Correct React text rendering**: The `courseName` extracted from the import store is rendered via standard JSX text interpolation (`<span>{courseName}</span>`), which React auto-escapes. There is no `dangerouslySetInnerHTML`, no `ref.current.innerHTML`, and no bypass of React's XSS protections.

3. **Client-side-only navigation**: All `Link` and `navigate()` calls use hardcoded route patterns with interpolated IDs. React Router v7 handles internal path encoding. No `window.location` assignments, no `window.open()` with user-controlled URLs, no open redirect vectors.

4. **Progressive enhancement with guest gating**: The completion status dropdown in `LessonHeaderTools` is correctly hidden for guest users via the existing `useAuthStore(selectIsGuestMode)` pattern, preventing guests from modifying progress state.

5. **Triaged try/catch with explicit fallbacks**: All localStorage operations use try/catch with well-defined fallback behavior (default to `false` for theater mode, no-op for failed writes), preventing storage quota exhaustion from crashing the UI.

6. **No new dependencies**: The PR introduces zero new npm packages, avoiding supply-chain risk entirely.

---
Phases: 8/8 | Findings: 0 total | Blockers: 0 | False positives filtered: 0
