## Security Review: Course Timeline Redesign

**Date:** 2026-04-04
**Phases executed:** 5/8
**Diff scope:** 3 files changed, 364 insertions, 321 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors analyzed |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 6 categories checked |
| 4 | Dependencies | package.json not changed | N/A |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | No new routes/components | N/A |
| 7 | Configuration | No config files changed | N/A |
| 8 | Config Security | Always-on | 1 pre-existing finding |

### Attack Surface Changes

**CourseOverview.tsx** — Full JSX rewrite of the course overview page. The attack surface is **unchanged**. The same data sources (IndexedDB via Dexie, adapter API) feed the same types of output (text content in React JSX, `<img src>` from blob URLs, `<Link to>` for client-side routing). Specific vectors analyzed:

1. **User-supplied text rendering** (course name, description, tags, author name, PDF filenames): All rendered via React JSX text interpolation (`{course.name}`, `{course.description}`, `{stripExtension(pdf.filename)}`). React auto-escapes these values. No `dangerouslySetInnerHTML`, no `innerHTML`, no `ref.current.innerHTML`.

2. **Inline styles with SVG data URI**: A new base64-encoded SVG is used as a CSS `backgroundImage`. The SVG is a static hardcoded string literal (`data:image/svg+xml;base64,...`) that decodes to `<svg width="20" height="20"><circle cx="1" cy="1" r="1" fill="currentColor"/></svg>`. No user data flows into this value. The other inline style uses CSS variable references (`var(--accent-violet-muted)`) which are also not user-controlled.

3. **Thumbnail `<img src>`**: The `thumbnailUrl` comes from `adapter.getThumbnailUrl()` which returns blob URLs from the File System Access API. The existing `blob:` URL check and revocation pattern is preserved. The `<img>` tag uses `alt=""` (decorative) and has an `onError` handler that hides it — no script injection vector here since `<img src>` does not execute JavaScript in modern browsers (only `onerror` does, which is hardcoded).

**LessonsTab.tsx** — Added controlled folder expansion state (`useState<Set<string>>`). This is pure UI state management. No new data inputs, no new external data rendering. The `searchQuery` and `folder` values that control expansion state are internal strings (folder names from the file system path, already present in the pre-existing code).

**UnifiedLessonPlayer.tsx** — Added `adapter?.getCourse?.()` call to resolve course name for breadcrumb display. The `courseName` value flows into `<CourseBreadcrumb courseName={courseName} />`. This is React text interpolation — auto-escaped.

### Findings

#### Blockers
None.

#### High Priority
None.

#### Medium
None.

#### Informational

- **Pre-existing: `.mcp.json` tracked in git with API key** (confidence: 95, but **not introduced by this diff**): The always-on Phase 8 check detected that `.mcp.json` is tracked by git (`git ls-files` confirms) and contains a Google API key in the `X-Goog-Api-Key` header field. This file is **not** listed in `.gitignore`. This is a pre-existing condition — not introduced or modified by the current changes — so it does not block this review. However, it should be addressed separately:
  - Add `.mcp.json` to `.gitignore`
  - Remove from git tracking: `git rm --cached .mcp.json`
  - Consider rotating the exposed key if the repository has been pushed to a remote
  - Use environment variable references (`${GOOGLE_API_KEY}`) in `.mcp.json` instead of plaintext values

### Secrets Scan

Clean — no secrets detected in the diff. Searched for: hardcoded API keys (AKIA, sk-, ghp_, gho_), passwords, tokens, bearer strings, console.log of sensitive data. No matches.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No new routes, no premium gating changes |
| CS2: Client-Side Injection (XSS) | Yes | No | All user data (course name, description, tags, filenames, author name) rendered via React JSX auto-escaping. No `dangerouslySetInnerHTML`, `innerHTML`, or `href={variable}`. Static base64 SVG data URI is hardcoded (not user-controlled). |
| CS3: Sensitive Data in Client Storage | No | No | No changes to storage patterns. No API keys, tokens, or credentials handled. |
| CS5: Client-Side Integrity | No | No | No IndexedDB schema changes, no Zustand persist changes |
| CS7: Client-Side Security Logging | No | No | No `console.log` statements added. No sensitive data in error messages. |
| CS9: Client-Side Communication | No | No | No postMessage handlers, no cross-window communication, no iframe changes |
| A05: Security Misconfiguration | No | No | No config file changes |
| A06: Vulnerable Components | No | No | No dependency changes |
| A07: Auth Failures | No | No | No auth-related changes |

**React-Specific XSS Vector Checklist (applied to all changed `.tsx` files):**

| Vector | Present? | Details |
|--------|----------|---------|
| `dangerouslySetInnerHTML` | No | Not used in any changed file |
| `href={variable}` | No | All navigation via `<Link to>` (React Router) and `navigate()` — internal route paths only |
| `ref.current.innerHTML` | No | Not present |
| `data:` URLs in `<iframe src>` | No | No iframes in changed code |
| `React.createElement(userInput)` | No | Not present |
| `window.open(userInput)` | No | Not present |

### What's Done Well

1. **Consistent use of React JSX auto-escaping**: All user-supplied strings (course names, descriptions, tags, filenames, author names) are rendered as text children or text content within JSX elements. No bypass of React's built-in escaping at any point in the diff.

2. **Static inline styles**: The two inline `style` attributes use hardcoded CSS values (radial gradient with CSS variables, static base64 SVG). No user-controlled data is interpolated into style properties, eliminating CSS injection risk entirely.

3. **Proper blob URL lifecycle management**: The existing thumbnail URL pattern correctly tracks blob URLs via ref and revokes them in the useEffect cleanup, preventing memory leaks. The `onError` handler on the `<img>` tag is hardcoded behavior (hiding the element), not influenced by user data.

---
Phases: 5/8 | Findings: 0 in-scope (1 pre-existing informational) | Blockers: 0 | False positives filtered: 0
