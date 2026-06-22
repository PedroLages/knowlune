## Test Coverage Review: E77-S02 — Google Drive Service Layer

### AC Coverage Summary

**Acceptance Criteria Coverage:** 0/9 ACs tested (**0%**)

**COVERAGE GATE:** BLOCKER (<60%)

The 9 story ACs describe a full Google Drive service layer (folder management, retry logic, error mapping, account switching). This PR implements only the foundational infrastructure needed to support those ACs: a token helper (`src/lib/googleDriveToken.ts`) and OAuth scope parameters on `signInWithGoogle()`. The AC behaviors themselves have not been implemented yet, so no AC maps to a test of the described behavior.

**Important context:** The commit message uses "E77a-S02" indicating this is a scoped subset of the story focused on auth/token infrastructure. The full Drive service layer (driveRequest, withRetry, error classes, folder management) is not present in this PR.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Create Knowlune/ folder on first Drive operation, cache folderId in store | None | None | Gap |
| 2 | Create backups/ subfolder, cache folderId in store | None | None | Gap |
| 3 | withRetry() exponential backoff (1s, 2s, 4s, 3 retries, jitter) | None | None | Gap |
| 4 | 401 -> DriveAuthError thrown immediately (no retry) | None | None | Gap |
| 5 | 403 storageQuotaExceeded -> DriveQuotaError thrown | None | None | Gap |
| 6 | 403 without quota -> DrivePermissionError thrown | None | None | Gap |
| 7 | 204 No Content -> return undefined without response.json() | None | None | Gap |
| 8 | alt=media download -> use response.text() instead of response.json() | None | None | Gap |
| 9 | Reconnect with different account clears cached folder IDs | None | None | Gap |

**Coverage**: 0/9 ACs fully covered | 9 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 100)** The story E77-S02 defines 9 acceptance criteria covering a Google Drive service layer (folder creation, error mapping, retry logic, HTTP response handling, account switching). None of these behaviors are implemented or tested in this PR. The implemented code (`getDriveToken`, `refreshDriveToken`, OAuth scope params) is foundational infrastructure, but does not implement any of the described ACs. This is a scope gap, not a test gap per se. Resolution path: either reduce the story ACs to match the current scope, or implement the remaining ACs in subsequent commits within this story branch.

#### High Priority

- **(confidence: 95)** `AC 4,5,6` reference error classes (`DriveAuthError`, `DriveQuotaError`, `DrivePermissionError`) and token clearing behavior that do not exist yet (`src/services/errors/driveErrors.ts` and `useGoogleDriveStore.clearToken()` are missing). Even the optional 401 recovery path in `getDriveToken()`'s JSDoc says "caller should re-invoke this function after handling the error" but no error-handling layer exists to do that. Suggested: implement the error classes and `driveRequest()` error handling, or narrow the story's ACs to exclude these until the service layer is built.

- **(confidence: 80)** `AC 9` requires `clearToken()` in a Google Drive store to also clear `knowluneFolderId` and `backupsFolderId`. Neither the store (`useGoogleDriveStore`) nor any folder-ID cache exists yet. If the story intends AC 9 to be delivered incrementally, the AC should be marked as deferred.

#### Medium

- **(confidence: 70)** `src/lib/__tests__/googleDriveToken.test.ts` line 42: The test for null supabase in `getDriveToken` uses `mockSupabaseValue.mockReturnValue(null as never)`. The `as never` cast suppresses the type error, but this test passes for a different reason than expected. When `mockSupabaseValue()` returns `null`, the implementation's `if (!supabase) return null` fires correctly. However, the test name "returns null when supabase is not configured" is accurate but the `as never` pattern should be documented if there is a known TypeScript limitation.

- **(confidence: 70)** `src/lib/googleDriveToken.ts`: The `getDriveToken` and `refreshDriveToken` functions call `await supabase.auth.refreshSession()` without a try-catch. If the Supabase SDK throws (rather than returning an error object), this would produce an unhandled promise rejection. While the tests use `mockResolvedValue` (never mockRejectedValue), the real Supabase SDK could throw on network failures. Suggested: add a try-catch wrapper that returns `null` on unexpected exceptions, consistent with the error-handling pattern used in `useAuthStore.ts`'s `handleAuthException`.

#### Nits

- **Nit** `src/lib/__tests__/googleDriveToken.test.ts` line 106: The `describe('refreshDriveToken')` block starts without resetting the `mockSupabaseValue` default, relying on the `beforeEach` at the top level. This works correctly but is less explicit than having a `beforeEach` inside the nested `describe`. Consider adding a nested `beforeEach` for clarity (test-cleanup rule: each describe should be self-documenting).

### Edge Cases to Consider

1. **Race condition on concurrent token requests**: If `getDriveToken()` is called simultaneously from multiple callers (e.g., parallel Drive API operations), each call independently checks `session.provider_token` and may trigger duplicate `refreshSession()` calls. No test or guard (e.g., in-flight-token promise cache) exists. This is unlikely in practice but worth noting.

2. **Exception from `supabase.auth.refreshSession()`**: Both `getDriveToken()` and `refreshDriveToken()` assume `refreshSession()` returns a promise that resolves to `{ data, error }`. If the function throws (network timeout, SDK bug), the error propagates as an unhandled rejection. The token helper tests never mock a rejecting promise. Consider adding tests for `mockRejectedValue` scenarios.

3. **No `signOut()`-gated token invalidation**: When `signOut()` is called, the provider_token in the Zustand session is cleared, but there is no test that `getDriveToken()` returns `null` after sign-out. This would naturally happen (session is null, so `getDriveToken` returns null), but an explicit test would guard against regressions.

---
ACs: 0 covered / 9 total | Findings: 5 total | Blockers: 1 | High: 2 | Medium: 2 | Nits: 1
