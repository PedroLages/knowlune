---
title: Host Knowlune on titan as a personal daily-driver
type: brainstorm → requirements
status: draft
date: 2026-04-20
origin: /compound-engineering:ce-brainstorm (user input: "i want to host this app on my unraid server (ssh titan)")
---

# Host Knowlune on titan as a personal daily-driver

## Context

Knowlune currently runs only from `npm run dev` on Pedro's laptop. A separate, more ambitious plan already exists for the public beta launch (see [docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md](docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md)) — split architecture across Cloudflare Pages + titan + Supabase, closing five production gaps over three weeks.

This brainstorm is **narrower**: get a single instance running on titan at `knowlune.pedrolages.net` so Pedro can use Knowlune as a daily-driver from any device without launching the dev server. It is **not** a beta deploy. No external users. No production-readiness gates (restore rehearsal, Postgres tuning, privacy policy) — those remain gated to the beta plan.

Intended outcome: a public-URL, auth-gated, always-on Knowlune instance that Pedro personally uses and that doubles as a staging rehearsal target once the beta plan spins up.

## Decisions

| Decision                | Chosen                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Deployment shape**    | Bundled single container — reuse existing [Dockerfile](Dockerfile) as-is (Nginx + Node server).               |
| **Hosting target**      | titan (Unraid). Docker container behind existing Traefik v3 + Cloudflare Tunnel.                              |
| **Public URL**          | `https://knowlune.pedrolages.net` (avoids collision with `app.*` reserved for future beta).                   |
| **Supabase**            | Reuse existing `supabase.pedrolages.net` on titan. No new instance.                                           |
| **Auth**                | Supabase email magic link. No app-level gating — access is whoever Pedro adds to Supabase Auth (just him).    |
| **Update loop**         | GitHub Actions builds image on push to `main` → pushes to GHCR → Watchtower on titan pulls and redeploys.     |
| **Config style**        | Same image, env-driven. `ALLOWED_ORIGINS`, Supabase URL/keys, Sentry DSN all via env so the image is reusable for future staging. |
| **Scope boundary**      | No restore rehearsal, no Postgres tuning, no privacy policy, no delete-account flow. Those are beta-plan work. |

## Requirements

- **R1.** Knowlune is reachable at `https://knowlune.pedrolages.net` over HTTPS from any device.
- **R2.** Only accounts in titan Supabase can sign in; magic-link email delivery works.
- **R3.** Same-origin fetches to `/api/*` hit the bundled Express server; no CORS needed for SPA↔API.
- **R4.** Browser fetches to `https://supabase.pedrolages.net` succeed from `https://knowlune.pedrolages.net` (Supabase kong CORS must allow this origin).
- **R5.** A `git push` to `main` on GitHub results in the running titan container being updated within 15 minutes, without manual SSH steps, unless the build fails.
- **R6.** Runtime errors from the SPA and API are visible in Sentry when a `VITE_SENTRY_DSN` is configured (optional — OK to defer first deploy without Sentry).
- **R7.** A single documented command on titan rolls back to the previous image tag.
- **R8.** The same image + a different env file can be redeployed as `staging.pedrolages.net` later, with no rebuild, to rehearse the beta plan.

## Non-Goals (Explicitly Deferred to Beta Plan)

- Supabase restore rehearsal, Postgres tuning, Kopia verification — beta plan Phase 1.
- Privacy policy, delete-account flow, legal surface — beta plan Phase 3.
- Stripe / billing.
- Invite management UI, OAuth providers beyond magic link.
- Cloudflare Pages SPA split, edge caching, preview deploys.
- Public waitlist / beta gating.

## Success Criteria

- Pedro opens `https://knowlune.pedrolages.net` on phone or laptop, signs in with a magic link, and his existing data loads.
- Pedro pushes a commit to `main`. Within ~15 min, the change is live at `knowlune.pedrolages.net` without SSH.
- If the deploy is bad, Pedro can roll back to the previous image tag in under 2 minutes.
- No external users have been invited. Access remains functionally private via the Supabase Auth allowlist (only Pedro's email).

## Risks and Mitigations

| Risk                                                                                | Mitigation                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Subdomain collision with future beta `app.pedrolages.net`                           | Use `knowlune.pedrolages.net` now; `app.*` stays reserved.                                             |
| Watchtower auto-pulls a broken image and takes the daily-driver down                | Pin to specific tag (e.g. `ghcr.io/…:main`) and keep prior image; roll back via `docker tag` swap.     |
| No production-readiness work (backups proven, Postgres tuned) — daily driver relies on unverified recovery path | Scope decision: this is explicitly a daily-driver, not beta. Pedro accepts the risk. Beta plan remains the gate for external users. |
| Supabase kong CORS may not allow the new origin                                     | Add `https://knowlune.pedrolages.net` to kong CORS allow list on first 401/blocked fetch.              |
| GHCR image build pipeline doesn't exist yet in this repo                            | Add minimal `.github/workflows/build-and-push.yml`; watchtower label on Traefik compose.               |
| Single-container image can't independently scale API ↔ SPA                          | Not a daily-driver concern. Revisit only if beta plan triggers split.                                  |

## Open Questions (for Planning, Not Blocking)

- **Image registry: GHCR vs titan-local registry?** GHCR is simpler (no new infra); titan-local is faster and keeps everything on-prem. Pick in planning.
- **Watchtower polling interval?** 5 min is typical; 15 min is gentler on GHCR rate limits.
- **Should `knowlune.pedrolages.net` share the existing Traefik `chain-public` middleware** (rate limit, CrowdSec, TLS), or a lighter chain since it's single-user? Default: reuse `chain-public`.

## Critical Files to Reference in Planning

- [Dockerfile](Dockerfile) — existing bundled image. **Reuse as-is.**
- [nginx.conf](nginx.conf) — SPA + `/api/` proxy. No changes needed.
- [docker-entrypoint.sh](docker-entrypoint.sh) — starts nginx + node server. No changes needed.
- [.env.example](.env.example) — env var contract for titan `.env`.
- [server/middleware/origin-check.ts](server/middleware/origin-check.ts) — confirm `knowlune.pedrolages.net` is added to `ALLOWED_ORIGINS`.
- [src/main.tsx](src/main.tsx) — Sentry init site (no code change; env-only).
- titan paths (out of repo but referenced): `/mnt/user/appdata/traefik/dynamic/knowlune.yml`, Cloudflare Tunnel ingress config.

## Verification (End-to-End)

1. **Build:** GitHub Actions builds `ghcr.io/pedrolages/knowlune:<sha>` + `:main` on push.
2. **Deploy:** Watchtower on titan pulls `:main`; container restarts.
3. **Reach:** `curl -I https://knowlune.pedrolages.net/` returns `200` with correct `server: nginx` header.
4. **SPA routing:** `curl https://knowlune.pedrolages.net/some-deep-route` returns `index.html` (SPA fallback).
5. **API:** `curl https://knowlune.pedrolages.net/api/health` returns `{"ok":true}` or equivalent health response.
6. **Auth:** Browser — sign in with magic link to Pedro's email; dashboard renders; video progress loads from Supabase.
7. **Rollback drill:** Retag previous image as `:main`, Watchtower pulls within polling window, app works on prior commit.

## Handoff

Recommended next step: `/ce-plan` on this file to produce a step-by-step implementation plan (GHCR workflow, Traefik `knowlune.yml`, Cloudflare Tunnel ingress, watchtower labels, env wiring). The work is small (likely a single short plan, not an epic) and entirely additive — no code changes in `src/` or `server/`.
