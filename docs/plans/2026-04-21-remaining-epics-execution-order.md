# Remaining Epics — Execution Order & Roadmap

> **Date:** 2026-04-21
> **Context:** 100 of 117 epics complete. 17 epics remain in backlog.
> **Goal:** Ship beta → polish → earn the right to build more.
> **Supersedes:** `docs/plans/2026-03-28-product-roadmap.md` Wave 3+ sections.

---

## 📋 Master Todo List

### 🚀 Gate 0 — Beta Launch (partially complete as of 2026-04-21)

**Deployment:** ✅ Done via different topology than planned.
- **Actual:** `knowlune.pedrolages.net` (bundled Nginx + Express + SSO proxy on titan)
- **Planned but skipped:** Cloudflare Pages split (`app.pedrolages.net` + `api.pedrolages.net`)
- **Decision:** Bundled deployment is simpler and valid for ≤10 users. Revisit split if scaling past beta.

**Supabase:** ✅ `supabase.pedrolages.net` live (Kong returning expected 401).

**Production-readiness gaps — audited 2026-04-21 via SSH. 4 of 5 open + 3 bonus issues.**

➡ **See dedicated plan:** [`docs/plans/2026-04-21-pre-beta-hardening-sprint.md`](./2026-04-21-pre-beta-hardening-sprint.md) — 8 units, ~4-6 hours P0 work + 24h wait for dump cron verification.

Quick status:
- ❌ R6 Postgres UNTUNED (128MB buffers on 31GB host)
- ❌ R7 Sentry DSN NOT configured (silent error reporting)
- ❌ R4 Restore rehearsal not done
- ❌ BONUS-2 Dump cron broken (last dump Apr 19, today Apr 21)
- ⚠ R8 Privacy/Terms/Delete UI — routes exist but need end-to-end test
- ⚠ BONUS-1 knowlune healthcheck cosmetically broken
- ✅ R5 Kopia offsite likely covers dumps (not explicitly verified)

Execute hardening sprint → validate Go/No-Go checklist → then Gate 1.

### 🏁 Gate 1 — Quality Polish (must ship before marketing)

- [ ] **E66 — WCAG 2.2 Compliance** (6 stories)
  - Legal/moral minimum for public launch
  - Pure frontend, no backend dependencies
  - Stories: dragging alternatives, target size, focus not obscured, auth redundant entry, focus indicators, automated testing
  - _Why first:_ Legal exposure for public apps; pure frontend = no blockers

- [ ] **E64 — Performance Optimization** (9 stories)
  - Priority story order: `64-3` (bundle baseline) FIRST → enables regression detection for everything after
  - Then: `64-1` modulepreload, `64-2` conditional seeds, `64-4` compound indexes, `64-5` settings lazy-load
  - Finally: `64-6/7/8/9` progressive loading, pagination, workers, PWA cache
  - _Why second:_ First impression + Core Web Vitals; blocks nothing but improves everything

- [ ] **E99 — Course Display View Modes** (5 stories)
  - View mode toggle + grid columns + list + compact + virtualization
  - _Why third:_ Small UX epic with high perceived polish; users with many courses will demand this

**Decision gate:** 30-day user observation window after Gate 1.

---

### 🌱 Gate 2 — High-Value User Features (prove PMF)

_Observe beta users for 30 days. Then pick based on what they actually ask for._

- [ ] **E67 — Bulk Selection & Batch Ops** (8 stories)
  - Power-user feature; demanded once users have 20+ items
  - Hook + wrapper + toolbar + delete/archive/export + integrations
  - _Independent, pure frontend_

- [ ] **E68 — On-Device Embedding Optimization** (7 stories, `ready-for-dev`)
  - Removes OpenAI dependency for free tier → changes unit economics
  - Provider abstraction + Transformers.js + fallback chain
  - _Specs already written_

- [ ] **E61 — PWA Push Notifications** (7 stories, `ready-for-dev`)
  - Biggest retention lever for web apps
  - VAPID + service worker + Supabase edge function + opt-in flow
  - _Specs already written_
  - _Depends on: E95 settings sync (✅ done), E60 smart triggers (✅ done)_

- [ ] **E70 — Smart Scheduling** (7 stories, `ready-for-dev`)
  - Differentiated feature (Duolingo-style time-aware nudges)
  - Scheduling engine + multi-signal scoring + ambient nudges + weekly planner
  - _Specs already written_
  - _Builds on: E60 (smart triggers) + E59 (FSRS) — both ✅ done_

**Decision gate:** After each epic, evaluate "did users use this?" — skip/reorder Tier 3+ accordingly.

---

### 🔌 Gate 3 — Integrations (conditional on beta demand)

_Only build these if beta users explicitly request data portability or cross-tool workflows._

- [ ] **E75 — Readwise Export** (4 stories) — SMALLEST integration, ship first
  - Token auth + mapping + highlights/bookmarks sync + progress UI
  - _Pattern validator for E74/E77_

- [ ] **E77 — Google Drive Backup & Restore** (7 stories)
  - Google OAuth + service layer + manual/scheduled backups + restore
  - _Disaster recovery pitch; shares OAuth infra with later epics_

- [ ] **E74 — Notion Cloud Export** (5 stories)
  - Notion OAuth + mapping + data sync + error recovery
  - _Reuses patterns from E75/E77_

- [ ] **E76 — Email Digest Notifications** (7 stories)
  - Schema + aggregation + React Email template + pg_cron + unsubscribe + UI
  - _Heaviest integration; high maintenance surface (deliverability, spam)_

**Decision gate:** If <20% of beta users ask for exports, convert these to `wont-fix` in `docs/known-issues.yaml`.

---

### 🧩 Gate 4 — Plugin Ecosystem (platform bet, optional)

_Do NOT start unless you're committed to Knowlune being extensible. ~30 stories total._

- [ ] **E78 — Plugin Foundation (MVP)** (7 stories) — BLOCKER for all below
  - Manifest schema + lifecycle + settings UI + PluginSlot + data hooks + sample plugin + types package

- [ ] **E80 — Personal API & Token Management** (3 stories)
  - Token generation UI + REST endpoints + rate limiting
  - _Needed before plugins can call back_

- [ ] **E79 — Plugin Ecosystem Expansion** (6 stories)
  - Custom routes + sidebar injection + lazy loading + scaffold CLI + hot reload + test utilities
  - _Depends on E78_

- [ ] **E81 — Webhook Event System** (2 stories)
  - Webhook registration + retry with exponential backoff
  - _Depends on E80_

- [ ] **E82 — Plugin Discovery & Ecosystem Maturity** (3 stories)
  - In-app plugin browser + registry + xAPI event emission
  - _Capstone; requires E78 + E79 to have real plugins_

**Decision gate:** Before starting E78, commit to "I am becoming a platform company." If not, SKIP this entire tier.

---

### ⛔ Skipped (intentional)

- **E55 — Stitch UI Phase 1** — Skipped per `project_epic_execution_order.md` memory

---

## 📊 Effort Summary

| Tier | Epics | Stories | Estimated Effort |
|------|-------|---------|------------------|
| Gate 1 (Quality Polish) | 3 | 20 | ~2-3 weeks |
| Gate 2 (User Features) | 4 | 29 | ~4-6 weeks |
| Gate 3 (Integrations) | 4 | 23 | ~4-5 weeks |
| Gate 4 (Plugin Ecosystem) | 5 | 21 | ~4-5 weeks |
| **Total remaining** | **16** | **93** | **~14-19 weeks** |

_Gate 4 is optional — if skipped, total drops to 11 epics / 72 stories / ~10-14 weeks._

---

## 🎯 Execution Commands

Each epic can be shipped via:

```bash
# Per-story (preferred for review quality)
/start-story E##-S##
# ... implement ...
/review-story E##-S##
/finish-story E##-S##

# Full epic end-to-end (higher throughput)
/epic-orchestrator E##

# Net-new features without prior story spec
/ce-orchestrator "feature description"
```

---

---

# 🔍 Deep Analysis: Findings & Recommendations (2026-04-21)

_Based on 3 parallel audits: (1) ready-for-dev story specs, (2) missing epics/gaps, (3) structural issues (merge/split/descope). Full audit raw data preserved in session history._

## 🚨 Critical Finding: Real Launch Blocker Discovered

### ⛔ **E61 has a blocker** — missing `push_subscriptions` Supabase migration
The story specs for E61-S03 assume a `push_subscriptions` table exists in Supabase. **It doesn't.** The migration was never written.

**Action:** Before starting E61, create the migration file as a prerequisite. This is a ~30-line SQL file but blocks 4 of 7 stories.

---

## 🆕 Missing Epics (15 new work streams that should exist)

### P0 — Launch Blockers (add these to Gate 1)

- [ ] **NEW E118 — In-App Feedback & Bug Reporting** (S, ~3 stories)
  - _Why:_ Sentry captures errors, but users can't volunteer context. No "report bug" entry point exists in the app.
  - _Without this:_ Your 10 beta users will email you from outside the app, you'll lose auto-context (user id, current URL, state), triage = manual.
  - Stories: in-app feedback form, auto-attach context (URL/user/state), route to GitHub issues or email.

- [ ] **NEW E119 — GDPR Full Compliance** (M, ~5-6 stories)
  - _Why:_ E19-S09 added basic account deletion + data summary. Missing: cookie consent banner (EU), age-gate, full GDPR Article 15 export, deletion confirmation email, audit log UI.
  - _Without this:_ Legal exposure the moment you invite an EU user.

### P1 — Before Growth (add to Gate 2)

- [ ] **NEW E120 — Observability Beyond Sentry** (M, ~5-7 stories)
  - _Why:_ **Most surprising gap.** Founder cannot answer "did retention improve after E59 FSRS?" without PostHog/Plausible events. Sentry is error-first, not retention-first.
  - Stories: event schema, SDK wiring (PostHog or Plausible), retention dashboard, Core Web Vitals dashboard, custom event emission.

- [ ] **NEW E121 — Multi-Device Account Management** (M, ~4-6 stories)
  - _Why:_ E92-E97 shipped sync, but there's no "my devices" UI. Users will ask "what devices have access?" and "can I sign out of my old phone?" immediately.
  - Stories: device registry, last-seen tracking, remote logout, device naming, trusted-device flow.

- [ ] **NEW E122 — Feature Flags & Gradual Rollout** (M, ~5-6 stories)
  - _Why:_ Beta launch plan has only "DNS swap" rollback. No canary deploys, no kill-switch, no A/B testing infrastructure.
  - Stories: flag schema, client evaluator, admin dashboard stub, kill-switch UI.

- [ ] **NEW E123 — Offline Conflict Resolution UI** (M, ~4-5 stories)
  - _Why:_ E92-E97 used LWW (last-write-wins). No merge UI for when user edits same note on 2 devices.
  - Stories: conflict detection, merge UI, version picker, undo-merge, conflict log.

- [ ] **NEW E124 — Staging Environment & CD Hardening** (M, ~5-6 stories)
  - _Why:_ Beta plan has one production DB. No staging for testing migrations safely. No automated rollback on error spike.
  - Stories: docker-compose staging stack, seed-data generator, canary-deploy orchestration, error-rate alerting, automated rollback RPC.

- [ ] **NEW E125 — FSRS Retention Dashboard** (M, ~4-6 stories)
  - _Why:_ E59 shipped the algorithm but deferred the UI. Users expect "what's my retention %?", forgetting curve charts, parameter optimizer. This is what differentiates from Anki.

### P2-P3 — Post-Product-Fit (defer, demand-gate)

- [ ] **NEW E126 — Privacy Policy Versioning UI** (S, ~2-3 stories) — policy changelog, consent audit table
- [ ] **NEW E127 — Search Enhancements** (M, ~4-6 stories) — voice input, history, saved searches
- [ ] **NEW E128 — AI Tutor Export & Cross-Session Memory** (M, ~4-5 stories)
- [ ] **NEW E129 — Competitor Import** (L, ~7+ stories) — Kindle, LinkedIn Learning, Anki
- [ ] **NEW E130 — i18n Foundation** (M, ~5-7 stories)
- [ ] **NEW E131 — Collaborative Features** (L, ~8+ stories) — shared courses, study groups

---

## 🔧 Structural Adjustments to Existing Backlog Epics

### Merges (reduce effort ~30%)

1. **Merge E74/E75/E77 infrastructure** → Create **E74a: Cloud Integration Foundation** (5 stories: OAuth, sync queue, registry, Zustand store, shared UI). Then ship thin provider epics: E75a (Readwise, 3 stories), E74b (Notion, 3 stories), E77a (Google Drive, 3 stories).
   - **Evidence:** E74-S01 + E75-S01 + E77-S01 share ~70% code — identical `ExternalIntegrationProvider` interface, `SyncQueue`, rate limiting, OAuth token state machine.
   - **Effort impact:** 21 cumulative stories → 14 stories (~33% reduction).

2. **Merge E80 (API & Tokens) + E81 (Webhooks)** → Keep E80, absorb E81's 2 stories as S04/S05.
   - **Evidence:** E81 has only 2 stories — below epic threshold. Webhooks UI lives in the same DeveloperPanel as token management.

3. **Downgrade E82 (Plugin Discovery) → E79-S07/S08/S09**
   - **Evidence:** E82 has only 3 stories, all depend on E78/E79 with no new infrastructure. Three-phase plugin narrative: E78 (foundation) → E79 (expansion + discovery).
   - **Result:** 17 backlog epics → 15.

### Splits (enable independent delivery)

4. **Split E64 (Performance) into 3 sub-epics:**
   - **E64a: Bundle Performance** (S01-S03) — ready now, targets <435 KB initial load
   - **E64b: Query & Database Performance** (S04-S07) — needs post-sync profiling
   - **E64c: Worker & Caching** (S08-S09) — post-MVP

### Descopes (cut speculative work)

5. **E68-S06 & E68-S07 (fallback chain + cross-browser hardening)** → defer to "E68 Phase 2"
   - **Evidence:** Speculative hardening without real-world data. 7 → 5 stories.

6. **E77-S07 (Google Drive storage cleanup)** → merge into E69 (Storage Dashboard, ✅ done)
   - **Evidence:** E69 already has storage cleanup UI. Add a "Backups" tab there instead. 7 → 6 stories in E77.

### Dependency Corrections

7. **E70-S04 (Ambient Nudges) depends on E61-S02 (service worker push)**
   - **Issue:** Story spec is vague about delivery mechanism. Add AC: "Nudges delivered via push notification (if E61 available) OR in-app toast fallback."

8. **E70 has two UX tiers that could ship separately:**
   - Tier 1 (S01-S05): Reactive suggestions ("find me study time now")
   - Tier 2 (S06-S07): Proactive weekly planner
   - Document this so Tier 2 can be deferred if priorities shift.

### Renames (clarity)

9. **E77:** "Google Drive Backup & Restore" → **"Google Drive Backup [Premium]"** (premium gate not in title)
10. **E78/E79:** "Plugin Foundation/Expansion" → "Plugin System Basics / Advanced Plugin Features" (less jargon for product roadmap)

---

## 📊 Revised Epic Count & Effort

| Change | Before | After |
|--------|--------|-------|
| Backlog epics | 17 | **15** (merge E82→E79, E81→E80) |
| NEW epics proposed | 0 | **+15** (E118-E131) |
| Stories (existing) | ~93 | ~74 (splits + descopes) |
| Stories (new) | 0 | ~60 |
| **Total remaining work** | 93 stories | **~134 stories** |

**Net effect:** +44% more work than the old backlog showed, but concentrated in P0/P1 operational needs that were invisible before.

---

## 🎯 Revised Priority Order

### Gate 0 — Beta Launch (unchanged)
Run `/ce-work docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`

### Gate 1 — Quality Polish + Launch-Essential Operations
1. ✅ **NEW E118** — In-App Feedback & Bug Reporting (P0) — [PR #400](https://github.com/PedroLages/knowlune/pull/400) merged 2026-04-21
2. **NEW E119** — GDPR Full Compliance (P0, 5-6 stories) ⬅ ADD
3. **E66** — WCAG 2.2 Compliance (6 stories)
4. **E64a** — Bundle Performance (3 stories) ⬅ split from E64
5. **E99** — Course Display View Modes (5 stories)

### Gate 1.5 — Operational Foundations (before growth)
6. **NEW E120** — Observability (PostHog/Plausible) ⬅ ADD
7. **NEW E124** — Staging Env & CD Hardening ⬅ ADD
8. **NEW E122** — Feature Flags ⬅ ADD
9. **NEW E121** — Multi-Device Management ⬅ ADD
10. **NEW E123** — Offline Conflict Resolution ⬅ ADD

### Gate 2 — High-Value User Features
11. **E61** — PWA Push Notifications ⚠ _blocker: create push_subscriptions migration first_
12. **E68** — On-Device Embeddings (5 stories after descope)
13. **E70** — Smart Scheduling (Tier 1 first: S01-S05)
14. **E67** — Bulk Selection
15. **E64b** — Query Performance
16. **NEW E125** — FSRS Retention Dashboard ⬅ ADD

### Gate 3 — Integrations (demand-gated)
17. **E74a** — Cloud Integration Foundation (merged)
18. **E75a** — Readwise (thin)
19. **E74b** — Notion (thin)
20. **E77a** — Google Drive (thin)
21. **E76** — Email Digest

### Gate 4 — Platform Bet (optional)
22. **E78** — Plugin Basics (renamed)
23. **E80** — API & Tokens (absorbs E81)
24. **E79** — Advanced Plugins + Discovery (absorbs E82)

### Deferred (demand-gate)
- E64c (Worker/Cache), NEW E126-E131

---

## ⚠ Action Items Before Starting Any Epic

1. **Create push_subscriptions Supabase migration** (prerequisite for E61)
2. **Create story specs for NEW E118, E119** (launch blockers)
3. **Update sprint-status.yaml** with proposed epic renames/merges/splits before starting work on them
4. **Decide on Gate 4 (plugins)** — commit or explicitly defer with a date
5. **Create bmad PRD entries for NEW epics E120-E124** before pulling stories

---

## Context

This plan was created 2026-04-21 after a strategic review of 17 remaining backlog epics against Knowlune's actual state (100 epics done, beta launch plan ready). The TL;DR:

- **You've built too much to justify building more before shipping.** Beta first.
- **The backlog is over-planned.** Tier 3 (Integrations) and Tier 4 (Plugins) should be demand-gated, not pre-committed.
- **Three unstarted epics (E61, E68, E70) have story specs already written** — these will execute faster than average.

This doc replaces the aspirational "Wave 3-5" sections of the 2026-03-28 product roadmap with a focused, decision-gated plan.
