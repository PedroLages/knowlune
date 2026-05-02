---
title: "Expose your Audiobookshelf server over HTTPS"
status: stub
date: 2026-04-24
---

# Expose your Audiobookshelf server over HTTPS

Knowlune runs in your browser and talks to your Audiobookshelf (ABS) server
directly. For security reasons, browsers won't let a site served over HTTPS
(like knowlune.pedrolages.net) talk to a server over plain HTTP. You have
three options to give your ABS server an HTTPS address.

> This is a stub — full step-by-step guides are coming. The three paths
> below work today; pick the one that fits your setup.

## Option 1: Tailscale Funnel (recommended — free, no domain needed)

- Install Tailscale on the machine running ABS.
- Run `tailscale funnel 13378` (swap the port for your ABS port).
- You'll get an HTTPS URL like `https://your-machine.tail-scale.ts.net`.
- Paste that into Knowlune.

**Docs:** <https://tailscale.com/docs/features/tailscale-funnel>

## Option 2: Cloudflare Tunnel (free, needs your own domain)

- Create a tunnel in the Cloudflare Zero Trust dashboard.
- Point a subdomain (e.g. `abs.yourdomain.com`) at your local ABS server.
- Cloudflare handles HTTPS for you.

**Docs:** <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>

## Option 3: Reverse proxy + Let's Encrypt

- Put Caddy, Traefik, or nginx in front of ABS on a machine with a
  public IP and a DNS record.
- The reverse proxy terminates TLS; ABS keeps serving plain HTTP on its
  local port.

## One more step: CORS allowlist on ABS

After your ABS has an HTTPS URL, open the ABS web UI:

**Settings → Security → Allowed Origins** → add
`https://knowlune.pedrolages.net`.

This is required (browsers block cross-origin requests by default).
Requires ABS v2.26 or newer.
