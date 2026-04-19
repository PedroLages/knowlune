# CE Review — E95-S05 OPDS/ABS Server Connection Sync (R1, headless)

Base: 77212ac5ee626183eeb4ae7fed112660ac273f96
Branch: feature/e95-s05-opds-abs-server-connection-sync
Plan: docs/plans/2026-04-19-015-feat-e95-s05-opds-abs-server-sync-plan.md
Mode: headless (single-pass, no safe_auto fixes needed)

## Scope verified
- 25 ABS apiKey read sites: migrated (grep gate passes locally and in CI)
- Credential resolver library present with factory + cache + telemetry + sign-out invalidation
- One-shot post-boot migration wired in useAuthLifecycle
- Both stores route through syncableWrite; OPDS flattens nested auth to authUsername
- stripFields defense-in-depth in place via tableRegistry.vaultFields + tests
- CI grep gate added to .github/workflows/ci.yml
- RLS inheritance from 20260423000001 untouched (no schema changes to those tables)

## Headline findings
- P0: Migration marks-done prematurely because storeCredential is non-throwing in production
- P2: OPDS/BookContentService still carry plaintext password in Book.source.auth (legacy RemoteAuth)
- P3: validateCatalog / fetchCatalogEntries local auth param still typed with password — OK (not the invariant target) but type name overlap invites confusion
- P3: hasExistingApiKey unused (dead state, explicit `void`)

