---
title: "Audiobookshelf integration: browser-direct REST calls with Bearer auth"
date: 2026-04-24
category: docs/solutions/integration-issues/
module: audiobookshelf
problem_type: integration
component: library-sync
tags:
  - cors
  - bearer-auth
  - architecture
  - abs
  - audiobookshelf
severity: high
---

# Audiobookshelf integration: browser-direct REST calls with Bearer auth

## Context

Knowlune's Audiobookshelf (ABS) integration originally routed every REST
call through an Express backend proxy (`/api/abs/proxy/*`) co-deployed
with the frontend on Unraid. The proxy injected `Authorization: Bearer`
headers, forwarded `Range` requests for audio streaming, cached covers,
and relayed the response.

When Knowlune moved to Cloudflare Pages (static hosting) the proxy had
nowhere to run. ABS features broke in production with
`Server error (405)` because the proxy path resolved to the static host.

## Decision

Call the user's ABS server directly from the browser:

- **REST**: `Authorization: Bearer <apiKey>` header, direct to
  `https://<user-abs>/api/*`.
- **Covers and audio**: `?token=<apiKey>` query param (HTML `<img>` and
  `<audio>` elements can't set headers). ABS natively accepts this.
- **WebSocket (Socket.IO)**: unchanged — already spoke directly to ABS.

Requirements the user must satisfy:

1. ABS reachable over HTTPS (browsers block HTTPS→HTTP mixed content).
   Tailscale Funnel gives free HTTPS in ~3 minutes without a domain.
2. ABS v2.26+ with `https://knowlune.pedrolages.net` in
   **Settings → Security → Allowed Origins**.

## Why not a cloud proxy?

- Can't reach LAN ABS (most users).
- Routes user API tokens through our infrastructure.
- Open-proxy risk: arbitrary user-supplied target URLs in a Worker
  violate Cloudflare ToS.

## Implementation touch-points

- [`src/services/AudiobookshelfService.ts`](../../../src/services/AudiobookshelfService.ts)
  - `absApiFetch()` — direct REST with Bearer header.
  - `getCoverUrl()` / `getStreamUrlFromSession()` — direct URLs with
    `?token=` query param.
  - `isMixedContentBlocked()` — detects HTTPS-app + HTTP-ABS pairings
    so the settings form can fail fast.
- [`src/app/components/library/AudiobookshelfServerForm.tsx`](../../../src/app/components/library/AudiobookshelfServerForm.tsx)
  - Blocks save for HTTP URLs from an HTTPS origin, links to the setup
    guide, and directs CORS failures to the right ABS setting.
- `server/index.ts` — ABS proxy routes deleted; browser does the work.

## Error surfaces

| Condition | User-facing message |
|-----------|--------------------|
| HTTPS app + HTTP ABS URL | "Your browser can't reach an http:// server from this HTTPS app. Expose your Audiobookshelf server over HTTPS and try again." |
| `fetch()` TypeError (CORS, DNS, refused) | "Could not reach your Audiobookshelf server. If the URL is correct, add this app's origin to your ABS Settings → Security → Allowed Origins." |
| 401 | "Authentication failed. Check your API key." |
| 403 | "Access denied. Your API key may lack permissions." |

## Tradeoffs accepted

- Token in URL for covers/audio appears in browser devtools network
  panel. The proxy had the same exposure; documenting rather than
  solving.
- Users on older ABS (<2.26) have no `allowedOrigins` setting — they
  must upgrade.
- LAN-only ABS users need to expose the server (Tailscale Funnel,
  Cloudflare Tunnel, reverse proxy).

## References

- [Audiobookshelf API](https://api.audiobookshelf.org/) — Bearer auth + query-param token for GET binary endpoints.
- [ABS allowedOrigins PR #4557](https://github.com/advplyr/audiobookshelf/pull/4557) — added in v2.26.
- [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) — free HTTPS without a domain.
- Plan: [`docs/plans/2026-04-24-006-refactor-abs-browser-direct-bearer-auth-plan.md`](../../plans/2026-04-24-006-refactor-abs-browser-direct-bearer-auth-plan.md)
