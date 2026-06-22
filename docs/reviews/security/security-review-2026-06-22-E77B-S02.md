## Security Review: E77B-S02 — Drive Course Import Metadata and Schema

**Date:** 2026-06-22
**Phases executed:** 4/8
**Diff scope:** 10 files changed, 451 insertions, 5 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 3 categories checked |
| 4 | Dependencies | package.json unchanged | N/A |
| 5 | Auth & Access | no auth files changed | N/A |
| 6 | STRIDE | no new routes/components | N/A |
| 7 | Configuration | no config files changed | N/A |
| 8 | Config Security | Always-on (secrets scan) | 1 informational finding |

### Attack Surface Changes

1. **External data ingestion point**: `importCourseFromDrive()` in `src/lib/courseImport.ts` accepts `DriveFileDescription[]` from the Google Drive API and persists it directly into IndexedDB. This is a new trust boundary — external metadata (fileId, name, mimeType, folderName) enters the application data layer without sanitization.

2. **New data fields on synced tables**: `sourceDriveId` (on `importedCourses`) and `driveFileRef` (on `importedVideos`) are stored through `syncableWrite`, which means these values flow into both IndexedDB and the Supabase sync pipeline. No sanitization in `syncableWrite` or `toSnakeCase` strips string content.

3. **Type model extension**: `CourseSource` union type (`'local' | 'youtube'`) is implicitly extended via `source: undefined` for Drive courses — a type hole that downstream code must handle manually.

### Findings

#### Medium (should fix)

- **`src/lib/courseImport.ts:1203,1217,1212`** (confidence: 78, category: CS2: Client-Side Injection (XSS), autofix: `manual`):
  **Stored XSS pipeline through unsanitized Drive metadata.**
  The `folderName`, `f.name`, `f.fileId`, and `f.mimeType` fields from the Drive API are stored directly into `ImportedCourse.name`, `ImportedVideo.filename`, and `driveFileRef.fileId` without any string sanitization.

  **Exploit scenario:** A user imports a course from a Google Drive folder shared by an attacker. The attacker names a file `<img src=x onerror=alert(document.cookie)>.mp4`. This name is persisted in `importedVideos.filename`. When a future story renders this filename in the UI (e.g., lesson list, course card) without React's auto-escaping — or via `dangerouslySetInnerHTML` — the XSS payload executes. This is especially risky if filename is used in an `alt` attribute, a `title` attribute, or interpolated into a URL.

  **Fix:** Sanitize all Drive-provided strings at the ingestion boundary. Options:
  - Use `DOMPurify.sanitize()` to strip HTML tags from `name` and `folderName`.
  - Validate `fileId` against `/^[a-zA-Z0-9_-]{10,}$/` and reject non-conformant values with a descriptive error.
  - Strip control characters and HTML entity sequences from all string fields before storage.
  - Defense in depth: also sanitize at the rendering boundary when UI components are added in future stories.

- **`src/lib/courseImport.ts:1212`** (confidence: 72, category: CS2: Client-Side Injection (XSS), autofix: `gated_auto`):
  **Drive file ID stored without format validation.**
  Google Drive file IDs are base64-like alphanumeric strings (typically 28+ characters matching `[a-zA-Z0-9_-]+`). The `DriveFileRef.fileId` field accepts any string, including values that could later be used unsafely in URL construction or string interpolation.

  **Exploit scenario:** A future component constructs a streaming URL like `https://www.googleapis.com/drive/v3/files/${driveFileRef.fileId}/export`. If `fileId` contains URL metacharacters (`../`, `#`, `?`), the URL structure could be broken. If `fileId` is used in template interpolation for DOM attributes without escaping, it could inject attributes.

  **Fix:** Add validation in `importCourseFromDrive()`:
  ```typescript
  const FILE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/
  for (const f of files) {
    if (!FILE_ID_RE.test(f.fileId)) {
      throw new Error(`Invalid Drive file ID format: ${f.fileId}`)
    }
  }
  ```

- **`src/lib/courseImport.ts:1226`** (confidence: 85, category: CS5: Client-Side Integrity, autofix: `manual`):
  **CourseSource type inconsistency for Drive-native courses.**
  `CourseSource` is typed as `'local' | 'youtube'`, but Drive courses set `source: undefined`. Any code that switches on `course.source` or checks `if (course.source === 'local')` will silently misclassify Drive courses. This could cause:
  - Broken route guards or conditional rendering for Drive-natives course detail pages
  - Sync logic that applies only to `'local'` or `'youtube'` courses missing Drive courses
  - Backup/restore filters incorrectly excluding Drive courses from export
  - Analytics or reporting that categorizes by source missing Drive courses entirely

  **Fix:** Add `'drive'` to the `CourseSource` type in `src/data/types.ts`:
  ```typescript
  export type CourseSource = 'local' | 'youtube' | 'drive'
  ```
  Then set `source: 'drive'` in the `importCourseFromDrive()` function. TypeScript will then flag any incomplete switch statements or conditional checks that don't handle the `'drive'` variant.

#### Informational (awareness only)

- **`src/lib/courseImport.ts:1164,1197`** (confidence: 60, category: CS5: Client-Side Integrity, autofix: `advisory`):
  **DriveFileDescription trust boundary is caller-enforced.**
  The `DriveFileDescription` interface is exported and can be constructed by any caller. The MIME type detection uses `f.mimeType.startsWith('video/')` which could match crafted strings like `video/mp4; x=`. In practice, real Drive API responses are server-validated, but custom callers could bypass the filter.

  **No immediate fix needed.** Document that `importCourseFromDrive()` trusts its caller to supply valid Drive API data. If the importing UI layer is wired to an untrusted source (e.g., manual fileId entry), add a Drive API metadata verification step.

- **`.mcp.json`** (confidence: 100, category: A05: Security Misconfiguration, autofix: `advisory`):
  **Google API key present in local .mcp.json.**
  A `X-Goog-Api-Key` value is present in the local `.mcp.json` for the Stitch MCP server. The file is confirmed listed in `.gitignore` (line 94) and is NOT tracked by git, so it cannot be committed. No active exposure risk.

### Secrets Scan

**Clean** — no secrets detected in the diff. The secrets scan ran `git diff origin/main...HEAD` and found no API keys, tokens, bearer auth, passwords, or other credentials in the committed code.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS2: Client-Side Injection (XSS) | Yes | Yes | Unsanitized Drive metadata stored in IndexedDB creates a stored XSS pipeline. Two findings: generic string injection and fileId injection. |
| CS5: Client-Side Integrity | Yes | Yes | CourseSource type inconsistency (`source: undefined` for Drive courses) and caller-enforced Drive API trust boundary. |
| CS3: Sensitive Data in Client Storage | Yes | No | Drive file/folder IDs are not sensitive secrets. They're public identifiers in the Drive API and needed for streaming access. |
| CS7: Client-Side Security Logging | Yes | No | No console.log of sensitive data in diff. |
| CS9: Client-Side Communication | No | No | No postMessage or cross-origin communication in this story. |
| A05: Security Misconfiguration | Yes | No | No config changes in diff. Local .mcp.json finding is informational. |

### What's Done Well

1. **No backfill required for optional fields.** The v66 migration correctly uses `.stores({})` with no backfill — Dexie handles missing fields naturally. This avoids unnecessary data churn and reduces migration risk.

2. **syncableWrite integration is intentional.** Using the sync-enabled write path from the start means Drive imports participate in the sync queue immediately, preventing a future migration headache. The sync layer enqueues data correctly even for the new fields.

3. **Clean separation of concerns.** The data layer change is isolated to types, schema, and one function. No UI contamination, no scope creep. This makes the security review straightforward and the attack surface well-bounded.

### False Positives Filtered

- **Test files**: 4 test files reviewed: all use synthetic `crypto.randomUUID()` values for fileIds and folder names. No secrets or real Drive data. Tests pass the trust boundary for this review.
- **`syncableWrite` cast (`as unknown as SyncableRecord`)**: Intentional and documented — the cast is at the call site, not in `syncableWrite` itself. The sync layer is not responsible for content sanitization. No finding.

---
Phases: 4/8 | Findings: 5 total | Blockers: 0 | High: 0 | Medium: 3 | Informational: 2 | False positives filtered: 2
