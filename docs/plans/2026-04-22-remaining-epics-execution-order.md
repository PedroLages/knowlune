---
title: Remaining Epics — Execution Order & Roadmap
type: plan
status: active
date: 2026-04-22
---

# Remaining Epics — Execution Order & Roadmap

> **Context:** 100 of 117 epics complete. 17 epics remain in backlog. Knowlune deployed as daily-driver at `knowlune.pedrolages.net` via [host-titan plan](2026-04-20-002-feat-host-knowlune-titan-daily-driver-plan.md).
> **Supersedes:** Wave 3+ sections of [`2026-03-28-product-roadmap.md`](2026-03-28-product-roadmap.md)
> **Related:** [Pre-beta hardening sprint](2026-04-21-pre-beta-hardening-sprint.md) — blocks Gate 1

## 🚦 Gate 0 — Daily-Driver Live ✅ + Beta Hardening ✅ COMPLETE

**Deployment status (verified 2026-04-22):**

- ✅ `knowlune.pedrolages.net` live (Nginx + Express bundled container, SSO proxy)
- ✅ `supabase.pedrolages.net` live (Kong 3.9.1)
- ✅ Kopia offsite daily snapshots include `/mnt/user/appdata/supabase/db/dumps/` (snapshot k2b2e8aa1c32a41c6cf155163318bdb6d verified)
- ✅ **Supabase dumps fixed** — `pre-backup.sh` fault-tolerant; fresh dump `supabase_dumpall_20260422_022853.sql`
- ✅ **Postgres tuned** — shared_buffers=8GB, effective_cache_size=24GB, work_mem=64MB
- ✅ **Sentry DSN configured** — EU ingest added to CSP; errors captured
- ✅ **Restore rehearsal complete** — runbook at `docs/runbooks/supabase-restore-rehearsal.md`; all row counts matched
- ✅ Privacy/Terms render content + delete-account flow verified (2026-04-22: user hard-deleted from auth.users)

**Gate 0 COMPLETE. Invite humans.**

---

## 🏁 Gate 1 — Quality Polish + Launch-Essential Operations

_Ship these before marketing. Blocked by Gate 0 hardening sprint._

- [x] **E118 — In-App Feedback & Bug Reporting** (P0, 3 stories)
  - 📄 Plan exists: [`2026-04-21-003-feat-in-app-feedback-bug-reporting-plan.md`](2026-04-21-003-feat-in-app-feedback-bug-reporting-plan.md)
  - Without this, beta users will email you with no auto-context
- [ ] **NEW E119 — GDPR Full Compliance** (P0, ~5-6 stories)
  - Cookie consent (EU), age-gate, Article 15 export, deletion confirmation email, audit log UI
  - Legal exposure without this — do before first EU user
- [ ] **E66 — WCAG 2.2 Compliance** (6 stories)
  - Pure frontend, no backend dependencies
- [ ] **E64a — Bundle Performance** (3 stories, split from E64)
  - Story `64-3` (bundle baseline) FIRST — enables regression detection for everything after
  - Then `64-1` (modulepreload) and `64-2` (conditional seeds)
- [ ] **E99 — Course Display View Modes** (5 stories)
  - Small epic, high perceived polish

**Decision gate:** 30-day observation window after Gate 1 completes.

---

## 🌱 Gate 1.5 — Operational Foundations (before growth past ~5 users)

- [ ] **NEW E120 — Observability Beyond Sentry** (M, ~5-7 stories)
  - PostHog/Plausible events, retention dashboard, Core Web Vitals
  - **Most surprising gap.** Can't measure "did FSRS improve retention?" without events.
- [ ] **NEW E124 — Staging Env & CD Hardening** (M, ~5-6 stories)
  - Docker-compose staging, seed data, canary deploy, automated rollback
- [ ] **NEW E122 — Feature Flags & Gradual Rollout** (M, ~5-6 stories)
  - Beta plan has only "DNS swap" rollback — insufficient for rapid iteration
- [ ] **NEW E121 — Multi-Device Account Management** (M, ~4-6 stories)
  - Users on E92-E97 sync will ask "what devices are signed in?"
- [ ] **NEW E123 — Offline Conflict Resolution UI** (M, ~4-5 stories)
  - E92-E97 used LWW — no merge UI for dual-device edits

---

## 🎯 Gate 2 — High-Value User Features

- [ ] **E61 — PWA Push Notifications** (7 stories, `ready-for-dev`)
  - ⚠ Blocker: `push_subscriptions` Supabase migration doesn't exist yet — create before starting
  - Stories ready, infrastructure ready (E60 smart triggers ✅ done)
- [ ] **E68 — On-Device Embeddings** (5 stories after descope of S06/S07)
  - Removes OpenAI dependency for free tier → changes unit economics
- [ ] **E70 — Smart Scheduling Tier 1** (S01-S05, 5 stories)
  - S04 depends on E61-S02 (service worker push) — sequence carefully
- [ ] **E67 — Bulk Selection & Batch Ops** (8 stories)
  - Power-user feature; pairs well with E99 for grid view
- [ ] **E64b — Query & Database Performance** (4 stories, split from E64)
- [ ] **NEW E125 — FSRS Retention Dashboard** (M, ~4-6 stories)
  - E59 shipped the algorithm; UI was deferred. This closes the loop.

---

## 🔌 Gate 3 — Integrations (demand-gated)

_Merge E74+E75+E77 shared infra into foundation + thin providers — saves ~33% effort._

- [ ] **NEW E74a — Cloud Integration Foundation** (5 stories)
  - OAuth + sync queue + token storage + registry + shared UI
- [ ] **E75a — Readwise Export (thin)** (3 stories) — ship first, smallest
- [ ] **E74b — Notion Export (thin)** (3 stories)
- [ ] **E77a — Google Drive Backup [Premium] (thin)** (3 stories, renamed from E77)
  - Merge E77-S07 (storage cleanup) into E69 dashboard instead
- [ ] **E76 — Email Digest Notifications** (7 stories)
  - Heaviest; high maintenance surface (deliverability, spam)

**Decision gate:** If <20% of beta users ask for exports, convert to `wont-fix`.

---

## 🧩 Gate 4 — Plugin Ecosystem (optional platform bet)

_~21 stories. Do NOT start unless committed to being an extensible platform._

- [ ] **E78 — Plugin System Basics** (7 stories, renamed from "Foundation")
- [ ] **E80 — API & Tokens (absorbs E81 webhooks)** (5 stories)
  - E81 had only 2 stories — merged as S04/S05
- [ ] **E79 — Advanced Plugin Features (absorbs E82 discovery)** (9 stories)
  - E82 had only 3 stories — downgraded to E79 final tier

---

## ⛔ Skipped / Descoped

- **E55** — Stitch UI Phase 1 (user decision per `project_epic_execution_order.md` memory)
- **E64c** — Worker/Caching performance (post-MVP)
- **E68-S06 & E68-S07** — Speculative cross-browser hardening (→ Phase 2)
- **E77-S07** — Duplicates completed E69 Storage Dashboard

---

## 🔮 P2-P3 (deferred, demand-gate)

- NEW E126 — Privacy Policy Versioning UI
- NEW E127 — Search Enhancements (voice, history, saved)
- NEW E128 — AI Tutor Export & Cross-Session Memory
- NEW E129 — Competitor Import (Kindle, LinkedIn Learning, Anki)
- NEW E130 — i18n Foundation
- NEW E131 — Collaborative Features (shared courses, study groups)

---

## 📊 Effort Summary

| Tier | Epics | Stories | Estimated Effort |
|------|-------|---------|------------------|
| Gate 0 (Hardening) | 1 sprint | 8 units | ~4-6h P0 |
| Gate 1 (Polish + Launch Ops) | 5 | ~22 | 3-4 weeks |
| Gate 1.5 (Operational) | 5 new | ~24-29 | 4-6 weeks |
| Gate 2 (User Features) | 6 | ~30 | 5-7 weeks |
| Gate 3 (Integrations) | 5 | ~21 | 3-4 weeks |
| Gate 4 (Plugins, optional) | 3 | ~21 | 4-5 weeks |
| **Total** | **25** | **~135** | **~20-25 weeks** |

Gate 4 is optional. Without it: 22 epics / ~114 stories / ~16-21 weeks.

---

## 🎬 Execution Commands

```bash
# Per-story (preferred for quality)
/start-story E##-S##
# ... implement ...
/review-story E##-S##
/finish-story E##-S##

# Full epic end-to-end
/epic-orchestrator E##

# Net-new features
/ce-orchestrator "<description>"
```

---

## ⚠ Immediate Actions (next 48 hours)

1. **Execute pre-beta hardening sprint** (Gate 0) — start with Unit 1 (Sentry) + Unit 3 (dump cron fix)
2. **Create `push_subscriptions` migration** — unblocks E61
3. **Write stories for NEW E119, E120, E121, E122, E123, E124, E125** before pulling them
4. **Update sprint-status.yaml** with proposed epic renames/merges/splits before starting work
5. **Decide on Gate 4 (plugins)** — commit or explicitly defer with a date

---

## Context

This plan was created 2026-04-22 after discovering:

- The 2026-04-18 Cloudflare-Pages-split beta plan was superseded by the 2026-04-20 titan daily-driver plan (bundled deployment instead)
- The 2026-04-20 plan explicitly deferred Postgres tuning, restore rehearsal, and privacy surface to "the beta plan" — which means those gaps are still open
- Deep analysis via parallel audits found 15 missing epics (E118-E131) — mostly operational/compliance work invisible in the original roadmap
- Structural issues in backlog: E81/E82 too small (merge), E64/E70 should split or be tiered, E77-S07 duplicates E69

The roadmap is now a gated decision tree. Each gate has an explicit observation window before proceeding — the goal is to let users pick Tier 3+ rather than pre-committing.
