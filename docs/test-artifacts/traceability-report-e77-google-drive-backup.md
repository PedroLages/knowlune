---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-29'
epic: 'E77 - Google Drive Backup & Restore'
status: 'pre-implementation'
gateDecision: 'CONCERNS'
---

# Traceability Report: Epic 77 - Google Drive Backup & Restore

**Generated:** 2026-03-29
**Phase:** Pre-implementation (no stories implemented yet)
**Gate Decision:** CONCERNS

## Step 1: Context & Artifacts Loaded

### Artifacts Analyzed

| Artifact | Location | Status |
|----------|----------|--------|
| PRD | `_bmad-output/planning-artifacts/prd-google-drive-backup.md` | Complete (7 user stories, 31 FRs, 16 NFRs) |
| Architecture | `_bmad-output/planning-artifacts/architecture-google-drive-backup.md` | Complete (10 ADRs) |
| Epics & Stories | `_bmad-output/planning-artifacts/epics-google-drive-backup.md` | Complete (7 stories, dependency chain) |
| Adversarial Review | Referenced in epics doc | 14 findings, 2 blockers addressed |
| Existing Export Service | `src/lib/exportService.ts` | Exists (reused by backup) |
| Existing Import Service | `src/lib/importService.ts` | Exists (schema validation, Dexie transactions) |
| Import Service Tests | `src/lib/__tests__/importService.test.ts` | Exists (unit tests) |
| Export Service Tests | `src/lib/__tests__/exportService.test.ts` | Exists (unit tests) |

### Requirements Inventory

- **Functional Requirements:** 31 (FR-1.1 through FR-6.4)
- **Non-Functional Requirements:** 16 (NFR-1 through NFR-16)
- **UX Design Requirements:** 9 (UX-DR1 through UX-DR9)
- **Additional Requirements:** 12 (adversarial fixes, architecture constraints)
- **Stories:** 7 (77.1 through 77.7)

---

## Step 2: Test Discovery & Catalog

### Existing Tests (Pre-Implementation)

No E2E or unit tests exist for Epic 77 features (Google Drive OAuth, backup, restore, scheduled backups, storage management). This is expected -- the epic has not been implemented yet.

**Related existing tests (adjacent functionality):**

| Test File | Level | Relevance |
|-----------|-------|-----------|
| `src/lib/__tests__/exportService.test.ts` | Unit | Tests `exportAllAsJson()` which E77 backup reuses |
| `src/lib/__tests__/importService.test.ts` | Unit | Tests import/validation logic which E77 restore reuses |
| `tests/e2e/nfr67-reimport-fidelity.spec.ts` | E2E | Tests export/reimport roundtrip fidelity |

### Tests To Be Created (Per Story)

| Story | Expected Test Files | Level |
|-------|-------------------|-------|
| 77.1 | `tests/e2e/regression/story-e77-s01.spec.ts` | E2E |
| 77.1 | `src/stores/__tests__/useGoogleDriveStore.test.ts` | Unit |
| 77.2 | `src/services/__tests__/googleDriveService.test.ts` | Unit |
| 77.3 | `src/services/__tests__/googleDriveBackupService.test.ts` | Unit |
| 77.3 | `tests/e2e/regression/story-e77-s03.spec.ts` | E2E |
| 77.4 | `src/lib/__tests__/importService.test.ts` (extend) | Unit |
| 77.5 | `tests/e2e/regression/story-e77-s05.spec.ts` | E2E |
| 77.6 | `tests/e2e/regression/story-e77-s06.spec.ts` | E2E |
| 77.7 | `tests/e2e/regression/story-e77-s07.spec.ts` | E2E |

### Coverage Heuristics Inventory

**API Endpoint Coverage:**
- 8 Drive API endpoints referenced (create folder, multipart upload, resumable upload init, resumable upload put, list files, download, delete, get quota)
- All require mocking in tests (external API)
- No tests exist yet

**Authentication/Authorization Coverage:**
- OAuth token flow (GIS `requestAccessToken`)
- Token expiry detection (401 handling)
- Premium entitlement gating (UI + service-layer `assertPremium()`)
- Disconnect/revoke flow
- No negative-path tests exist yet

**Error-Path Coverage:**
- 401 token expiry, 403 quota exceeded, 403 permission denied, 5xx server errors, network errors
- Pre-upload quota check, schema version mismatch, migration failure, Dexie transaction rollback
- No error-path tests exist yet

---

## Step 3: Requirements-to-Tests Traceability Matrix

### Functional Requirements Matrix

| Req ID | Requirement | Story | Priority | Coverage | Tests | Error Path | Notes |
|--------|-------------|-------|----------|----------|-------|------------|-------|
| FR-1.1 | GIS OAuth with `drive.file` scope | 77.1 | P0 | NONE | -- | -- | Security-critical: token handling |
| FR-1.2 | Token stored in memory only | 77.1 | P0 | NONE | -- | -- | Security: must verify no persistence |
| FR-1.3 | Token expiry detection + re-auth | 77.1 | P1 | NONE | -- | -- | Error path: 401 handling |
| FR-1.4 | Disconnect/revoke consent | 77.1 | P1 | NONE | -- | -- | Cleanup: clear token + cache |
| FR-1.5 | Independent from Supabase auth | 77.1 | P2 | NONE | -- | -- | Architecture constraint |
| FR-1.6 | GIS via CDN script tag | 77.1 | P2 | NONE | -- | -- | Infrastructure |
| FR-2.1 | Export via `exportAllAsJson()` | 77.3 | P0 | PARTIAL | `exportService.test.ts` | -- | Existing tests cover export; Drive upload not tested |
| FR-2.2 | Upload as timestamped `.knowlune.json` | 77.3 | P0 | NONE | -- | -- | File naming + folder path |
| FR-2.3 | Multipart <5 MB, resumable >=5 MB | 77.3 | P1 | NONE | -- | -- | Upload strategy selection |
| FR-2.4 | Auto-create folder structure | 77.2 | P1 | NONE | -- | -- | `ensureBackupsFolder()` |
| FR-2.5 | Pre-upload quota check | 77.3 | P1 | NONE | -- | Needed | Error path: quota full |
| FR-2.6 | Progress reporting (3 phases) | 77.3 | P2 | NONE | -- | -- | UX: progress callback |
| FR-2.7 | Auto-prune >10 backups | 77.3 | P2 | NONE | -- | -- | Silent pruning |
| FR-3.1 | List `.knowlune.json` with metadata | 77.5 | P1 | NONE | -- | -- | Drive API list query |
| FR-3.2 | Download + parse backup JSON | 77.5 | P1 | NONE | -- | -- | Download flow |
| FR-3.3 | Schema version validation (reject future) | 77.4 | P0 | PARTIAL | `importService.test.ts` | -- | Existing import tests may cover this |
| FR-3.4 | Schema migration chain | 77.4 | P0 | PARTIAL | `importService.test.ts` | -- | Existing import tests may cover this |
| FR-3.5 | Dexie transaction restore (atomic) | 77.4 | P0 | PARTIAL | `importService.test.ts` | Needed | Existing tests; rollback testing needed |
| FR-3.6 | Conflict resolution options | 77.5 | P1 | NONE | -- | -- | RestoreConfirmationDialog |
| FR-3.7 | Refresh app state after restore | 77.5 | P1 | NONE | -- | -- | Zustand store refresh |
| FR-4.1 | Schedule: Off/Daily/Weekly | 77.6 | P2 | NONE | -- | -- | Schedule selector |
| FR-4.2 | Persist schedule in IndexedDB | 77.6 | P2 | NONE | -- | -- | Settings persistence |
| FR-4.3 | Service Worker alarm trigger | 77.6 | P1 | NONE | -- | -- | Background sync |
| FR-4.4 | Failed scheduled backup notification | 77.6 | P2 | NONE | -- | Needed | Error notification |
| FR-4.5 | Last backup timestamp display | 77.6 | P2 | NONE | -- | -- | UI display |
| FR-5.1 | Premium entitlement check | 77.1 | P0 | NONE | -- | Needed | Gate: UI + service `assertPremium()` |
| FR-5.2 | Free user locked state | 77.1 | P0 | NONE | -- | -- | Premium gate overlay |
| FR-5.3 | Handle entitlement downgrade | 77.1 | P1 | NONE | -- | -- | Graceful degradation |
| FR-6.1 | Drive storage usage display | 77.7 | P2 | NONE | -- | -- | `about.get()` API |
| FR-6.2 | Knowlune backup size display | 77.7 | P2 | NONE | -- | -- | Calculated from list |
| FR-6.3 | Delete individual backups | 77.7 | P1 | NONE | -- | -- | Drive delete API |
| FR-6.4 | >90% storage warning | 77.7 | P2 | NONE | -- | -- | Warning indicator |

### Non-Functional Requirements Matrix

| Req ID | Requirement | Story | Priority | Coverage | Notes |
|--------|-------------|-------|----------|----------|-------|
| NFR-1 | Backup <30s for <2 MB | 77.3 | P1 | NONE | Performance benchmark needed |
| NFR-2 | Restore <20s for typical size | 77.5 | P1 | NONE | Performance benchmark needed |
| NFR-3 | Folder ID caching | 77.2 | P2 | NONE | Unit test: cache hit/miss |
| NFR-4 | Token in memory only | 77.1 | P0 | NONE | Security: verify no localStorage |
| NFR-5 | No refresh tokens (implicit flow) | 77.1 | P2 | NONE | Architecture constraint |
| NFR-6 | No auth credentials in backup | 77.3 | P0 | PARTIAL | `exportService.test.ts` may cover |
| NFR-7 | `drive.file` scope only | 77.1 | P0 | NONE | OAuth scope verification |
| NFR-8 | Client ID as env var | 77.1 | P2 | NONE | Config check |
| NFR-9 | Retry with exponential backoff | 77.2 | P1 | NONE | Unit test: `withRetry()` |
| NFR-10 | 4xx fail immediately | 77.2 | P1 | NONE | Unit test: no retry on auth/quota |
| NFR-11 | Dexie transactions for restore | 77.4 | P0 | PARTIAL | `importService.test.ts` exists |
| NFR-12 | Scheduled failures non-blocking | 77.6 | P2 | NONE | App stability |
| NFR-13 | WCAG 2.1 AA | All UI | P1 | NONE | Accessibility audit needed |
| NFR-14 | ARIA live regions for progress | 77.3, 77.5 | P1 | NONE | Screen reader testing |
| NFR-15 | Workspace 403 guidance | 77.2 | P2 | NONE | Error message testing |
| NFR-16 | GIS CDN failure graceful degradation | 77.1 | P1 | NONE | Fallback state |

### UX Design Requirements Matrix

| Req ID | Requirement | Story | Priority | Coverage |
|--------|-------------|-------|----------|----------|
| UX-DR1 | 5-state machine card | 77.1 | P1 | NONE |
| UX-DR2 | PremiumGateOverlay | 77.1 | P0 | NONE |
| UX-DR3 | DisconnectedState panel | 77.1 | P1 | NONE |
| UX-DR4 | ConnectionStatusBar | 77.1 | P1 | NONE |
| UX-DR5 | BackupSettingsSection | 77.6 | P1 | NONE |
| UX-DR6 | StorageUsageBar | 77.7 | P2 | NONE |
| UX-DR7 | BackupHistorySection | 77.5 | P1 | NONE |
| UX-DR8 | RestoreConfirmationDialog | 77.5 | P0 | NONE |
| UX-DR9 | DeleteBackupDialog | 77.5 | P2 | NONE |

### Adversarial Blocker Resolution Matrix

| Blocker | Requirement | Story | Priority | Coverage | Notes |
|---------|-------------|-------|----------|----------|-------|
| #1: Pre-restore safety backup | Safety backup checkbox in RestoreConfirmationDialog | 77.5 | P0 | NONE | Must test safety backup creation before destructive restore |
| #2: Service-layer premium guard | `assertPremium()` in `backupToDrive()` and `restoreFromDrive()` | 77.1, 77.3, 77.5 | P0 | NONE | Must test `PremiumRequiredError` thrown for non-premium |

---

## Step 4: Gap Analysis & Coverage Statistics

### Coverage Statistics

- **Total Requirements:** 59 (31 FR + 16 NFR + 9 UX-DR + 2 Adversarial Blockers + 1 additional)
- **Fully Covered:** 0 (0%)
- **Partially Covered:** 5 (8.5%) -- existing `importService.test.ts` and `exportService.test.ts` provide partial coverage for FR-2.1, FR-3.3, FR-3.4, FR-3.5, NFR-6, NFR-11
- **Uncovered:** 54 (91.5%)
- **Overall Coverage:** 0% (FULL only)

### Priority Breakdown

| Priority | Total | Covered (FULL) | Percentage |
|----------|-------|----------------|------------|
| P0 | 14 | 0 | 0% |
| P1 | 22 | 0 | 0% |
| P2 | 23 | 0 | 0% |
| P3 | 0 | 0 | N/A |

### Gap Analysis

**Critical Gaps (P0) -- 14 requirements:**

| Req ID | Requirement | Story | Risk |
|--------|-------------|-------|------|
| FR-1.1 | GIS OAuth with `drive.file` scope | 77.1 | Security: incorrect scope grants excessive access |
| FR-1.2 | Token in memory only | 77.1 | Security: persistent tokens are XSS targets |
| FR-2.1 | Export via `exportAllAsJson()` | 77.3 | Data integrity: wrong data backed up |
| FR-2.2 | Upload as timestamped file | 77.3 | Data loss: file naming collision |
| FR-3.3 | Schema version validation | 77.4 | Data corruption: importing incompatible data |
| FR-3.4 | Schema migration chain | 77.4 | Data corruption: failed migration |
| FR-3.5 | Dexie transaction atomicity | 77.4 | Data loss: partial restore |
| FR-5.1 | Premium entitlement check | 77.1 | Revenue: free users bypass gate |
| FR-5.2 | Free user locked state | 77.1 | Revenue: premium feature leakage |
| NFR-4 | Token in memory only (security) | 77.1 | Security: token persistence |
| NFR-6 | No auth creds in backup | 77.3 | Security: credential exposure |
| NFR-7 | `drive.file` scope only | 77.1 | Security: scope creep |
| NFR-11 | Dexie transaction restore | 77.4 | Data integrity: partial writes |
| Adversarial #1 | Pre-restore safety backup | 77.5 | Data loss: destructive restore without safety net |
| Adversarial #2 | Service-layer `assertPremium()` | 77.1 | Revenue: API-level premium bypass |

**High Gaps (P1) -- 22 requirements:**

All P1 requirements are uncovered. Key concerns:
- FR-1.3: Token expiry handling (user disruption)
- FR-2.3: Upload strategy selection (large backup failure)
- FR-2.5: Quota check (failed backup without warning)
- FR-3.1, FR-3.2: Backup listing and download (restore impossible)
- FR-4.3: Service Worker scheduled backup (automation failure)
- NFR-9, NFR-10: Retry logic (silent failures)
- NFR-13, NFR-14: Accessibility (WCAG compliance)
- NFR-16: GIS CDN failure (feature unavailable without explanation)

### Coverage Heuristics Gaps

| Heuristic | Gaps Found | Details |
|-----------|-----------|---------|
| API endpoint coverage | 8 endpoints | All 8 Drive API endpoints have no tests |
| Auth negative-path | 3 gaps | No tests for: token expiry (401), revoked access (403), premium bypass |
| Happy-path-only criteria | 7 gaps | FR-2.5 (quota full), FR-3.3 (schema mismatch), FR-3.5 (rollback), FR-4.4 (scheduled failure), NFR-15 (Workspace 403), NFR-16 (GIS CDN fail), Adversarial #1 (safety backup) |

### Recommendations

| Priority | Action | Requirements |
|----------|--------|-------------|
| URGENT | Write ATDD tests for 14 P0 requirements during implementation | FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-3.3, FR-3.4, FR-3.5, FR-5.1, FR-5.2, NFR-4, NFR-6, NFR-7, NFR-11, Adversarial #1, #2 |
| HIGH | Write tests for 22 P1 requirements covering core journeys | FR-1.3, FR-1.4, FR-2.3-FR-2.5, FR-3.1-FR-3.2, FR-3.6-FR-3.7, FR-4.3, FR-5.3, FR-6.3, NFR-1, NFR-2, NFR-9, NFR-10, NFR-13, NFR-14, NFR-16, UX-DR1-4, UX-DR5, UX-DR7-8 |
| HIGH | Add negative-path auth tests for 3 gap areas | Token expiry (401), revoked access (403), premium entitlement bypass |
| HIGH | Add API endpoint tests for all 8 Drive API endpoints | Create folder, upload (multipart + resumable), list, download, delete, quota |
| MEDIUM | Add error/edge scenario tests for 7 happy-path-only criteria | Quota full, schema mismatch, rollback, scheduled failure, Workspace 403, GIS CDN fail, safety backup |
| MEDIUM | Complete coverage for 23 P2 requirements | FR-1.5, FR-1.6, FR-2.6, FR-2.7, FR-4.1, FR-4.2, FR-4.4, FR-4.5, FR-6.1, FR-6.2, FR-6.4, NFR-3, NFR-5, NFR-8, NFR-12, NFR-15, UX-DR6, UX-DR9 |
| LOW | Run test quality review after implementation | All |

### Test Strategy Recommendations Per Story

**Story 77.1 (OAuth + Premium Gate):**
- Unit: `useGoogleDriveStore` state transitions, `assertPremium()` guard
- E2E: Premium gate visible for free users, connect/disconnect flow (mock GIS), token expiry state transition
- Negative: Non-premium user cannot trigger backup/restore at service layer

**Story 77.2 (Drive Service Layer):**
- Unit: `driveRequest()` error mapping, `withRetry()` backoff logic, folder auto-creation, cache invalidation on reconnect
- Unit: 204 No Content handling, `response.text()` for downloads
- Negative: 401 clears token (no retry), 403 quota/permission errors, 5xx retries with backoff

**Story 77.3 (Manual Backup):**
- Unit: `backupToDrive()` orchestration, multipart vs resumable selection, post-upload size verification, auto-prune
- E2E: One-tap backup flow (mock Drive API), progress phases, quota full error, success toast
- Negative: Token expiry mid-upload, network failure after retries

**Story 77.4 (Import Service):**
- Unit: Schema migration chain, version validation (reject future), post-migration record count validation, Dexie transaction rollback
- Extend existing `importService.test.ts` with new migration scenarios

**Story 77.5 (Restore + History):**
- E2E: Backup list sorted newest first, restore with safety backup, restore without safety backup, schema mismatch error, delete backup
- Negative: Restore failure + rollback, future schema version rejection
- Critical: Safety backup checkbox behavior (Adversarial Blocker #1)

**Story 77.6 (Scheduled Backups):**
- Unit: Schedule persistence in IndexedDB, interval fallback when Periodic Background Sync unavailable
- E2E: Toggle auto-backup, frequency selection, last backup timestamp, schedule disabled on disconnect
- Negative: Scheduled backup failure notification, token expired during scheduled backup

**Story 77.7 (Storage Management):**
- E2E: Storage bar display, color transitions at >80% and >95%, Knowlune backup size, unlimited Workspace handling
- Negative: >90% storage warning, backup deletion refreshes storage

---

## Step 5: Gate Decision

### Gate Decision: CONCERNS

**Rationale:** This is a pre-implementation traceability report. All 59 requirements are mapped to 7 stories with clear test strategy recommendations. The existing `importService.ts` and `exportService.ts` with their unit tests provide a solid foundation for FR-3.3, FR-3.4, FR-3.5, and NFR-11 (partial coverage). However, 0% of requirements have FULL test coverage since the epic has not been implemented yet.

### Gate Criteria Evaluation

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 0% (pre-implementation) | NOT MET |
| P1 Coverage (PASS target) | 90% | 0% (pre-implementation) | NOT MET |
| P1 Coverage (minimum) | 80% | 0% (pre-implementation) | NOT MET |
| Overall Coverage (minimum) | 80% | 0% (pre-implementation) | NOT MET |

### Context: Pre-Implementation Assessment

This gate decision is **CONCERNS** (not FAIL) because:

1. **Complete requirements mapping exists** -- All 31 FRs, 16 NFRs, 9 UX-DRs, and 2 adversarial blockers are mapped to specific stories
2. **No orphaned requirements** -- Every requirement has a clear story assignment and test strategy
3. **Existing foundation** -- `importService.ts` and `exportService.ts` already exist with unit tests, covering the data integrity core (FR-3.x, NFR-11)
4. **Adversarial blockers addressed** -- Both blockers (#1 pre-restore safety backup, #2 service-layer premium guard) are explicitly called out in story acceptance criteria
5. **This is expected** -- Tests will be written during story implementation per the `/start-story` workflow

### Blocking Risks

| Risk | Severity | Story | Mitigation |
|------|----------|-------|------------|
| Token security (memory-only storage) | P0 | 77.1 | Unit test must verify no localStorage/cookie/IDB writes |
| Premium bypass at service layer | P0 | 77.1 | Unit test: `assertPremium()` throws `PremiumRequiredError` |
| Data loss during restore | P0 | 77.4, 77.5 | Dexie transaction rollback + safety backup flow |
| Schema corruption on migration | P0 | 77.4 | Post-migration validation (record counts, field presence) |

### Recommended Actions

1. **During implementation:** Each story MUST include tests for its P0 requirements before marking complete
2. **Story 77.1:** Prioritize security tests -- token storage verification and `assertPremium()` guard
3. **Story 77.4:** Extend existing `importService.test.ts` with migration chain and rollback scenarios
4. **Story 77.5:** Test safety backup flow (Adversarial Blocker #1) as acceptance gate
5. **After all stories:** Re-run `/testarch-trace` to verify coverage reaches PASS thresholds (P0: 100%, P1: 90%+, overall: 80%+)

### FR Coverage Verification (Complete)

All 31 functional requirements are mapped:
- FR-1.x (6 FRs): Story 77.1
- FR-2.x (7 FRs): Stories 77.2, 77.3
- FR-3.x (7 FRs): Stories 77.4, 77.5
- FR-4.x (5 FRs): Story 77.6
- FR-5.x (3 FRs): Story 77.1
- FR-6.x (4 FRs): Story 77.7

No gaps in requirement-to-story mapping. No orphaned requirements.

### NFR Coverage Verification (Complete)

All 16 NFRs are mapped:
- Security (NFR-4,5,6,7,8): Story 77.1
- Performance (NFR-1,2): Stories 77.3, 77.5
- Reliability (NFR-9,10,11,12): Stories 77.2, 77.4, 77.6
- Accessibility (NFR-13,14): All UI stories
- Compatibility (NFR-15,16): Stories 77.1, 77.2
- Caching (NFR-3): Story 77.2

### Dependency Chain Verification

```
Story 77.1 (OAuth + Premium Gate)     <- standalone
Story 77.2 (Drive Service)            <- depends on 77.1
Story 77.3 (Manual Backup)            <- depends on 77.1, 77.2
Story 77.4 (Import Service)           <- standalone (parallel with 77.2/77.3)
Story 77.5 (Restore + History)        <- depends on 77.2, 77.4
Story 77.6 (Scheduled Backups)        <- depends on 77.3
Story 77.7 (Storage Management)       <- depends on 77.2
```

No circular dependencies. Story 77.4 can run in parallel with 77.2/77.3 for faster delivery.
