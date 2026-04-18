# Epic 22 (Candidate): Server-Side Search & Cross-Device Discovery

**Status:** CANDIDATE — captured from Workstream B brief on 2026-04-18. Not committed, not scheduled.
**Source:** `docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md` §4.1

## One-Line Summary

Graduate Knowlune search from in-memory local MiniSearch to Postgres `ts_vector` + `pg_trgm` server-side full-text search, enabling cross-device search and cross-user discovery once local search hits scaling limits.

## Why This Is a Candidate, Not a Commitment

Workstream A (local search upgrade, see `docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md`) ships first. Workstream A is expected to serve Knowlune's needs for the foreseeable future. This epic is only justified when one of the triggers below fires.

## Trigger Conditions (Any One)

1. Local MiniSearch index exceeds ~100MB memory for real users (performance regression)
2. Knowlune adds any cross-user discovery feature (shared courses, public authors, social browse)
3. A second device needs to search without downloading the full library (mobile-native wrapper, thin-client PWA mode)

## Prerequisites

- Epic 92 (data sync) shipped — content must exist server-side
- Workstream A shipped — we need a local baseline to know what "server-side improvement" means

## NFR Tension

**Medium.** Search results continue to serve offline from local MiniSearch. Server-side FTS becomes the upgrade path for online/cross-device queries. Treat as augmentation, not replacement. Requires explicit product approval per the local-first commitment in `docs/plans/2026-03-14-epic-19-prerequisites.md` lines 30-31.

## Next Action

When a trigger fires, run `/ce-brainstorm` to flesh out this epic from the candidate stub. Do not begin planning before then.
