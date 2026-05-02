---
title: "Jellyfin: switch to DNS-only to fix playback"
date: 2026-04-27
status: paused
owner: pedro
---

## Context

Playback works on LAN (`http://192.168.2.200:8096`) but fails via `https://jellyfin.pedrolages.net` when routed through **Cloudflare Tunnel → Traefik → Jellyfin**.

Read-only diagnostics on Titan show HLS playlists/segments are reachable over the domain, but Traefik access logs include **client aborts (499)** during `main.m3u8` requests, consistent with browser player failure behind a proxy/CDN.

Web research indicates Cloudflare’s standard proxy/tunnel is **not a reliable/allowed path for serving video bits** on Free/Pro/Business; Cloudflare recommends serving video from a **grey-clouded (DNS-only) subdomain** or using paid video services.

## Goal

Fix Jellyfin playback reliability by removing Cloudflare proxy/tunnel from the playback data path:

- `jellyfin.pedrolages.net` becomes **DNS-only (grey cloud)**.
- TLS terminates at **Traefik (Let’s Encrypt)** (keep current approach).

## Critical decision gate (must decide before starting)

DNS-only means Cloudflare will no longer tunnel/proxy traffic. Clients must reach Traefik on Titan directly.

Choose one:

1. **Port-forwarding allowed** (recommended for DNS-only)
   - Router forwards **443 → Titan (Traefik)** (and optionally 80 for redirects/ACME).
2. **No ports open**
   - DNS-only will not work.
   - Alternative: keep Jellyfin private and use **Tailscale/WireGuard** for playback.

## Plan (DNS-only path)

### 1) Cloudflare DNS

- Set DNS record `jellyfin.pedrolages.net` to **DNS-only** (grey cloud).
- Ensure it resolves to your home public IP (A/AAAA) or DDNS hostname.

### 2) Cloudflare Tunnel

- Remove/disable the Tunnel Public Hostname for `jellyfin.pedrolages.net` (to avoid confusion/overlap).
  - Keep Tunnel hostnames for non-video apps as desired.

### 3) Router / WAN ingress (if using port-forwarding)

- Forward TCP **443** to Titan’s LAN IP (Traefik).
- Optional: forward TCP **80** for redirects and/or ACME HTTP-01 (if you use it).
  - If Traefik is using DNS-01 via Cloudflare already, port 80 is not required for cert issuance.

### 4) Traefik verification

- Confirm Traefik router for Jellyfin still points to the upstream service:
  - Dynamic config: `/mnt/user/appdata/traefik/dynamic/services.yml` includes:
    - Router `jellyfin` (Host rule)
    - Service `jellyfin` → `http://jellyfin:8096`

### 5) End-to-end checks

From outside your LAN (phone on mobile data):

- `https://jellyfin.pedrolages.net/` loads the UI.
- Playback works (no “fatal player error”).

On Titan (read-only validation commands):

```bash
curl -k -I https://jellyfin.pedrolages.net/
docker logs --since 15m traefik | egrep -i "(jellyfin|error|timeout)" | tail
docker logs --since 15m jellyfin | egrep -i "(playback|transcod|hls|error)" | tail
```

## Rollback

- Re-enable the Tunnel Public Hostname for `jellyfin.pedrolages.net`.
- Switch DNS back to proxied/tunnel approach.

## References

- Cloudflare policy: `https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/`
- Jellyfin forum discussion (tunnel + video streaming): `https://forum.jellyfin.org/t-cloudflare-tunnel-cache-issue`
