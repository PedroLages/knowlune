# Cloudflare Pages Setup (Knowlune SPA)

Runbook for deploying the Knowlune SPA to Cloudflare Pages, backed by Supabase Cloud.

Supersedes [deploy-titan.yml](../../.github/workflows/deploy-titan.yml), which is retained only for the 14-day rollback window during the self-hosted → Cloud migration (see [2026-04-24-005-refactor-migrate-to-supabase-cloud-plan.md](../plans/2026-04-24-005-refactor-migrate-to-supabase-cloud-plan.md) Unit 11).

## Prerequisites

- A Supabase **Cloud** project (prod) already provisioned (Unit 1). Current prod ref: `chyvhrbtttpumsyuhgbu`.
- Edge Functions deployed to Cloud (Unit 5).
- Auth redirect URIs configured on the Cloud project (Unit 6).
- GitHub repo access (`PedroLages/Knowlune`).

## One-Time Dashboard Setup

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select the `Knowlune` repo, branch `main`.
3. Build configuration:
   - **Framework preset:** None (custom)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (default)
   - **Node version:** set env var `NODE_VERSION=20` (Pages default is too old for Vite 6)
4. Environment variables (**Production** scope — click "Add variable" for each):

   | Name | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://chyvhrbtttpumsyuhgbu.supabase.co` | Cloud prod project |
   | `VITE_SUPABASE_ANON_KEY` | (from Supabase dashboard → Settings → API → Project API keys → `anon` `public`) | Safe to expose to the browser |
   | `VITE_API_BASE_URL` | `https://chyvhrbtttpumsyuhgbu.supabase.co/functions/v1` | Edge Functions base |
   | `VITE_SENTRY_DSN` | (optional) | Leave unset if Sentry not used |
   | `NODE_VERSION` | `20` | Required for Vite 6 |

   **Preview** scope: mirror the same values (Pages PR previews share the prod Supabase for now — see "Preview deploys" below if that changes).

5. Save and trigger the first deploy. Pages auto-builds on every push to `main`.

## SPA Routing

[`public/_redirects`](../../public/_redirects) handles SPA fallback with `/* /index.html 200`. This file is copied into `dist/` by Vite at build time. Without it, direct navigation to `/courses` returns 404.

**Verification:** after first deploy, visit `https://<project>.pages.dev/courses` directly (not via in-app navigation) — the SPA should render, not 404.

## Custom Domain (Cutover — Unit 10)

Until cutover:
- Pages serves from the default `knowlune-<hash>.pages.dev` URL.
- `knowlune.pedrolages.net` continues to resolve to the titan Docker deploy.

At cutover (Unit 10):
1. Pages dashboard → **Custom domains** → **Set up a custom domain** → enter `knowlune.pedrolages.net`.
2. Cloudflare detects the existing DNS record. Replace the `A`/`CNAME` with the Pages target (CF provides the exact value).
3. SSL provisions automatically (1-2 min).
4. Verify: `curl -I https://knowlune.pedrolages.net` returns `cf-ray` header and 200.

## Preview Deploys

Every PR gets a preview URL (`https://<pr-hash>.knowlune.pages.dev`). Previews use the **Preview** environment variable scope. Current policy: previews share the **prod** Supabase project (acceptable because RLS scopes all data per-user). If test-data isolation is ever needed, create a staging Supabase project and point Preview env vars at it.

## Environment Variables — Source of Truth

Cloudflare Pages dashboard is authoritative for SPA env vars in production. Local dev uses `.env` / `.env.local` (see [.env.example](../../.env.example)). Do **not** commit real anon keys to the repo.

To update a prod env var:
1. Pages dashboard → project → **Settings** → **Environment variables**.
2. Edit the variable.
3. Trigger a redeploy: Deployments → latest → **Retry deployment** (env changes require a rebuild — they're baked in at `npm run build` time by Vite).

## Rollback (14-day window)

If the Pages deployment fails, roll back to titan:
1. Pages dashboard → **Custom domains** → remove `knowlune.pedrolages.net`.
2. Restore the prior DNS record (A → titan IP, via Cloudflare DNS dashboard).
3. On titan: `cd /mnt/cache/docker/stacks/knowlune && docker compose up -d` (if the container was stopped in Unit 10 step 3).
4. [.github/workflows/deploy-titan.yml](../../.github/workflows/deploy-titan.yml) still builds and pushes on every `main` push, so titan will pick up the latest image.

After Unit 11's 14-day window elapses, delete `deploy-titan.yml`, `Dockerfile`, and `docker-compose.yml`.

## References

- [Cloudflare Pages + React](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Pages `_redirects` docs](https://developers.cloudflare.com/pages/configuration/redirects/)
- [Migration plan Unit 8](../plans/2026-04-24-005-refactor-migrate-to-supabase-cloud-plan.md)
- Beta launch plan (superseded by migration): [2026-04-18-011-feat-knowlune-online-beta-launch-plan.md](../plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md)
