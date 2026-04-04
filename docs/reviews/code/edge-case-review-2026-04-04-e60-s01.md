## Edge Case Review — E60-S01 (2026-04-04)

### Unhandled Edge Cases

**src/services/NotificationService.ts:129-138** — `Many topics below threshold cause rapid sequential event emissions`

> Consequence: N simultaneous handleEvent calls create N parallel dedup DB queries, racing against each other
> Guard: `const decayingTopics = topicRetentions.filter(t => t.retention < DECAY_THRESHOLD); for (const topic of decayingTopics) { await handleEvent(...) } // serialize emissions`

**src/services/NotificationService.ts:76** — `Topic string is empty string (note.tags[0] is '')`

> Consequence: Empty-string topic silently matches notifications with missing/empty metadata.topic, corrupting dedup logic
> Guard: `if (!topic || topic.trim().length === 0) return false`

**src/services/NotificationService.ts:253** — `event.topic is empty string from tag-less note falling through to '' tag`

> Consequence: Notification title renders as "Knowledge Fading: " with blank topic visible to user
> Guard: `title: \`Knowledge Fading: ${event.topic || 'Untitled Topic'}\``

**src/services/NotificationService.ts:130** — `topic.retention is exactly equal to DECAY_THRESHOLD (50)`

> Consequence: Retention at exactly 50% is silently skipped despite being classified as "fading" by retentionMetrics (FADING_THRESHOLD = 50 uses >=)
> Guard: `if (topic.retention <= DECAY_THRESHOLD)` — use `<=` to align with the fading classification boundary

**src/services/NotificationService.ts:254** — `event.retention is NaN from edge-case division in retentionMetrics`

> Consequence: Notification message displays "dropped to NaN%" to the user
> Guard: `if (typeof event.retention !== 'number' || isNaN(event.retention)) return`

**src/services/NotificationService.ts:120-123** — `User has thousands of notes; toArray() loads entire table into memory`

> Consequence: Large memory spike on every app startup for users with extensive note collections
> Guard: `db.notes.where('deleted').equals(0).toArray()` — at minimum filter deleted notes at query level

**src/services/NotificationService.ts:84** — `n.metadata is null or not an object (corrupted notification record)`

> Consequence: TypeError accessing .topic on null crashes the Dexie filter function, breaking dedup query entirely
> Guard: `(n.metadata != null && typeof n.metadata === 'object' && (n.metadata as Record<string, unknown>).topic === topic)`

---

**Total:** 7 unhandled edge cases found.
