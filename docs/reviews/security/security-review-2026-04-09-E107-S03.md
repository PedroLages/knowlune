## Security Review: E107-S03 — Fix TOC Loading and Fallback

**Date:** 2026-04-09
**Phases executed:** 5/8
**Diff scope:** 16 files changed, 1442 insertions, 20 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | 0 in diff (2 pre-existing noted) |
| 3 | OWASP Top 10 | Always | 9 categories checked |
| 4 | Dependencies | package.json changed | 0 new (pre-existing noted) |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | No new routes | N/A |
| 7 | Configuration | No config files changed | N/A |
| 8 | Config Security | Always-on checks | 2 pre-existing findings |

### Attack Surface Changes

This story introduces two attack surface vectors, both related to E2E test infrastructure:

1. **Test mode backdoor in BookContentService** (`src/services/BookContentService.ts:68-73`): A `TEST_MODE` flag and `window.__BOOK_CONTENT_TEST_MODE__` global allow bypassing normal EPUB content loading. When enabled, `getEpubContent()` returns a mock EPUB instead of reading real files from OPFS/remote sources. The check is a pure boolean OR between a module-level flag and a window global. Any code running in the page context (browser console, XSS payload, compromised extension) can set `window.__BOOK_CONTENT_TEST_MODE__ = true` to redirect all EPUB loading to mock content.

2. **Window global function exposure** (`src/main.tsx:6-17`): The `window.__enableBookContentTestMode__` function is exposed unconditionally in all environments (dev and production). The dynamic import in main.tsx executes at app startup, registering the function on `window` regardless of `import.meta.env.PROD`.

**Existing surface preserved**: The `TocItem.label` rendering (from epub.js NavItem) uses React JSX text interpolation (`{item.label.trim()}`), which is auto-escaped by React. The `chapterDisplay` computed in `ReaderHeader.tsx:67-69` is a string built from `currentChapter` or a numeric percentage, also rendered via JSX text interpolation. No `dangerouslySetInnerHTML`, no `href={variable}` to user content, no `ref.current.innerHTML` manipulation. These remain safe.

### Findings

#### Blockers (critical vulnerabilities -- must fix before merge)

None.

#### High Priority (should fix)

- **[src/main.tsx:8-16]** (confidence: 78): Test mode function exposed in production bundle

  **Exploit:** The `window.__enableBookContentTestMode__` function and `window.__BOOK_CONTENT_TEST_MODE__` check are included in the production JavaScript bundle (confirmed via `grep` on `dist/assets/index-*.js`). Any script running in the page context (malicious browser extension, XSS payload on a different part of the app, supply-chain compromised dependency) can call `window.__enableBookContentTestMode__()` or set `window.__BOOK_CONTENT_TEST_MODE__ = true`. This would cause all EPUB content loading to silently return a mock EPUB instead of the user's actual books. While this does not expose secrets, it is a denial-of-service vector that could confuse users and undermine data integrity (e.g., reading progress saved against wrong content).

  **Fix:** Gate the test-mode registration behind an environment check:
  ```typescript
  // E2E TEST SUPPORT: Only expose in development/test environments
  if (typeof window !== 'undefined' && !import.meta.env.PROD) {
    import('./services/BookContentService').then(({ enableTestMode }) => {
      ;(window as any).__enableBookContentTestMode__ = enableTestMode
      if ((window as any).__BOOK_CONTENT_TEST_MODE__) {
        enableTestMode()
      }
    })
  }
  ```
  Additionally, the `isTestMode()` check in `BookContentService.ts:68-73` should also verify `!import.meta.env.PROD` to provide defense-in-depth. With `import.meta.env.PROD` as a dead-code guard, Vite's tree-shaking will exclude the entire block from the production bundle, also removing the `createMinimalEpub` / JSZip dependency from the production output and reducing bundle size.

- **[src/services/BookContentService.ts:17]** (confidence: 75): Production code imports test-only module at top level

  **Exploit:** `BookContentService.ts` has a static `import { createMinimalEpub } from './__tests__/minimalEpub'` at line 17. This means `minimalEpub.ts` (and its `JSZip` dependency) are always part of the module graph, even in production builds. While the build succeeds (Vite bundles devDependencies), this has two consequences: (a) the JSZip library (~100KB minified) is unnecessarily included in the production bundle, and (b) production source code ships test infrastructure code that increases the attack surface (the `createMinimalEpub` function is reachable at runtime).

  **Fix:** Convert the static import to a dynamic import inside the test-mode branch:
  ```typescript
  async getEpubContent(book: Book): Promise<ArrayBuffer> {
    if (this.isTestMode()) {
      const { createMinimalEpub } = await import('./__tests__/minimalEpub')
      return createMinimalEpub()
    }
    // ... rest of method
  }
  ```
  Combined with the `import.meta.env.PROD` guard recommended above, Vite's tree-shaking will completely eliminate the test-mode branch and the `minimalEpub`/JSZip dependency from the production bundle.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **[package.json]** (confidence: 90): `jszip` moved from `dependencies` to `devDependencies`. The build still succeeds because Vite resolves from `node_modules` regardless of dependency category. However, this creates a supply chain hygiene issue: the production bundle now implicitly depends on a devDependency (via the `BookContentService.ts` -> `minimalEpub.ts` -> `jszip` import chain). If a future build tool or CI pipeline uses `--production` flag to prune devDependencies, this will break. The dynamic import fix above resolves this class of issue entirely.

- **[.mcp.json:15]** (confidence: 95, PRE-EXISTING): Google API key `AQ.Ab8RN6Ia9...` committed to git. Not introduced by this diff but observed during secrets scan. `.mcp.json` is tracked by git and NOT in `.gitignore`. This is a Stitch MCP server API key that should be moved to an environment variable.

- **[.claude/settings.json]** (confidence: 95, PRE-EXISTING): `OPENAI_API_KEY` (sk-proj-...) and `ZAI_API_KEY` found in tracked settings file. The file IS listed in `.gitignore` (line 71) but was added to the git index BEFORE the gitignore entry, so it remains tracked. These keys are committed to git history. Not introduced by this diff.

### Secrets Scan

**In-diff secrets:** Clean -- no secrets introduced by this story's changes.

**Pre-existing secrets (out of diff scope, for awareness):**
1. `.mcp.json` contains a Google API key in plaintext, tracked by git, not gitignored.
2. `.claude/settings.json` contains `OPENAI_API_KEY` and `ZAI_API_KEY`, tracked by git despite gitignore entry (file was added to index before gitignore rule).

**Recommendation for pre-existing findings:** Rotate both keys. Remove `.claude/settings.json` from git tracking with `git rm --cached .claude/settings.json`. Add `.mcp.json` to `.gitignore`. Scrub history with BFG Repo Cleaner if the repository is public or shared.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No changes to auth or access control flows |
| CS2: Client-Side Injection (XSS) | Yes | No | TOC labels rendered via React JSX auto-escaping. No `dangerouslySetInnerHTML`, `innerHTML`, or `href={variable}` in changed code. `chapterDisplay` is a computed string from trusted sources (chapter name or numeric progress). |
| CS3: Sensitive Data in Client Storage | No | No | No changes to localStorage, IndexedDB, or cookie handling |
| CS5: Client-Side Integrity | Yes | No | TOC loading timeout (5s) with fallback to empty state is purely presentational. No data validation changes. |
| CS7: Client-Side Security Logging | Yes | No | `console.log('[BookContentService] Test mode enabled...')` at line 38 is the only new log statement. It logs test mode activation, which is appropriate for debugging. No secrets logged. |
| CS9: Client-Side Communication | No | No | No postMessage, cross-window, or cross-origin communication changes |
| A05: Security Misconfiguration | Yes | Yes | Test mode function exposed in production bundle (see High finding) |
| A06: Vulnerable Components | Yes | No | `epubjs` has a pre-existing high-severity CVE (not new in this diff). `jszip` move to devDependencies does not change actual dependency resolution. |
| A07: Auth Failures | No | No | No auth flow changes |

### What's Done Well

1. **Safe rendering of TOC content:** The `TableOfContents.tsx` component renders `item.label.trim()` via React JSX text nodes, which automatically escapes HTML. No raw HTML injection vectors are present in the TOC display code. This is the correct approach for rendering EPUB metadata that could contain user-controlled content.

2. **Clean separation of test infrastructure:** The test mode is cleanly isolated behind a single boolean flag with a dedicated `enableTestMode()` export function, rather than scattered conditionals throughout the service. The `BookContentService.setTestMode()` static method and `isTestMode()` private method follow a clear pattern. The only issue is the missing production guard, which is a one-line fix.

3. **TOC loading timeout is purely presentational:** The 5-second timeout in `BookReader.tsx:131-139` only affects the UI state (`isTocLoading` -> `false`), not data integrity. When the timeout fires, the TOC simply shows "No table of contents available" instead of a spinner. The actual TOC data (`toc` state) remains empty or populated based on the epub.js callback, so there is no risk of data corruption or race conditions from the timeout.

---
Phases: 5/8 | Findings: 4 total | Blockers: 0 | High: 2 | False positives filtered: 0
