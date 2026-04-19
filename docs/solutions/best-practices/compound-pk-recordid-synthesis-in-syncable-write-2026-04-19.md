---
title: "Compound-PK recordId synthesis in syncableWrite — unit separator over delimiter chars"
date: 2026-04-19
category: docs/solutions/best-practices/
module: sync
problem_type: best_practice
component: database
severity: medium
applies_when:
  - Registering a new Dexie-synced table whose logical PK is a compound of two or more fields
  - Enqueueing a row to `syncQueue` for upload via the sync engine
  - Declaring `compoundPkFields` in `src/lib/sync/tableRegistry.ts`
tags: [sync, dexie, compound-pk, syncable-write, unit-separator, sync-queue, table-registry]
---

# Compound-PK recordId synthesis in syncableWrite — unit separator over delimiter chars

## Context

`syncableWrite(tableName, op, record)` needs a single `recordId` string to populate `syncQueue.recordId`, which is used both for `_coalesceQueue` deduplication (when multiple writes to the same row are pending upload) and for debug inspection. For single-PK tables, `record.id` is that string. For compound-PK tables (`progress`, `contentProgress`, `chapterMappings`), there is no single field that uniquely identifies the row — the PK is an array of fields like `[courseId, videoId]` or `[epubBookId, audioBookId]`.

Before PR #361 (post-E93 cleanup), compound-PK tables either threw on empty `record.id` or silently enqueued entries with `recordId = ''`, which broke coalescing and caused `recordId=''` entries to linger in the queue. The fix: synthesize a stable, collision-safe `recordId` from the compound fields.

## Guidance

### Declare `compoundPkFields` in the registry

```typescript
// src/lib/sync/tableRegistry.ts
const progress: TableRegistryEntry = {
  dexieTable: 'progress',
  supabaseTable: 'video_progress',
  conflictStrategy: 'monotonic',
  priority: 0,
  fieldMap: {},
  monotonicFields: ['watchedSeconds'],
  compoundPkFields: ['courseId', 'videoId'],
}
```

The Dexie schema may declare a different primary key (e.g. `EntityTable<VideoProgress, 'courseId'>`) for historical reasons. `compoundPkFields` is the authoritative sync-layer declaration and is consumed by both the upload path (recordId synthesis in `syncableWrite`) and the download path (compound-key lookup in `_getLocalRecord`).

### Synthesize with `\u001f` (ASCII unit separator), not `:` or `/`

```typescript
// src/lib/sync/syncableWrite.ts (lines 110-127)
} else if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
  const parts = entry.compoundPkFields.map((field) => {
    const value = rec?.[field]
    return typeof value === 'string' || typeof value === 'number'
      ? String(value) : ''
  })
  if (parts.some((p) => p.trim() === '')) {
    throw new Error(/* empty recordId */)
  }
  // Unit separator (U+001F) — guaranteed not to appear in user-supplied IDs
  // (URIs, slugs, UUIDs). Joining on ':' would let `urn:isbn:123` collide
  // with split-elsewhere variants.
  recordId = parts.join('\u001f')
}
```

**Why `\u001f`:** User-supplied ids can legitimately contain `:` (`urn:isbn:9780262046305`), `/` (paths), `-` (UUIDs), `#` (fragments). Any printable ASCII delimiter risks collision — `['urn:isbn', '9780262046305'].join(':') === 'urn:isbn:9780262046305'`, which is indistinguishable from the single-value `'urn:isbn:9780262046305'`. ASCII 0x1F (unit separator) is a control character that cannot appear in URIs, slugs, or UUIDs, making the join provably bijective.

### The download path must match

`syncEngine._getLocalRecord` applies the same join when looking up a local row by compound key:

```typescript
// src/lib/sync/syncEngine.ts
const compoundFields = tableEntry?.compoundPkFields
const keyValues = entry.compoundPkFields.map((f) => record[f])
await db.table(tableName).where(entry.compoundPkFields).equals(keyValues).first()
// When needing to rebuild recordId from fields: parts.join('\u001f')
```

Any code path that derives a recordId from field values must use the same separator — drift between upload-side and download-side synthesis silently breaks coalescing.

### Guard against empty/whitespace field values

Each compound field value must be a non-empty string or number. If any part is missing or whitespace-only, throw — do not enqueue an entry with a partial recordId that silently collides with a different row whose missing field is in a different position.

### One-shot legacy backfill in `_coalesceQueue`

If the codebase already has pre-fix entries in `syncQueue` with `recordId = ''`, the coalescer needs a one-shot backfill that reconstructs the recordId from the payload's compound fields. Otherwise those entries either never coalesce (uploading N times) or get force-merged against unrelated rows. See `src/lib/sync/syncEngine.ts` for the backfill implementation gated on a `pre-d220cb7d` marker.

## Why This Matters

- **`syncQueue` coalescing correctness.** Two pending writes to the same compound-PK row must collapse into one upload. Without a stable recordId, they stay as two entries and the later upload's payload never reaches the server if the earlier one fails.
- **Upload/download symmetry.** The sync engine uses `recordId` as the canonical logical identifier for diagnostics, conflict detection, and replay. Synthesizing it identically in both directions keeps those observables aligned.
- **Collision-safety without quoting.** User-supplied ids change shape across the app (URIs, UUIDs, slugs, free-form tags). A delimiter strategy that requires escaping — `"a:b".replace(':', '\\:')` — adds an escape/unescape contract to every consumer. `\u001f` is collision-safe by construction because Unicode guarantees it cannot appear in the inputs.

## When to Apply

- Registering any new synced table whose logical PK is 2+ fields
- Writing a new call site that derives a recordId from field values for sync queue inspection, debug logs, or manual replay tools

## When Not to Apply

- Single-PK tables — continue to use `record.id` directly; `compoundPkFields` is optional on `TableRegistryEntry`.
- Ephemeral display strings that are never written to `syncQueue.recordId` or compared with one. Use a human-readable delimiter (`:` or `/`) for those — `\u001f` is for machine-internal keys only.

## Examples

**Registered compound-PK tables (as of post-E93):**

| Table | compoundPkFields |
|-------|------------------|
| `progress` | `['courseId', 'videoId']` |
| `contentProgress` | `['courseId', 'itemId']` |
| `chapterMappings` | `['epubBookId', 'audioBookId']` |

**Tests asserting the synthesis contract:** `src/lib/sync/__tests__/syncableWrite.test.ts` (lines 415, 447) and `src/lib/sync/__tests__/syncEngine.test.ts` (lines 857-920).

## Related

- **Code:** `src/lib/sync/syncableWrite.ts:95-137` — synthesis implementation.
- **Code:** `src/lib/sync/syncEngine.ts:209-243, 518-540` — download-side compound-key lookup that must stay in lockstep.
- **Code:** `src/lib/sync/tableRegistry.ts:57` — `compoundPkFields?: string[]` field definition.
- **Case study:** PR #361 post-E93 cleanup; R1-PE-01 from E92-S02 was the original pre-existing finding that surfaced the `progress` table's missing `compoundPkFields` declaration.
- **Prior pattern:** `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md` — the umbrella write-path doc. This one is an addendum specific to compound-PK tables.
