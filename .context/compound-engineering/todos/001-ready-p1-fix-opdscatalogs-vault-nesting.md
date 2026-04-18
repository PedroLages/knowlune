---
status: ready
priority: p1
issue_id: "001"
tags: [e92-s03, sync, security, registry, vault]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix opdsCatalogs vaultFields nesting — plaintext password leak to Supabase

## Problem Statement

`opdsCatalogs.vaultFields: ['password']` targets a **phantom top-level key**. The actual Dexie record stores credentials as `auth: { username: string, password: string }` (nested). `fieldMapper.toSnakeCase` checks `strip.has(key)` against `Object.keys(record)`, where the top-level key is `'auth'`. `strip.has('auth')` is `false`, so the entire `auth` object (including plaintext password) passes through and uploads to Supabase.

This is a **security issue** — OPDS Basic Auth credentials would ship to the server in plaintext on every OPDS catalog sync. E95 Vault writes would never see the credential because the upload already leaked it.

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts:644-649` (opdsCatalogs entry)
- **Surfaced by:** data-migrations reviewer (DM-007, confidence 0.95)
- **Runtime evidence:** `OpdsCatalog` type (src/data/types.ts) confirms `auth` is a nested object
- **Test gap:** current vault-field test only uses a fixture with `password` as top-level key (fieldMapper.test.ts:87-102), which does not reflect the real shape
- **Related:** `audiobookshelfServers.vaultFields: ['apiKey']` needs verification — ABS API keys may also be nested. See residual risk RR-001 in data-migrations.json.

## Proposed Solutions

### Option 1: Strip the entire `auth` object

**Approach:** Change `vaultFields: ['password']` to `vaultFields: ['auth']`. The whole auth object (username + password) is excluded from upload; E95 Vault writes extract `auth.username` and `auth.password` separately before upload and re-inject on download.

**Pros:**
- Minimal registry change
- Keeps credentials atomic (username + password travel together or not at all)
- Correct semantics: the vault is the source of truth for the whole credential unit

**Cons:**
- Loses the Dexie-local `auth.username` display on other devices until Vault reads complete
- E95 Vault writes must be aware of the nested shape

**Effort:** 1 hour (registry + one test update)
**Risk:** Low

---

### Option 2: Flatten OpdsCatalog.auth in Dexie schema

**Approach:** Change the Dexie type from `auth: {username, password}` to top-level `authUsername, authPassword`. Then `vaultFields: ['authPassword']` works as originally written.

**Pros:**
- fieldMapper's flat-key model works unchanged
- Simpler for future audits

**Cons:**
- Requires a Dexie migration (consumes the next version number)
- Data migration for existing users' OPDS catalogs
- Out of scope for E92-S03

**Effort:** 4 hours + migration
**Risk:** Medium

---

### Option 3: Extend fieldMapper to support nested-path strip

**Approach:** Change `vaultFields` from `readonly string[]` to `readonly string[]` with dot-path support (`['auth.password']`). Update fieldMapper to walk nested paths.

**Pros:**
- Fine-grained (only password stripped, username still uploads)

**Cons:**
- Complicates fieldMapper's simple key-renaming model
- Enables future over-abstraction
- Most credentials are atomic units anyway — username without password has little use

**Effort:** 3 hours
**Risk:** Medium (changes the mapper contract)

## Recommended Action

**Option 1.** Change `vaultFields: ['password']` → `vaultFields: ['auth']` on opdsCatalogs. Audit `audiobookshelfServers.apiKey` — confirm shape (is `apiKey` top-level or nested?). Add a registry invariant test: for each `vaultField`, assert the key is reachable as a top-level property on a factory-produced sample record of that table (or document the field is nested and needs Option 3 treatment).

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:644-649` — registry entry
- `src/data/types.ts` — OpdsCatalog type (verify shape)
- `src/lib/sync/__tests__/fieldMapper.test.ts:87-108` — strip-vault-fields test
- `src/lib/sync/tableRegistry.ts:570-590` — audiobookshelfServers entry (audit)

**Related components:**
- E95 (Supabase Vault integration) — must read full `auth` object and write back on download
- E92-S05 upload phase — will read the transformed record with `auth` absent

**Database changes:** None (registry-only change).

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding ID:** DM-007 in `data-migrations.json`
- **Adversarial residual:** RR-001 (audiobookshelfServers session tokens beyond apiKey?)

## Acceptance Criteria

- [ ] `opdsCatalogs.vaultFields` changed to `['auth']`
- [ ] `audiobookshelfServers.apiKey` shape verified (if nested, fix; if top-level, document)
- [ ] New registry invariant test: `vaultFields` entries map to properties actually present on a factory-produced record
- [ ] Existing fieldMapper vault-strip test updated to use realistic nested fixture for opdsCatalogs
- [ ] `npm run test:unit` passes on `src/lib/sync/**`
- [ ] Review pass confirms no plaintext credential in toSnakeCase output

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 10-reviewer parallel dispatch identified vault-field nesting bug
- Confirmed against `src/data/types.ts` OpdsCatalog shape
- Filed as P1 (security), routed to downstream-resolver

**Learnings:**
- fieldMapper's flat-key model leaks nested credentials silently
- Test fixtures must mirror real Dexie record shapes, not fieldMap keys
