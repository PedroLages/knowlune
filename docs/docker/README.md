# Knowlune on titan — deploy runbook

Daily-driver deploy of Knowlune to Pedro's Unraid server (titan) at
`https://knowlune.pedrolages.net`. Push to `main` → GitHub Actions builds and
pushes to GHCR → Tailscale SSH to titan → `docker compose pull && up -d`.

**Scope:** personal daily-driver. Not a public beta. See
[`2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`](../plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md)
for the beta path (restore rehearsal, Postgres tuning, privacy policy).

Plan of record: [`2026-04-20-002-feat-host-knowlune-titan-daily-driver-plan.md`](../plans/2026-04-20-002-feat-host-knowlune-titan-daily-driver-plan.md).

## Architecture

```
git push main
  └─► GitHub Actions
        ├─ build image with VITE_* build-args  ──►  ghcr.io/pedrolages/knowlune:{sha-*,main}
        └─ Tailscale SSH to titan  ──►  docker compose pull && up -d
                                             └─► Traefik (HTTP :80)
                                                   └─► Cloudflare Tunnel (TLS at edge)
                                                         └─► https://knowlune.pedrolages.net
```

Supabase calls go browser-direct to `https://supabase.pedrolages.net` (cross-origin,
Kong CORS must allow the new origin). `/api/*` is same-origin via the bundled
nginx proxy to the Express server on `127.0.0.1:3001`.

## First-time setup

### 1. GitHub repository config

Stage these **before** enabling the deploy job.

**Repository variables** (Settings → Secrets and variables → Actions → Variables):

| Name                     | Value                                  |
| ------------------------ | -------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://supabase.pedrolages.net`      |
| `VITE_API_BASE_URL`      | (usually blank — same-origin `/api`)   |
| `TITAN_DEPLOY_ENABLED`   | `false` at first; `true` to activate   |

**Repository secrets** (same page → Secrets):

| Name                      | Source                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `VITE_SUPABASE_ANON_KEY`  | Supabase dashboard → Settings → API → `anon` key (safe to bake into bundle; RLS enforces) |
| `VITE_SENTRY_DSN`         | Sentry project DSN (optional; omit to skip Sentry wire-up on first deploy)      |
| `TS_OAUTH_CLIENT_ID`      | Tailscale admin → Settings → OAuth clients → new client with `auth_keys` scope  |
| `TS_OAUTH_SECRET`         | Same OAuth client                                                               |
| `TITAN_DEPLOY_SSH_KEY`    | Private ed25519 key for the `deploy` user on titan (see §2)                     |
| `TITAN_SSH_HOST`          | Tailscale MagicDNS name (e.g. `titan`) or tailnet IP                            |
| `TITAN_SSH_USER`          | `deploy` (or whichever restricted user you create in §2)                        |

### 2. titan — create deploy user + SSH key

```bash
# On titan:
sudo useradd -m -G docker deploy
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy chmod 700 /home/deploy/.ssh

# Generate the keypair locally, paste the public key into authorized_keys,
# paste the private key into GitHub secret TITAN_DEPLOY_SSH_KEY.
ssh-keygen -t ed25519 -C "knowlune-ci@titan" -f ./titan_deploy -N ""
```

The `deploy` user needs Docker group membership and read access to
`/mnt/cache/docker/stacks/knowlune/`. Restrict the SSH key via a Tailscale ACL
(`tag:ci` → `tag:homelab` on port 22 only) rather than `authorized_keys`
force-commands — parameterised `IMAGE_TAG` is simpler without them.

### 3. titan — stack directory

```bash
sudo install -d -o deploy -g deploy /mnt/cache/docker/stacks/knowlune
cd /mnt/cache/docker/stacks/knowlune
```

Copy [`compose.example.yml`](compose.example.yml) to `docker-compose.yml` and
adjust the `networks:` stanza to match titan's Traefik network name
(commonly `traefik` or `proxy`).

Create `.env` next to it with the **runtime** contract. `VITE_*` are baked at
build time in GHCR — they do **not** belong here.

```ini
# /mnt/cache/docker/stacks/knowlune/.env

# Written by CI on every deploy; initial value is fine.
IMAGE_TAG=main

# Server-runtime secrets (required; without these, server/index.ts:563 skips the
# auth+rate-limit middleware chain and logs a DISABLED warning).
ALLOWED_ORIGINS=https://knowlune.pedrolages.net
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
# VITE_SENTRY_DSN=... (only if you want server-side Sentry too)
```

### 4. GHCR pull credentials on titan

```bash
# On titan as the deploy user (or root, then chown the config):
echo "$GHCR_PAT" | docker login ghcr.io -u pedrolages --password-stdin
```

The PAT needs only `read:packages`. Credentials land in
`~/.docker/config.json` and persist across reboots.

### 5. Supabase Kong CORS

Add `https://knowlune.pedrolages.net` to the Supabase Kong allow-list on
titan, else the first sign-in fails with a CORS error. See the Supabase
self-host docs for `kong.yml` or the corresponding env var.

### 6. Cloudflare Tunnel ingress

On titan, edit the `cloudflared` ingress (either `config.yml` under
`/mnt/user/appdata/cloudflared/` or the Cloudflare One dashboard) and insert
**before** the catch-all 404:

```yaml
- hostname: knowlune.pedrolages.net
  service: http://<traefik-host>:80
```

Then create the CNAME:

```bash
cloudflared tunnel route dns <tunnel-name> knowlune.pedrolages.net
```

Restart `cloudflared` (`systemctl restart cloudflared` or restart the
container). Verify with `dig knowlune.pedrolages.net CNAME`.

### 7. Activate the deploy job

Flip `TITAN_DEPLOY_ENABLED=true` in GitHub repository variables. The next
push to `main` runs build-and-push **and** deploy.

## Rollback

**One-click:** <https://github.com/PedroLages/Knowlune/actions/workflows/deploy-titan.yml> → pick prior green run → "Re-run all jobs". End-to-end under 2 minutes.

Alternative (manual, on titan):

```bash
cd /mnt/cache/docker/stacks/knowlune
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=sha-<previous-short-sha>|" .env
docker compose pull && docker compose up -d
```

## Adding a staging environment (R8)

Same image, different env, new subdomain. No rebuild required.

1. Provision `staging.pedrolages.net` through Cloudflare Tunnel (repeat §6).
2. Clone the stack dir: `cp -r /mnt/cache/docker/stacks/knowlune /mnt/cache/docker/stacks/knowlune-staging`.
3. Edit the clone's `.env` with staging `ALLOWED_ORIGINS` and whichever Supabase project you want.
4. Edit the clone's `docker-compose.yml`: change `container_name`, the Traefik router name, and the `Host(...)` rule to the staging hostname.
5. `docker compose up -d`.

The `ghcr.io/pedrolages/knowlune:<tag>` image is reused untouched — staging
and daily-driver can pin different `IMAGE_TAG` values independently.

## Troubleshooting

| Symptom                                                    | Likely cause                                                   | Fix                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Every `/api/*` returns 403                                 | `ALLOWED_ORIGINS` missing or wrong on titan                    | Fix `.env`, `docker compose up -d`.                                                |
| Server log warns "middleware chain DISABLED"               | `ALLOWED_ORIGINS` **or** `SUPABASE_JWT_SECRET` blank           | Both required; see [`server/index.ts:563-567`](../../server/index.ts).             |
| Login fails with a CORS error in the browser               | Supabase Kong not updated                                      | Add `knowlune.pedrolages.net` to Supabase CORS allow-list (§5).                    |
| `docker compose pull` fails with 401                       | GHCR PAT on titan expired                                      | Regenerate `read:packages` PAT and `docker login ghcr.io` again.                   |
| Tailscale step fails on CI                                 | OAuth client secret expired or ACL misconfigured               | Issue new OAuth client; verify `tag:ci` can reach `tag:homelab:22`.                |
| SPA loads but Supabase calls hit `undefined` URL           | Build-args weren't set at image build time                     | Fill GitHub Actions `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; re-run workflow. |

## Notes

- Do **not** use this setup to onboard external users. The beta plan exists
  for that — restore rehearsal, privacy policy, and delete-account flow are
  prerequisites, and none of them are in place here.
- The legacy [`.forgejo/workflows/deploy.yml`](../../.forgejo/workflows/deploy.yml)
  is retired once the new flow is verified green (plan Unit 7).
