# Epic 23 (Candidate): Server-Side Reports Aggregations

**Status:** CANDIDATE — captured from Workstream B brief on 2026-04-18. Not committed, not scheduled.
**Source:** `docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md` §4.2

## One-Line Summary

Move expensive Reports-page aggregations (streaks, total watch time, per-topic progress, per-author time allocations) from client-side Dexie scans to Postgres materialized views, refreshed via `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

## Why This Is a Candidate, Not a Commitment

Reports render fast today because datasets are small. Server-side aggregation is only worth the complexity when client computation becomes a user-visible problem or when cross-device aggregation becomes a feature.

## Trigger Conditions (Any One)

1. Reports page exceeds 500ms render on cold load for a real user
2. Cross-device aggregation becomes a feature ask ("show my combined activity across laptop and phone")
3. Comparative/social reports added ("learners like you watched X more this week")

## Prerequisites

- Epic 92 (data sync) shipped — progress rows, session rows, note rows must exist server-side
- RLS policies extended to cover materialized views (Postgres requires `security_invoker = true` or wrapper views — plan for this)

## NFR Tension

**Medium.** Reports continue to render offline from local data. Server-side views become the "when online, use cached aggregate" path. Freshness trade-off: stale server aggregate vs live local scan — client must handle.

## Next Action

When a trigger fires, run `/ce-brainstorm` to flesh out this epic. Do not begin planning before then.
