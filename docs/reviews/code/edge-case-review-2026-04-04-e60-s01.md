## Edge Case Review — E60-S01 (2026-04-04)

### Unhandled Edge Cases

**[NotificationService.ts:129–130]** — `topic.retention is exactly equal to DECAY_THRESHOLD (50)`
> Consequence: The check uses strict `<` (`topic.retention < DECAY_THRESHOLD`), so a topic at exactly 50% retention does NOT trigger a decay alert. Meanwhile, `retentionMetrics.ts:57` classifies 50% as `fading` (not `weak`) since `FADING_THRESHOLD` is also 50 and uses `>=`. A topic classified as "fading" at exactly the boundary never triggers a notification — inconsistent with the retention level system.
> Guard: `if (topic.retention <= DECAY_THRESHOLD)` to align with the fading classification boundary, or add a comment documenting the intentional gap (only "weak" topics alert).

---

**[NotificationService.ts:127–138]** — `getTopicRetention returns many topics (user with 100+ decaying topics)`
> Consequence: The loop emits one `knowledge:decay` event per decaying topic synchronously. Each event triggers `handleEvent`, which calls `hasKnowledgeDecayToday` — a full table scan with `.filter()` over all `knowledge-decay` notifications. For N decaying topics and M existing decay notifications, this is O(N * M) database filter operations at startup. With a large notification history, this causes a noticeable startup delay.
> Guard: Batch-query all existing `knowledge-decay` notifications for today once before the loop, build a `Set<string>` of already-notified topics, and skip emission for those:
> ```ts
> const todayStr = new Date().toLocaleDateString('sv-SE')
> const existing = await db.notifications
>   .where('type').equals('knowledge-decay')
>   .filter(n => new Date(n.createdAt).toLocaleDateString('sv-SE') === todayStr)
>   .toArray()
> const alreadyNotified = new Set(existing.map(n => (n.metadata as Record<string, unknown>)?.topic))
> ```

---

**[NotificationService.ts:129–138]** — `Many topics below threshold cause rapid sequential event emissions with parallel handlers`
> Consequence: `appEventBus.emit` is synchronous, but `handleEvent` is async. N simultaneous `handleEvent` calls each run `hasKnowledgeDecayToday` concurrently, racing against each other. If topic A and topic B both emit before either handler writes to DB, both dedup checks pass, potentially creating duplicate notifications for the same topic if the same topic name appears twice (e.g., from merged data).
> Guard: Serialize emissions by awaiting each or use the batch pre-check from above.

---

**[NotificationService.ts:253]** — `event.topic is empty string (note.tags[0] is '')`
> Consequence: Notification title renders as `"Knowledge Fading: "` with a blank topic visible to the user. The dedup key in `hasKnowledgeDecayToday` would match on empty string, so at least duplicates are prevented, but the user sees a meaningless notification.
> Guard: `title: \`Knowledge Fading: ${event.topic || 'Untitled Topic'}\``

---

**[retentionMetrics.ts:83]** — `note.tags[0] ?? 'General'` as topic key for untagged notes
> Consequence: Multiple untagged notes accumulate under the synthetic `'General'` topic. If their collective retention drops below 50%, the user receives a "Knowledge Fading: General" alert, which is not actionable — the user has no way to find or review a topic named "General".
> Guard: Either skip the "General" synthetic topic in the decay startup check (`if (topic.topic === 'General') continue`), or improve the notification message to say "untagged notes" instead.

---

**[NotificationService.ts:254]** — `event.retention is NaN from edge-case division in retentionMetrics`
> Consequence: If `predictRetention` returns `NaN` for a corrupted review record (e.g., malformed `last_review` string that bypasses the `isNaN` guard), the average calculation in `getTopicRetention` propagates NaN. The notification message displays "dropped to NaN%".
> Guard: `if (typeof event.retention !== 'number' || isNaN(event.retention)) return`

---

**[NotificationService.ts:120–123]** — `db.notes.toArray() and db.reviewRecords.toArray() load entire tables into memory`
> Consequence: For users with thousands of notes and review records, this causes a memory spike on every app startup. Deleted notes are included in the query but filtered later by `getTopicRetention` (line 82: `if (note.deleted) continue`), wasting both memory and iteration time.
> Guard: Filter deleted notes at the query level: `db.notes.where('deleted').equals(0).toArray()` or `db.notes.filter(n => !n.deleted).toArray()`.

---

**[NotificationService.ts:77, 85]** — `new Date().toLocaleDateString('sv-SE')` called independently in startup check and handler
> Consequence: If `checkKnowledgeDecayOnStartup` runs near midnight and processing takes time, the date string could tick over between the startup emitter and the `handleEvent` dedup check. A topic could get two notifications — one just before midnight and one just after — because each `new Date()` call captures a different day.
> Guard: Capture `todayStr` once per startup check cycle and pass it through the event or use a shared snapshot.

---

**[NotificationService.ts:299–302]** — `checkKnowledgeDecayOnStartup runs unconditionally, ignoring user preference`
> Consequence: The startup function fetches all notes and review records, computes topic retentions, and emits events even when the user has disabled `knowledgeDecay` notifications. The events are then filtered out in `handleEvent` by the preference check (line 161). This wastes DB reads and CPU cycles unnecessarily.
> Guard: Check preference before doing work:
> ```ts
> const prefsStore = useNotificationPrefsStore.getState()
> if (!prefsStore.isTypeEnabled('knowledge-decay')) return
> ```

---

**[NotificationService.ts:84]** — `n.metadata is null or not an object (corrupted notification record)`
> Consequence: If a `knowledge-decay` notification was created without `metadata` (data corruption, sync import, or future code path), the cast `(n.metadata as Record<string, unknown>)?.topic` relies on optional chaining. This is safe against `null`/`undefined` due to `?.`, but if `metadata` is a non-object primitive (e.g., a string from bad data), accessing `.topic` on it returns `undefined` rather than crashing. The dedup check fails to match, allowing a duplicate notification. Low risk but worth noting.
> Guard: `(n.metadata != null && typeof n.metadata === 'object' && (n.metadata as Record<string, unknown>).topic === topic)`

---

**[schema.ts:1180–1188]** — `Migration v32 upgrade callback only runs for existing databases`
> Consequence: The `.upgrade()` callback adds `knowledgeDecay` to existing preference rows, but only runs for databases upgrading from v31 to v32. Brand-new users get tables from the `.stores()` definition without running `.upgrade()`. They rely entirely on `DEFAULTS` in `useNotificationPrefsStore` to populate the row. If preferences are ever seeded outside the store (e.g., by a future sync/import feature), the `knowledgeDecay` field could be missing, causing `isTypeEnabled('knowledge-decay')` to return `true` (fallback) but with an inconsistent DB state.
> Guard: Add defensive backfill in `useNotificationPrefsStore.init()`: `if (existing.knowledgeDecay === undefined) { existing.knowledgeDecay = true; await db.notificationPreferences.put(existing); }`

---

**Total:** 11 unhandled edge cases found (8 actionable, 3 low-risk/informational).
